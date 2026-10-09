import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import http from "node:http";
import { after, before, test } from "node:test";
import { digestRequest, HikvisionClient } from "../bridge/hikvision-attendance/hikvision-client.mjs";
import { supabaseServiceHeaders } from "../bridge/hikvision-attendance/supabase-sink.mjs";

let server;
let port;
let authenticatedRequests = 0;

before(async () => {
  server = http.createServer((request, response) => {
    if (!request.headers.authorization) {
      response.writeHead(401, { "WWW-Authenticate": 'Digest realm="AECS", nonce="runtime-test", qop="auth", algorithm=SHA-256' });
      response.end();
      return;
    }
    assert.match(request.headers.authorization, /^Digest /);
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
    if (request.url.includes("format=json")) {
      response.writeHead(400, { "Content-Type": "application/xml" });
      response.end('<ResponseStatus><statusCode>4</statusCode><subStatusCode>badJsonFormat</subStatusCode></ResponseStatus>');
      return;
    }
    response.setHeader("Content-Type", "application/xml");
    response.end('<?xml version="1.0" encoding="UTF-8"?><AcsEvent><searchID>runtime</searchID><numOfMatches>2</numOfMatches><totalMatches>2</totalMatches><InfoList><employeeNoString>2</employeeNoString><time>2026-10-04T17:30:00</time><serialNo>202</serialNo><currentVerifyMode>fingerPrint</currentVerifyMode></InfoList><InfoList><employeeNoString>2</employeeNoString><time>2026-10-04T08:30:00</time><serialNo>201</serialNo><currentVerifyMode>fingerPrint</currentVerifyMode></InfoList></AcsEvent>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;
});

after(async () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

test("Hikvision client negotiates Digest auth and falls back to XML punch events", async () => {
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
