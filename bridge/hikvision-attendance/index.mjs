import { readFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { HikvisionClient } from "./hikvision-client.mjs";
import { SupabaseAttendanceSink } from "./supabase-sink.mjs";

const BRIDGE_VERSION = "1.0.0";
const configPath = resolve(process.argv.find(argument => argument.endsWith(".json")) ?? process.env.AECS_HIKVISION_CONFIG ?? "bridge.config.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
for (const field of ["deviceIp","deviceSerial","deviceUsername","devicePassword","supabaseUrl","supabaseServiceRoleKey"]) {
  if (!config[field]) throw new Error(`Missing required bridge configuration: ${field}`);
}

const client = new HikvisionClient(config);
const sink = new SupabaseAttendanceSink(config);
const pollSeconds = Math.max(10, Number(config.pollSeconds ?? 30));
const overlapMinutes = Math.max(1, Number(config.overlapMinutes ?? 10));
const initialLookbackDays = Math.max(1, Number(config.initialLookbackDays ?? 7));
let syncing = false;

const log = (level, message, details) => {
  const suffix = details === undefined ? "" : ` ${JSON.stringify(details)}`;
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}${suffix}`;
  console.log(line);
  if (config.logPath) {
    try { appendFileSync(config.logPath, `${line}\n`, "utf8"); } catch (error) { console.error(`Could not append bridge log: ${error.message}`); }
  }
};

async function syncOnce() {
  if (syncing) return;
  syncing = true;
  try {
    const device = await sink.device();
    await sink.markAttempt({ last_error: null, bridge_version: BRIDGE_VERSION });
    const end = new Date(Date.now() + 60_000);
    const last = device.last_event_at ? new Date(device.last_event_at) : new Date(Date.now() - initialLookbackDays * 86_400_000);
    const start = new Date(last.getTime() - overlapMinutes * 60_000);
    const events = await client.searchEvents(start, end);
    const summary = { processed: 0, duplicate: 0, unmapped: 0, ignored: 0 };
    for (const event of events) {
      const result = await sink.ingest(event);
      const status = result?.status ?? "PROCESSED";
      if (status === "PROCESSED") summary.processed += 1;
      else if (status === "DUPLICATE") summary.duplicate += 1;
      else if (status === "UNMAPPED") summary.unmapped += 1;
      else summary.ignored += 1;
    }
    await sink.markAttempt({ last_success_at: new Date().toISOString(), last_error: null, bridge_version: BRIDGE_VERSION });
    log("info", `Attendance synchronization completed (${events.length} events returned).`, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", message);
    try { await sink.markAttempt({ last_error: message, bridge_version: BRIDGE_VERSION }); } catch (statusError) { log("error", "Could not report bridge failure.", String(statusError)); }
    if (process.argv.includes("--once") || process.argv.includes("--diagnose")) process.exitCode = 1;
  } finally {
    syncing = false;
  }
}

if (process.argv.includes("--diagnose")) {
  const info = await client.deviceInfo();
  log("info", "Terminal connection succeeded.", info);
  await syncOnce();
} else if (process.argv.includes("--once")) {
  await syncOnce();
} else {
  log("info", `AECS Hikvision attendance bridge ${BRIDGE_VERSION} started.`, { device: config.deviceIp, interval: pollSeconds });
  await syncOnce();
  setInterval(() => void syncOnce(), pollSeconds * 1000);
}
