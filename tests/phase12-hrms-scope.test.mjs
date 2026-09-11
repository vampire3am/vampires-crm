import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const access = read("src/features/hrms/hrmsAccess.ts");
const workspace = read("src/features/hrms/HrmsWorkspace.tsx");
const shell = read("src/components/layout/AppShell.tsx");

assert.match(access, /payroll: \["payroll\.view"/);
assert.doesNotMatch(access, /payroll: \[[^\]]*hr\.self_service/);
assert.match(workspace, /canAccessHrmsTab\(tabFromUrl, hasPermission\)/);
assert.match(workspace, /setSearchParams\(\{ tab: nextTab \}, \{ replace: true \}\)/);
for (const tab of ["dashboard", "staff", "attendance", "leaves", "payroll", "performance", "documents"]) {
  assert.ok(shell.includes(`canAccessHrmsTab("${tab}", hasPermission)`), `sidebar must scope ${tab}`);
}
assert.match(shell, /hasPermission\("hr\.reports\.view"\)/);
assert.match(shell, /hasPermission\("hr\.settings\.manage"\)/);
assert.match(shell, /hasHrmsAction/);

console.log("HRMS tab scope checks passed");
