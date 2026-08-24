import assert from"node:assert/strict";import{readFileSync}from"node:fs";
const sql=readFileSync("supabase/migrations/202608200015_phase5_classes_examinations.sql","utf8"),classes=readFileSync("src/services/classStudentService.ts","utf8"),mocks=readFileSync("src/services/mockTestService.ts","utf8");
for(const item of["class_students","attendance_sessions","attendance_records","mock_test_slots","mock_test_results","create_class_student","create_test_batch","mark_class_attendance","create_mock_result","attendance.manage"])assert.ok(sql.includes(item),`Missing Phase 5 contract: ${item}`);
assert.ok(!classes.includes("localStorage"));assert.ok(!mocks.includes("localStorage"));assert.ok(classes.includes('rpc("mark_class_attendance"'));assert.ok(mocks.includes('rpc("create_mock_result"'));
console.log("Phase 5 classes and examinations contract: PASS");
