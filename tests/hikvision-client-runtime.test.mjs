import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { digestRequest, HikvisionClient } from "../bridge/hikvision-attendance/hikvision-client.mjs";
import { lateMinutesAfterCutoff, SupabaseAttendanceSink, supabaseServiceHeaders } from "../bridge/hikvision-attendance/supabase-sink.mjs";

let server;
let port;
let authenticatedRequests = 0;
let recentQueries = 0;
let clockPutBody = "";

before(async () => {
  server = http.createServer((request, response) => {
    if (!request.headers.authorization) {
      response.writeHead(401, { "WWW-Authenticate": 'Digest realm="AECS", nonce="runtime-test", qop="auth", algorithm=SHA-256' });
      response.end();
      return;
    }
    assert.match(request.headers.authorization, /^Digest /);
    assert.equal(request.headers.expect, undefined);
    const fields=Object.fromEntries([...request.headers.authorization.slice(7).matchAll(/([a-zA-Z0-9_-]+)=(?:"([^"]*)"|([^,\s]+))/g)].map(match=>[match[1],match[2]??match[3]]));
    const hash=value=>createHash("sha256").update(value).digest("hex");
    const ha1=hash(`admin:AECS:test-only`);
    const ha2=hash(`${request.method}:${fields.uri}`);
    assert.equal(fields.response,hash(`${ha1}:runtime-test:${fields.nc}:${fields.cnonce}:auth:${ha2}`));
    authenticatedRequests += 1;
    if (request.url.startsWith("/ISAPI/System/deviceInfo")) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ DeviceInfo: { model: "DS-K1A8503EF-B", serialNumber: "GR6140877" } }));
      return;
    }
    if (request.url.startsWith("/ISAPI/System/time") && request.method === "GET") {
      const shifted = new Date(Date.now() - 120_000 + 345 * 60_000).toISOString().slice(0, 19);
      response.setHeader("Content-Type", "application/xml");
      response.end(`<Time><timeMode>manual</timeMode><localTime>${shifted}+05:45</localTime></Time>`);
      return;
    }
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      if (request.url.startsWith("/ISAPI/System/time") && request.method === "PUT") {
        clockPutBody = body;
        response.setHeader("Content-Type", "application/xml");
        response.end("<ResponseStatus><statusCode>1</statusCode></ResponseStatus>");
        return;
      }
      const condition = JSON.parse(body).AcsEventCond;
      assert.equal(condition.maxResults, 10);
      assert.equal(condition.major, 5);
      assert.equal(condition.minor, 0);
      assert.match(condition.searchID, /^\d{1,16}$/);
      if (condition.startTime) {
        response.writeHead(400, { "Content-Type": "application/xml" });
        response.end('<ResponseStatus><statusCode>5</statusCode><subStatusCode>badJsonFormat</subStatusCode></ResponseStatus>');
        return;
      }
      assert.equal(condition.timeReverseOrder, true);
      response.setHeader("Content-Type", "application/json");
      recentQueries += 1;
      const InfoList = condition.searchResultPosition === 0
        ? Array.from({ length: 10 }, (_, index) => ({ employeeNoString: "2", time: `2026-10-01T08:${String(index).padStart(2, "0")}:00`, serialNo: 100 + index }))
        : [
          { employeeNoString: "2", time: "2026-10-04T17:30:00", serialNo: 202, currentVerifyMode: "fingerPrint" },
          { employeeNoString: "2", time: "2026-10-04T08:30:00", serialNo: 201, currentVerifyMode: "fingerPrint" },
        ];
      response.end(JSON.stringify({ AcsEvent: { numOfMatches: InfoList.length, totalMatches: 12, InfoList } }));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;
});

after(async () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

test("Hikvision client pages newest-first when legacy firmware rejects date fields", async () => {
  const client = new HikvisionClient({
    deviceIp: "127.0.0.1",
    deviceHttpPort: port,
    deviceSerial: "GR6140877",
    deviceUsername: "admin",
    devicePassword: "test-only",
  });
  const info = await client.deviceInfo();
  assert.equal(info.DeviceInfo.model, "DS-K1A8503EF-B");
  const clock = await client.calibrateClock();
  assert.ok(clock.driftMs >= 110_000 && clock.driftMs <= 130_000);
  await client.setClockToNepalTime();
  assert.match(clockPutBody, /<timeMode>manual<\/timeMode>/);
  assert.match(clockPutBody, /\+05:45<\/localTime>/);
  assert.match(clockPutBody, /<timeZone>NPT-5:45:00<\/timeZone>/);
  assert.equal(client.clockOffsetMs, 0);
  const events = await client.searchEvents(new Date("2026-10-04T00:00:00Z"), new Date("2026-10-06T00:00:00Z"));
  assert.deepEqual(events.map(event => event.eventUid), ["201", "202"]);
  assert.equal(events[0].deviceUserId, "2");
  assert.ok(recentQueries >= 2);
  assert.ok(authenticatedRequests >= 2);
});

test("Supabase secret keys are never sent as JWT bearer tokens", () => {
  const secretHeaders = supabaseServiceHeaders("sb_secret_test-only");
  assert.equal(secretHeaders.get("apikey"), "sb_secret_test-only");
  assert.equal(secretHeaders.get("authorization"), null);

  const legacyHeaders = supabaseServiceHeaders("eyJlegacy-service-role-test");
  assert.equal(legacyHeaders.get("apikey"), "eyJlegacy-service-role-test");
  assert.equal(legacyHeaders.get("authorization"), "Bearer eyJlegacy-service-role-test");
});

test("fixed 10:15 Nepal cutoff calculates whole late minutes", () => {
  assert.equal(lateMinutesAfterCutoff("2026-10-11T04:29:59.000Z"), 0);
  assert.equal(lateMinutesAfterCutoff("2026-10-11T04:30:00.000Z"), 0);
  assert.equal(lateMinutesAfterCutoff("2026-10-11T04:30:59.000Z"), 0);
  assert.equal(lateMinutesAfterCutoff("2026-10-11T04:31:00.000Z"), 1);
  assert.equal(lateMinutesAfterCutoff("2026-10-11T04:45:00.000Z"), 15);
});

test("bridge enforces the fixed cutoff on existing attendance rows", async () => {
  let patchedBody;
  const api = http.createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      response.setHeader("Content-Type", "application/json");
      if (request.url.startsWith("/rest/v1/hr_attendance_device_events")) {
        response.end(JSON.stringify([{ employee_id: "employee-one", attendance_date: "2026-10-11" }]));
      } else if (request.method === "GET") {
        response.end(JSON.stringify([{ id: "attendance-one", clock_in: "2026-10-11T04:39:20.000Z", clock_out: "2026-10-11T06:00:00.000Z" }]));
      } else {
        patchedBody = JSON.parse(body);
        response.writeHead(204);
        response.end();
      }
    });
  });
  await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
  try {
    const sink = new SupabaseAttendanceSink({
      supabaseUrl: `http://127.0.0.1:${api.address().port}`,
      supabaseServiceRoleKey: "sb_secret_test-only",
      deviceSerial: "GR6140877",
    });
    sink.deviceId = "device-one";
    const result = await sink.enforceAttendanceRules({ eventUid: "107" });
    assert.deepEqual(patchedBody, { status: "LATE", late_minutes: 9 });
    assert.equal(result.clockedOut, true);
  } finally {
    await new Promise((resolve, reject) => api.close(error => error ? reject(error) : resolve()));
  }
});

test("clock-corrected events survive device day-boundary leakage", async () => {
  let queryNumber = 0;
  const boundaryServer = http.createServer((request, response) => {
    if (!request.headers.authorization) {
      response.writeHead(401, { "WWW-Authenticate": 'Digest realm="AECS", nonce="boundary-test", qop="auth", algorithm=MD5' });
      response.end();
      return;
    }
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      queryNumber += 1;
      const condition = JSON.parse(body).AcsEventCond;
      const InfoList = queryNumber === 1 ? [
        { employeeNoString: "9", time: "2026-10-11T09:57:49+08:00", serialNo: 107 },
      ] : [];
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ AcsEvent: { numOfMatches: InfoList.length, totalMatches: InfoList.length, InfoList, searchID: condition.searchID } }));
    });
  });
  await new Promise(resolve => boundaryServer.listen(0, "127.0.0.1", resolve));
  try {
    const client = new HikvisionClient({
      deviceIp: "127.0.0.1", deviceHttpPort: boundaryServer.address().port, deviceSerial: "GR6140877",
      deviceUsername: "admin", devicePassword: "test-only",
    });
    client.clockOffsetMs = 8_103_000;
    const events = await client.searchEvents(new Date("2026-10-10T04:03:07.074Z"), new Date("2026-10-11T06:04:07.074Z"));
    assert.deepEqual(events.map(event => event.eventUid), ["107"]);
    assert.equal(events[0].deviceUserId, "9");
    assert.ok(queryNumber >= 2);
  } finally {
    await new Promise((resolve, reject) => boundaryServer.close(error => error ? reject(error) : resolve()));
  }
});

test("clock reconciliation replaces only the matching device event before re-ingestion", async () => {
  const requests = [];
  const api = http.createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      requests.push({ method: request.method, url: request.url, body });
      response.setHeader("Content-Type", "application/json");
      if (request.method === "GET") response.end(JSON.stringify([{ id: "old-event", occurred_at: "2026-10-11T01:57:00.000Z" }]));
      else if (request.method === "DELETE") { response.writeHead(204); response.end(); }
      else response.end(JSON.stringify({ status: "PROCESSED" }));
    });
  });
  await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
  try {
    const sink = new SupabaseAttendanceSink({
      supabaseUrl: `http://127.0.0.1:${api.address().port}`,
      supabaseServiceRoleKey: "sb_secret_test-only",
      deviceSerial: "GR6140877",
    });
    sink.deviceId = "device-one";
    const result = await sink.replaceClockCorrectedEvent({
      eventUid: "501", deviceUserId: "4", occurredAt: "2026-10-11T03:17:00.000Z",
      eventKind: "FINGERPRINT", authenticationMode: "fingerPrint", attendanceStatus: null, raw: {},
    });
    assert.equal(result.status, "PROCESSED");
    assert.deepEqual(requests.map(item => item.method), ["GET", "DELETE", "POST"]);
    assert.match(requests[0].url, /device_id=eq\.device-one&event_uid=eq\.501/);
    assert.match(requests[1].url, /id=eq\.old-event/);
  } finally {
    await new Promise((resolve, reject) => api.close(error => error ? reject(error) : resolve()));
  }
});

test("Windows native Digest transport preserves attendance POST bodies", { skip: process.platform !== "win32" }, async () => {
  const nativeServer = http.createServer((request, response) => {
    if (!request.headers.authorization) {
      response.writeHead(401, { "WWW-Authenticate": 'Digest realm="AECS", nonce="native-test", qop="auth", algorithm=MD5' });
      response.end();
      return;
    }
    assert.match(request.headers.authorization, /^Digest /);
    assert.equal(request.headers.expect, undefined);
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      const condition = JSON.parse(body).AcsEventCond;
      assert.equal(condition.maxResults, 10);
      assert.equal(condition.major, 5);
      assert.doesNotMatch(condition.startTime, /(?:Z|[+-]\d{2}:\d{2})$/);
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ AcsEvent: { numOfMatches: 1, totalMatches: 1, InfoList: [
        { employeeNoString: "2", time: "2026-10-04T13:45:00", serialNo: 201 },
      ] } }));
    });
  });
  await new Promise(resolve => nativeServer.listen(0, "127.0.0.1", resolve));
  const nativePort = nativeServer.address().port;
  const directory = await mkdtemp(join(tmpdir(), "aecs-hikvision-test-"));
  const configPath = join(directory, "bridge.config.json");
  await writeFile(configPath, JSON.stringify({
    deviceIp: "127.0.0.1", deviceHttpPort: nativePort, deviceSerial: "GR6140877",
    deviceUsername: "admin", devicePassword: "test-only",
  }));
  try {
    const client = new HikvisionClient({
      deviceIp: "127.0.0.1", deviceHttpPort: nativePort, deviceSerial: "GR6140877",
      deviceUsername: "admin", devicePassword: "test-only", configPath,
    });
    const events = await client.searchEvents(new Date("2026-10-04T08:00:00Z"), new Date("2026-10-04T09:00:00Z"));
    assert.deepEqual(events.map(event => event.eventUid), ["201"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await new Promise((resolve, reject) => nativeServer.close(error => error ? reject(error) : resolve()));
  }
});

test("Hikvision client falls back to compatibility auth when advertised Digest is rejected", async () => {
  const fallbackServer=http.createServer((request,response)=>{
    if(request.headers.authorization===`Basic ${Buffer.from("admin:test-only").toString("base64")}`){response.end("ok");return}
    response.writeHead(401,{"WWW-Authenticate":'Digest realm="AECS", nonce="compatibility-test", qop="auth", algorithm=MD5'});
    response.end();
  });
  await new Promise(resolve=>fallbackServer.listen(0,"127.0.0.1",resolve));
  try{
    const fallbackPort=fallbackServer.address().port;
    const response=await digestRequest({baseUrl:`http://127.0.0.1:${fallbackPort}`,username:"admin",password:"test-only"},"/ISAPI/System/deviceInfo");
    assert.equal(response.status,200);
    assert.equal(await response.text(),"ok");
  }finally{
    await new Promise((resolve,reject)=>fallbackServer.close(error=>error?reject(error):resolve()));
  }
});
