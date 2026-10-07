import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import { HikvisionClient } from "../bridge/hikvision-attendance/hikvision-client.mjs";
import { supabaseServiceHeaders } from "../bridge/hikvision-attendance/supabase-sink.mjs";

let server;
let port;
let authenticatedRequests = 0;

before(async () => {
  server = http.createServer((request, response) => {
    if (!request.headers.authorization) {
      response.writeHead(401, { "WWW-Authenticate": 'Digest realm="AECS", nonce="runtime-test", qop="auth"' });
      response.end();
      return;
    }
    assert.match(request.headers.authorization, /^Digest /);
    authenticatedRequests += 1;
    response.setHeader("Content-Type", "application/json");
    if (request.url.startsWith("/ISAPI/System/deviceInfo")) {
      response.end(JSON.stringify({ DeviceInfo: { model: "DS-K1A8503EF-B", serialNumber: "GR6140877" } }));
      return;
    }
    response.end(JSON.stringify({ AcsEvent: { numOfMatches: 2, totalMatches: 2, InfoList: [
      { employeeNoString: "2", time: "2026-10-04T17:30:00", serialNo: 202 },
      { employeeNoString: "2", time: "2026-10-04T08:30:00", serialNo: 201 },
    ] } }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;
});

after(async () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

test("Hikvision client negotiates Digest auth and reads ordered punch events", async () => {
  const client = new HikvisionClient({
    deviceIp: "127.0.0.1",
    deviceHttpPort: port,
    deviceSerial: "GR6140877",
    deviceUsername: "admin",
    devicePassword: "test-only",
  });
  const info = await client.deviceInfo();
  assert.equal(info.DeviceInfo.model, "DS-K1A8503EF-B");
  const events = await client.searchEvents(new Date("2026-10-04T00:00:00Z"), new Date("2026-10-05T00:00:00Z"));
  assert.deepEqual(events.map(event => event.eventUid), ["201", "202"]);
  assert.equal(events[0].deviceUserId, "2");
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
