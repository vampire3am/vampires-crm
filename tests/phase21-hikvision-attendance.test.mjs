import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeHikvisionEvent } from "../bridge/hikvision-attendance/hikvision-client.mjs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/202610040001_hikvision_attendance_bridge.sql");
const workspace = read("src/features/hrms/HrmsWorkspace.tsx");
const service = read("src/services/hrmsService.ts");
const permissions = read("src/features/admin/staffPermissionCatalog.ts");
const bridge = read("bridge/hikvision-attendance/index.mjs");
const installer = read("bridge/hikvision-attendance/install-hikvision-bridge.ps1");

assert.match(migration, /hr_attendance_device_events/);
assert.match(migration, /unique\(device_id,event_uid\)/);
assert.match(migration, /interval '30 seconds'/);
assert.match(migration, /min\(occurred_at\),max\(occurred_at\)/);
assert.match(migration, /case when v_punch_count>1 then v_last_punch else null end/);
assert.match(migration, /v_late_minutes/);
assert.match(migration, /where public\.hr_attendance\.source<>'MANUAL'/);
assert.match(migration, /at time zone 'Asia\/Kathmandu'/);
assert.match(migration, /to service_role/);
assert.match(migration, /attendance\.device\.events\.view/);
assert.match(migration, /true,'IP','192\.168\.100\.84','4\.0',7660,'aecs'/);

assert.match(workspace, /Device User Number/);
assert.match(workspace, /Biometric attendance bridge/);
assert.match(workspace, /Unmapped punches/);
assert.match(service, /getAttendanceDevices/);
assert.match(service, /getUnmappedDeviceEvents/);
assert.match(permissions, /attendance\.mapping\.manage/);

assert.match(bridge, /overlapMinutes/);
assert.match(bridge, /initialLookbackDays/);
assert.match(installer, /-RestartCount 999/);
assert.match(installer, /icacls/);

const normalized = normalizeHikvisionEvent({
  employeeNoString: "4",
  time: "2026-10-04T08:15:00",
  serialNo: 55,
  currentVerifyMode: "fingerPrint",
}, "GR6140877");
assert.equal(normalized.deviceUserId, "4");
assert.equal(normalized.eventUid, "55");
assert.equal(normalized.occurredAt, "2026-10-04T02:30:00.000Z");
assert.equal(normalized.authenticationMode, "fingerPrint");
assert.equal(normalizeHikvisionEvent({ time: "invalid" }, "GR6140877"), null);

console.log("phase21 Hikvision attendance checks passed");
