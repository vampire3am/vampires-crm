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
const rfidMigration = read("supabase/migrations/202610110001_rfid_card_mapping.sql");

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
assert.match(workspace, /RFID Card Number/);
assert.match(service, /attendance_rfid_card_no/);
assert.match(rfidMigration, /add column if not exists attendance_rfid_card_no text/);
assert.match(rfidMigration, /hr_employees_attendance_rfid_card_unique/);
assert.match(rfidMigration, /\^\[0-9\]\{1,20\}\$/);
assert.match(rfidMigration, /attendance_rfid_card_no=case/);
assert.match(rfidMigration, /where attendance_rfid_card_no=trim\(p_device_user_id\)/);
assert.match(workspace, /Biometric attendance bridge/);
assert.match(workspace, /Unmapped punches/);
assert.match(service, /getAttendanceDevices/);
assert.match(service, /getUnmappedDeviceEvents/);
assert.match(permissions, /attendance\.mapping\.manage/);

assert.match(bridge, /overlapMinutes/);
assert.match(bridge, /initialLookbackDays/);
assert.match(bridge, /reconciliationHours/);
assert.match(bridge, /prepareTerminalClock/);
assert.match(bridge, /repairTerminalClock/);
assert.match(bridge, /replaceClockCorrectedEvent/);
assert.match(bridge, /enforceAttendanceRules/);
assert.match(bridge, /replace\(\/\^\\uFEFF\//);
assert.match(bridge, /Terminal connection succeeded/);
assert.match(bridge, /configPath/);
assert.match(installer, /hikvision-request\.ps1/);
assert.match(installer, /Get-Credential -UserName "admin"/);
assert.doesNotMatch(installer, /Tee-Object -FilePath \$stdout/);
assert.match(read("bridge/hikvision-attendance/hikvision-request.ps1"), /HttpClientHandler/);
assert.match(read("bridge/hikvision-attendance/hikvision-client.mjs"), /administrator username or password \(HTTP 401\)/);
assert.match(read("src/services/hrmsService.ts"), /throwRpcError\(error,"Employee record could not be saved"\)/);
assert.match(read("src/features/hrms/HrmsWorkspace.tsx"), /Device user number already assigned/);
assert.match(installer, /-RestartCount 999/);
assert.match(installer, /Supervised background bridge verified/);
assert.match(installer, /run-hikvision-bridge\.ps1/);
assert.match(workspace, /PUNCHED OUT/);
assert.match(workspace, /3_000/);
assert.match(bridge, /Math\.max\(3, Number\(config\.pollSeconds \?\? 3\)\)/);
assert.match(installer, /pollSeconds = 3/);
assert.match(installer, /UTF8Encoding\(\$false\)/);
assert.match(installer, /icacls/);
assert.match(installer, /project URL was entered where the secret key is required/);
assert.match(installer, /\^\(sb_secret_\|eyJ\)/);

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
const card = normalizeHikvisionEvent({ cardNo: "9876543210", time: "2026-10-04T08:16:00", serialNo: 57, currentVerifyMode: "card" }, "GR6140877");
assert.equal(card.deviceUserId, "9876543210");
assert.equal(card.eventKind, "RFID_CARD");
assert.equal(card.authenticationMode, "card");
assert.equal(normalizeHikvisionEvent({ employeeNoString: "4", time: "2026-10-04T08:15:00", serialNo: 56 }, "GR6140877", 120_000).occurredAt, "2026-10-04T02:32:00.000Z");
assert.equal(normalizeHikvisionEvent({ time: "invalid" }, "GR6140877"), null);

console.log("phase21 Hikvision attendance checks passed");
