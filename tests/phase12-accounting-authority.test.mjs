import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const migration=read("supabase/migrations/202608300006_finance_journals_admin_messages.sql");
const workspace=read("src/features/finance/FinanceWorkspace.tsx");
const service=read("src/services/financeService.ts");
const auth=read("src/features/auth/AuthProvider.tsx");

for(const permission of ["rbac.manage","communications.use","finance.create"])assert.ok(migration.includes(permission),`missing ADMIN permission ${permission}`);
assert.ok(migration.includes("post_manual_journal"),"manual journal RPC missing");
assert.ok(migration.includes("Journal is not balanced"),"server-side balance validation missing");
assert.ok(migration.includes("'1131','Student fee receivable'"),"invoice receivable accrual missing");
assert.ok(migration.includes("'1125'")&&migration.includes("'1126'")&&migration.includes("'1121'"),"payment asset mappings are incomplete");
assert.ok(workspace.includes("New Journal Entry")&&workspace.includes("postingAccounts"),"COA journal interface missing");
assert.ok(workspace.includes("value={form.studentCode}"),"invoice selector does not bind the real student code");
assert.ok(service.includes('rpc("post_manual_journal"'),"finance service does not post journals");
assert.ok(auth.includes('"messages", "assignments"'),"ADMIN fallback message access missing");
console.log("Phase 12 accounting authority checks passed");
