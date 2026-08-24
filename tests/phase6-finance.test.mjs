import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608210016_phase6_finance_accounting.sql", "utf8");
const service = readFileSync("src/services/financeService.ts", "utf8");

for (const table of [
  "finance_quotations",
  "finance_invoices",
  "finance_receipts",
  "finance_journals",
  "finance_journal_lines",
  "finance_refunds",
  "finance_expenses",
  "university_commissions",
]) {
  assert.match(migration, new RegExp(`create table public\\.${table}\\b`), `${table} must be created`);
  assert.match(migration, new RegExp(`alter table public\\.%I enable row level security`), "finance tables must use RLS");
}

assert.match(migration, /enforce_balanced_journal/, "journals need a balance guard");
assert.match(migration, /d<>c or d=0/, "unbalanced and empty journals must be rejected");
assert.match(migration, /has_permission\('finance\.create'\)/, "write RPCs must enforce finance permissions");
assert.match(migration, /create or replace function public\.issue_student_invoice/, "invoice RPC must exist");
assert.match(migration, /create or replace function public\.create_commission/, "commission RPC must exist");
assert.match(migration, /Receipt cannot exceed invoice total/, "overpayments must be rejected");
assert.match(service, /supabase\.rpc\("issue_student_invoice"/, "invoice UI must use the controlled RPC");
assert.match(service, /supabase\.rpc\("create_commission"/, "commission UI must use the controlled RPC");
assert.doesNotMatch(service, /localStorage/, "finance records must not be stored in the browser");

console.log("Phase 6 finance/accounting checks passed.");
