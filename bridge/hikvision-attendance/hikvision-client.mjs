import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const nativeHelperPath = fileURLToPath(new URL("./hikvision-request.ps1", import.meta.url));

const digestHash = (algorithm, value) => {
  const normalized = String(algorithm || "MD5").toUpperCase();
  const hashName = normalized.startsWith("SHA-256") ? "sha256"
    : normalized.startsWith("SHA-512-256") ? "sha512-256"
      : normalized.startsWith("MD5") ? "md5" : null;
  if (!hashName) throw new Error(`Unsupported terminal Digest algorithm: ${algorithm}`);
  return createHash(hashName).update(value).digest("hex");
};
const md5 = value => digestHash("MD5", value);

function parseDigestChallenge(header) {
  if (!header?.startsWith("Digest ")) throw new Error("The terminal did not offer Digest authentication. Check the device HTTP authentication settings.");
  const values = {};
  for (const match of header.slice(7).matchAll(/([a-zA-Z0-9_-]+)=(?:"([^"]*)"|([^,\s]+))/g)) {
    values[match[1]] = match[2] ?? match[3];
  }
  if (!values.realm || !values.nonce) throw new Error("The terminal returned an invalid Digest authentication challenge.");
  return values;
}

export async function digestRequest({ baseUrl, username, password }, path, options = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  const url = new URL(path, baseUrl);
  const first = await fetch(url, { ...options, method, redirect: "manual" });
  if (first.status !== 401) return first;

  const challenge = parseDigestChallenge(first.headers.get("www-authenticate"));
  const uri = `${url.pathname}${url.search}`;
  const qop = challenge.qop?.split(",").map(value => value.trim()).find(value => value === "auth");
  const nc = "00000001";
  const cnonce = randomBytes(12).toString("hex");
  const algorithm = challenge.algorithm || "MD5";
  const initialHa1 = digestHash(algorithm, `${username}:${challenge.realm}:${password}`);
  const ha1 = algorithm.toUpperCase().endsWith("-SESS")
    ? digestHash(algorithm, `${initialHa1}:${challenge.nonce}:${cnonce}`)
    : initialHa1;
  const ha2 = digestHash(algorithm, `${method}:${uri}`);
  const response = qop
    ? digestHash(algorithm, `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : digestHash(algorithm, `${ha1}:${challenge.nonce}:${ha2}`);
  const fields = [
    `username="${username}"`, `realm="${challenge.realm}"`, `nonce="${challenge.nonce}"`,
    `uri="${uri}"`, `response="${response}"`, `algorithm=${algorithm}`,
  ];
  if (challenge.opaque) fields.push(`opaque="${challenge.opaque}"`);
  if (qop) fields.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Digest ${fields.join(", ")}`);
  const digestResponse = await fetch(url, { ...options, method, headers, redirect: "manual" });
  if (digestResponse.status !== 401) return digestResponse;

  // Some older attendance terminals advertise Digest but only accept the
  // compatibility authentication path used by Windows web clients.
  const compatibilityHeaders = new Headers(options.headers);
  compatibilityHeaders.set("Authorization", `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`);
  return fetch(url, { ...options, method, headers: compatibilityHeaders, redirect: "manual" });
}

async function windowsCredentialRequest(configPath, path, options = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  const body = options.body == null ? "" : Buffer.from(String(options.body), "utf8").toString("base64");
  const contentType = new Headers(options.headers).get("content-type") ?? "application/json";
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", nativeHelperPath,
    "-ConfigPath", configPath, "-Method", method, "-Path", path,
    "-BodyBase64", body, "-ContentType", contentType,
  ], { windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  const envelope = JSON.parse(stdout.trim());
  const responseBody = Buffer.from(envelope.bodyBase64 ?? "", "base64");
  return new Response(responseBody, { status: Number(envelope.status), headers: envelope.headers ?? {} });
}

async function curlDigestRequest({ baseUrl, username, password }, path, options = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  const url = new URL(path, baseUrl).toString();
  const marker = "\n__AECS_HTTP_STATUS__:";
  const args = [
    "--silent", "--show-error", "--digest", "--user", `${username}:${password}`,
    "--connect-timeout", "10", "--max-time", "30", "--request", method,
  ];
  for (const [name, value] of new Headers(options.headers)) args.push("--header", `${name}: ${value}`);
  if (options.body != null) args.push("--data-binary", String(options.body));
  args.push("--write-out", `${marker}%{http_code}`, url);
  const { stdout } = await execFileAsync("curl.exe", args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024, encoding: "buffer" });
  const output = Buffer.from(stdout);
  const markerBytes = Buffer.from(marker);
  const markerPosition = output.lastIndexOf(markerBytes);
  if (markerPosition < 0) throw new Error("curl.exe did not return the terminal HTTP status.");
  const status = Number(output.subarray(markerPosition + markerBytes.length).toString("ascii").trim());
  if (!Number.isInteger(status) || status < 100) throw new Error(`Terminal request failed before an HTTP response was received (curl status ${status || 0}).`);
  return new Response(output.subarray(0, markerPosition), { status });
}

function localizeDeviceTimestamp(value) {
  if (!value) return null;
  const normalized = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) return `${normalized}+05:45`;
  return normalized;
}

export function normalizeHikvisionEvent(raw, deviceSerial) {
  const deviceUserId = raw.employeeNoString ?? raw.employeeNo ?? raw.personNo ?? raw.cardNo ?? raw.userID;
  const occurredAt = localizeDeviceTimestamp(raw.time ?? raw.dateTime ?? raw.eventTime ?? raw.occurredAt);
  if (!deviceUserId || !occurredAt || Number.isNaN(Date.parse(occurredAt))) return null;
  const serial = raw.serialNo ?? raw.eventID ?? raw.eventId ?? raw.sequenceNo;
  const eventUid = serial == null
    ? md5([deviceSerial,deviceUserId,occurredAt,raw.major,raw.minor,raw.attendanceStatus].join("|"))
    : String(serial);
  return {
    eventUid,
    deviceUserId: String(deviceUserId).trim(),
    occurredAt: new Date(occurredAt).toISOString(),
    eventKind: raw.eventKind ?? raw.subEventType ?? "FINGERPRINT",
    authenticationMode: raw.currentVerifyMode ?? raw.verifyMode ?? raw.authenticationMode ?? null,
    attendanceStatus: raw.attendanceStatus ?? raw.attendanceState ?? null,
    raw,
  };
}

function eventList(payload) {
  const candidate = payload?.AcsEvent?.InfoList ?? payload?.AcsEventInfoList ?? payload?.InfoList ?? [];
  if (Array.isArray(candidate)) return candidate;
  if (candidate && typeof candidate === "object") return [candidate];
  return [];
}

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function xmlDecode(value) {
  return String(value)
    .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'").replaceAll("&amp;", "&")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === "x" ? Number.parseInt(code.slice(1), 16) : Number.parseInt(code, 10)));
}

function xmlValue(xml, name) {
  const match = String(xml).match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? xmlDecode(match[1].trim()) : undefined;
}

function xmlEventPayload(xml) {
  const text = String(xml).replace(/^\uFEFF/, "");
  const status = xmlValue(text, "statusCode");
  if (status && status !== "1" && status !== "200") {
    const message = xmlValue(text, "subStatusCode") ?? xmlValue(text, "statusString") ?? "terminal rejected the request";
    throw new Error(`Hikvision ISAPI error ${status}: ${message}`);
  }
  const blocks = [...text.matchAll(/<InfoList(?:\s[^>]*)?>([\s\S]*?)<\/InfoList>/gi)].map(match => match[1]);
  const eventBlocks = blocks.flatMap(block => {
    const nested = [...block.matchAll(/<(?:AcsEventInfo|eventInfo)(?:\s[^>]*)?>([\s\S]*?)<\/(?:AcsEventInfo|eventInfo)>/gi)].map(match => match[1]);
    return nested.length ? nested : [block];
  });
  const fields = [
    "employeeNoString", "employeeNo", "personNo", "cardNo", "userID", "time", "dateTime", "eventTime",
    "serialNo", "eventID", "eventId", "sequenceNo", "major", "minor", "attendanceStatus", "attendanceState",
    "currentVerifyMode", "verifyMode", "eventKind", "subEventType", "name", "deviceName", "doorNo",
  ];
  const InfoList = eventBlocks.map(block => Object.fromEntries(fields.map(field => [field, xmlValue(block, field)]).filter(([, value]) => value !== undefined)));
  return { AcsEvent: {
    searchID: xmlValue(text, "searchID"),
    numOfMatches: Number(xmlValue(text, "numOfMatches") ?? InfoList.length),
    totalMatches: Number(xmlValue(text, "totalMatches") ?? InfoList.length),
    InfoList,
  } };
}

function terminalTimestamp(value) {
  const shifted = new Date(new Date(value).getTime() + 345 * 60_000);
  return `${shifted.toISOString().slice(0, 19)}+05:45`;
}

function legacyTerminalTimestamp(value) {
  // Early DS-K1A8503 firmware parses the timestamp as device-local time and
  // reports badJsonFormat when a quarter-hour UTC offset is present.
  return new Date(new Date(value).getTime() + 345 * 60_000).toISOString().slice(0, 19);
}

async function parseEventResponse(response) {
  const text = await response.text();
  if (!response.ok) return { ok: false, status: response.status, detail: text.slice(0, 500) };
  try { return { ok: true, payload: JSON.parse(text) }; }
  catch { return { ok: true, payload: xmlEventPayload(text) }; }
}

export class HikvisionClient {
  constructor(config) {
    this.auth = {
      baseUrl: `http://${config.deviceIp}:${config.deviceHttpPort ?? 80}`,
      username: config.deviceUsername,
      password: config.devicePassword,
    };
    this.configPath = config.configPath;
    this.deviceSerial = config.deviceSerial;
  }


  async request(path, options = {}) {
    if (process.platform === "win32" && this.configPath) {
      try { return await curlDigestRequest(this.auth, path, options); }
      catch (error) {
        if (error?.code !== "ENOENT") throw error;
        return windowsCredentialRequest(this.configPath, path, options);
      }
    }
    return digestRequest(this.auth, path, options);
  }

  async deviceInfo() {
    const response = await this.request("/ISAPI/System/deviceInfo?format=json", { headers: { Accept: "application/json" } });
    if (!response.ok) {
      if (response.status === 401) throw new Error("The terminal rejected its administrator username or password (HTTP 401). Confirm the device web-admin credentials and retry.");
      if (response.status === 403) throw new Error("The terminal accepted the login but denied ISAPI device information (HTTP 403). Enable ISAPI/Open Network Video Interface access for the administrator.");
      throw new Error(`Device information request failed with HTTP ${response.status}.`);
    }
    const text = await response.text();
    try { return JSON.parse(text); } catch { return { raw: text }; }
  }

  async searchEvents(startTime, endTime) {
    const results = [];
    // The DS-K1A8503EF-B firmware accepts at most 30 records and may only
    // implement the XML form of this endpoint even when ?format=json exists.
    const maxResults = 10;
    let format = "json";
    // Older 1A8503 firmware rejects large date ranges with HTTP 400. Query
    // one day at a time and deduplicate records on the inclusive boundaries.
    const first = new Date(startTime).getTime();
    const last = new Date(endTime).getTime();
    for (let windowStart = first; windowStart < last; windowStart += 86_400_000) {
      const windowEnd = Math.min(last, windowStart + 86_400_000 - 1);
      // This terminal generation documents a short search token. Some newer
      // access controllers accept UUIDs, but the 1.4.x attendance firmware can
      // reject their hyphens as badJsonFormat.
      const searchID = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-16);
      for (let position = 0; position < 100000; position += maxResults) {
        const condition = {
          searchID,
          searchResultPosition: position,
          maxResults,
          major: 5,
          minor: 0,
          startTime: legacyTerminalTimestamp(windowStart),
          endTime: legacyTerminalTimestamp(windowEnd),
        };
        const jsonBody = JSON.stringify({ AcsEventCond: condition });
        const offsetCondition = {
          ...condition,
          startTime: terminalTimestamp(windowStart),
          endTime: terminalTimestamp(windowEnd),
        };
        const offsetJsonBody = JSON.stringify({ AcsEventCond: offsetCondition });
        const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><AcsEventCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">${Object.entries(condition).map(([key, value]) => `<${key}>${xmlEscape(value)}</${key}>`).join("")}</AcsEventCond>`;
        let parsed;
        if (format === "json") {
          parsed = await parseEventResponse(await this.request("/ISAPI/AccessControl/AcsEvent?format=json", {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: jsonBody,
          }));
          if (!parsed.ok && [400, 404, 405, 415].includes(parsed.status)) format = "offset";
        }
        // Retry with an explicit Nepal offset for firmware that implements the
        // newer ISAPI timestamp parser.
        if (format === "offset") {
          parsed = await parseEventResponse(await this.request("/ISAPI/AccessControl/AcsEvent?format=json", {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json; charset=UTF-8" },
            body: offsetJsonBody,
          }));
          if (!parsed.ok && [400, 404, 405, 415].includes(parsed.status)) format = "xml";
        }
        if (format === "xml") {
          parsed = await parseEventResponse(await this.request("/ISAPI/AccessControl/AcsEvent?format=xml", {
            method: "POST",
            headers: { Accept: "application/xml", "Content-Type": "application/xml; charset=UTF-8" },
            body: xmlBody,
          }));
        }
        if (!parsed?.ok) throw new Error(`Attendance event query failed with HTTP ${parsed?.status ?? "unknown"}: ${parsed?.detail ?? "no response body"}`);
        const payload = parsed.payload;
        const batch = eventList(payload);
        for (const raw of batch) {
          const event = normalizeHikvisionEvent(raw, this.deviceSerial);
          if (event) results.push(event);
        }
        const reported = Number(payload?.AcsEvent?.numOfMatches ?? batch.length);
        const total = Number(payload?.AcsEvent?.totalMatches ?? position + reported);
        if (reported < maxResults || position + reported >= total) break;
      }
    }
    return [...new Map(results.map(event => [event.eventUid, event])).values()].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  }
}
