import { createHash, randomBytes } from "node:crypto";

const md5 = value => createHash("md5").update(value).digest("hex");

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
  const ha1 = md5(`${username}:${challenge.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = qop
    ? md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${challenge.nonce}:${ha2}`);
  const fields = [
    `username="${username}"`, `realm="${challenge.realm}"`, `nonce="${challenge.nonce}"`,
    `uri="${uri}"`, `response="${response}"`, `algorithm=${challenge.algorithm || "MD5"}`,
  ];
  if (challenge.opaque) fields.push(`opaque="${challenge.opaque}"`);
  if (qop) fields.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Digest ${fields.join(", ")}`);
  return fetch(url, { ...options, method, headers, redirect: "manual" });
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
    this.deviceSerial = config.deviceSerial;
  }

  async deviceInfo() {
    const response = await digestRequest(this.auth, "/ISAPI/System/deviceInfo?format=json", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Device information request failed with HTTP ${response.status}.`);
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
      const response = await digestRequest(this.auth, "/ISAPI/AccessControl/AcsEvent?format=json", {
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
