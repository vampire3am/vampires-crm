import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [auth, login, routes, identityMigration, permissionMigration, staffMigration, staffFunction, staffService] = await Promise.all([
  read("src/features/auth/AuthProvider.tsx"),
  read("src/pages/Login.tsx"),
  read("src/app/App.tsx"),
  read("supabase/migrations/202608200009_phase1_secure_identity.sql"),
  read("supabase/migrations/202608200010_phase1_permission_matrix.sql"),
  read("supabase/migrations/202608210023_staff_provisioning.sql"),
  read("supabase/functions/invite-staff/index.ts"),
  read("src/services/staffAdminService.ts"),
]);

assert.doesNotMatch(auth, /VALID_PASSWORDS|aecs_staff_session|aecs_staff_profile/);
assert.match(auth, /signInWithPassword/);
assert.match(auth, /data\?\.is_active/);
assert.match(auth, /update_my_staff_profile/);

assert.doesNotMatch(login, /Default:\s*aecs2026|defaultPass/);
assert.match(login, /disabled=\{busy \|\| !isSupabaseConfigured\}/);

assert.match(routes, /permission="messages"/);
assert.match(routes, /permission="settings" workspaceName="Email Automation"/);
assert.match(routes, /path="\/students\/:id"/);
assert.match(routes, /path="\/class-enquiries\/:id"/);
assert.doesNotMatch(routes, /path="\*" element=\{<Navigate to="\/dashboard"/);

assert.match(identityMigration, /create or replace function public\.has_permission/);
assert.match(identityMigration, /revoke all on function public\.update_my_staff_profile/);
assert.match(permissionMigration, /permitted_staff_read_students/);
assert.match(permissionMigration, /public\.has_permission\('students\.create'\)/);
assert.match(staffMigration, /desktop_modules text\[\]/);
assert.match(staffMigration, /assigned_responsibilities/);
assert.match(staffFunction, /auth\.admin\.createUser/);
assert.match(staffFunction, /auth\.admin\.updateUserById/);
assert.match(staffFunction, /STAFF_PASSWORD_UPDATED/);
assert.match(staffService, /functions\.invoke\("invite-staff"/);

console.log("Phase 1 security contract: PASS");
