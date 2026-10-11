import { readFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { HikvisionClient } from "./hikvision-client.mjs";
import { SupabaseAttendanceSink } from "./supabase-sink.mjs";

const BRIDGE_VERSION = "1.1.2";
const configPath = resolve(process.argv.find(argument => argument.endsWith(".json")) ?? process.env.AECS_HIKVISION_CONFIG ?? "bridge.config.json");
const configText = (await readFile(configPath, "utf8")).replace(/^\uFEFF/, "");
const config = JSON.parse(configText);
for (const field of ["deviceIp","deviceSerial","deviceUsername","devicePassword","supabaseUrl","supabaseServiceRoleKey"]) {
  if (!config[field]) throw new Error(`Missing required bridge configuration: ${field}`);
}

const client = new HikvisionClient({ ...config, configPath });
const sink = new SupabaseAttendanceSink(config);
const pollSeconds = Math.max(10, Number(config.pollSeconds ?? 30));
const overlapMinutes = Math.max(1, Number(config.overlapMinutes ?? 10));
const initialLookbackDays = Math.max(1, Number(config.initialLookbackDays ?? 1));
const reconciliationHours = Math.max(1, Number(config.reconciliationHours ?? 26));
const reconciliationMinutes = Math.max(1, Number(config.reconciliationMinutes ?? 5));
let syncing = false;
let lastReconciliationAt = 0;

const log = (level, message, details) => {
  const suffix = details === undefined ? "" : ` ${JSON.stringify(details)}`;
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}${suffix}`;
  console.log(line);
  if (config.logPath) {
    try { appendFileSync(config.logPath, `${line}\n`, "utf8"); } catch (error) { console.error(`Could not append bridge log: ${error.message}`); }
  }
};

if (process.argv.includes("--diagnose")) {
  client.onEventPage = details => log("info", "Terminal event page inspected.", details);
}

async function syncOnce() {
  if (syncing) return;
  syncing = true;
  try {
    const device = await sink.device();
    await sink.markAttempt({ last_error: null, bridge_version: BRIDGE_VERSION });
    const end = new Date(Date.now() + 60_000);
    const last = device.last_event_at ? new Date(device.last_event_at) : new Date(Date.now() - initialLookbackDays * 86_400_000);
    const reconcile = process.argv.includes("--diagnose") || process.argv.includes("--once") || Date.now() - lastReconciliationAt >= reconciliationMinutes * 60_000;
    const cursorStart = last.getTime() - overlapMinutes * 60_000;
    const start = new Date(reconcile ? Date.now() - reconciliationHours * 60 * 60_000 : cursorStart);
    const events = await client.searchEvents(start, end);
    const summary = { processed: 0, duplicate: 0, unmapped: 0, ignored: 0 };
    for (const event of events) {
      let result = await sink.ingest(event);
      if (result?.status === "DUPLICATE" && Math.abs(client.clockOffsetMs) >= 60_000) {
        result = await sink.replaceClockCorrectedEvent(event);
      }
      const status = result?.status ?? "PROCESSED";
      if (status === "PROCESSED") summary.processed += 1;
      else if (status === "DUPLICATE") summary.duplicate += 1;
      else if (status === "UNMAPPED") summary.unmapped += 1;
      else summary.ignored += 1;
    }
    await sink.markAttempt({ last_success_at: new Date().toISOString(), last_error: null, bridge_version: BRIDGE_VERSION });
    if (reconcile) lastReconciliationAt = Date.now();
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

async function prepareTerminalClock() {
  try {
    const clock = await client.calibrateClock();
    const driftSeconds = Math.round(clock.driftMs / 1000);
    if (Math.abs(driftSeconds) >= 60) log("warn", "Terminal clock drift detected; this synchronization batch will be corrected.", { terminalTime: clock.localTime, driftSeconds });
    else client.clockOffsetMs = 0;
    return clock;
  } catch (error) {
    log("warn", `Could not read terminal clock; continuing without clock correction: ${error instanceof Error ? error.message : String(error)}`);
    client.clockOffsetMs = 0;
    return null;
  }
}

async function repairTerminalClock(clock) {
  if (!clock || Math.abs(clock.driftMs) < 60_000) return;
  try {
    const updated = await client.setClockToNepalTime();
    log("info", "Terminal clock synchronized to Nepal time.", { terminalTime: updated.localTime });
  } catch (error) {
    log("warn", `Attendance imported with clock correction, but the terminal clock could not be updated: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (process.argv.includes("--diagnose")) {
  try {
    const info = await client.deviceInfo();
    log("info", "Terminal connection succeeded.", info);
    const clock = await prepareTerminalClock();
    await syncOnce();
    await repairTerminalClock(clock);
  } catch (error) {
    log("error", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else if (process.argv.includes("--once")) {
  const clock = await prepareTerminalClock();
  await syncOnce();
  await repairTerminalClock(clock);
} else {
  log("info", `AECS Hikvision attendance bridge ${BRIDGE_VERSION} started.`, { device: config.deviceIp, interval: pollSeconds });
  const clock = await prepareTerminalClock();
  await syncOnce();
  await repairTerminalClock(clock);
  setInterval(() => void syncOnce(), pollSeconds * 1000);
}
