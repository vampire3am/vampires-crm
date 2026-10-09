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
    if (process.platform === "win32" && this.configPath) return windowsCredentialRequest(this.configPath, path, options);
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
    const maxResults = 200;
    const searchID = randomBytes(12).toString("hex");
    for (let position = 0; position < 100000; position += maxResults) {
      const body = JSON.stringify({
        AcsEventCond: {
          searchID,
          searchResultPosition: position,
          maxResults,
          major: 0,
          minor: 0,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
        },
      });
      const response = await this.request("/ISAPI/AccessControl/AcsEvent?format=json", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body,
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw new Error(`Attendance event query failed with HTTP ${response.status}: ${detail}`);
      }
      const payload = await response.json();
      const batch = eventList(payload);
      for (const raw of batch) {
        const event = normalizeHikvisionEvent(raw, this.deviceSerial);
        if (event) results.push(event);
      }
      const reported = Number(payload?.AcsEvent?.numOfMatches ?? batch.length);
      const total = Number(payload?.AcsEvent?.totalMatches ?? position + reported);
      if (reported < maxResults || position + reported >= total) break;
    }
    return results.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  }
}
