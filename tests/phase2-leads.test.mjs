import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608200011_phase2_leads_intake.sql", "utf8");
const service = readFileSync("src/services/studentService.ts", "utf8");
const followUps = readFileSync("supabase/migrations/202608200012_phase2_follow_up_workflow.sql", "utf8");

for (const contract of [
  "create table public.leads",
  "create table public.lead_activities",
  "create table public.lead_follow_ups",
  "create or replace function public.create_lead",
  "create or replace function public.add_lead_note",
  "create or replace function public.convert_lead",
  "enable row level security",
  "Duplicate active lead",
]) assert.ok(migration.includes(contract), `Missing Phase 2 database contract: ${contract}`);

assert.ok(!service.includes("localStorage"), "Lead and student services must not fall back to browser storage");
assert.ok(service.includes('.from("leads")'), "Lead service must read the live leads table");
assert.ok(service.includes('rpc("convert_lead"'), "Lead conversion must be transactional in the database");
for (const contract of ["update_lead_stage", "schedule_lead_follow_up", "complete_lead_follow_up"])
  assert.ok(followUps.includes(contract), `Missing follow-up contract: ${contract}`);
console.log("Phase 2 leads and intake contract: PASS");
