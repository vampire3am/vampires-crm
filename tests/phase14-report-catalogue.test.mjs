import fs from "node:fs";
import assert from "node:assert/strict";

const catalog=fs.readFileSync("src/features/analytics/reportCatalogue.ts","utf8");
const workspace=fs.readFileSync("src/features/analytics/AnalyticsDashboard.tsx","utf8");
const service=fs.readFileSync("src/services/analyticsReportService.ts","utf8");
const migration=fs.readFileSync("supabase/migrations/202609160001_unified_report_audit.sql","utf8");

const ids=[...catalog.matchAll(/category\((\d+),/g)].map(match=>Number(match[1]));
assert.deepEqual(ids,[...Array.from({length:25},(_,i)=>i+1),...Array.from({length:15},(_,i)=>i+37),52,53,54,55]);
assert.equal(ids.some(id=>id>=26&&id<=36),false,"Dedicated HRMS report categories must not be duplicated");
for(const expected of ["Lead Aging","Visa Success Rate","Student Training History","Marketing ROI","Receivable Aging","Profit & Loss Statement","Cash Flow Statement","Audit Trail","Report Builder","Scheduled Reports","Report Favorites"])assert.ok(catalog.includes(expected),`Missing ${expected}`);
for(const capability of ["dateFrom","dateTo","country","status","Columns3","Export","Print / PDF","Favourite","Save"])assert.ok(workspace.includes(capability),`Missing shared report capability ${capability}`);
assert.ok(service.includes("categorySources"));
assert.ok(service.includes("sourcesForReport"));
assert.ok(service.includes("specializeRows"));
assert.ok(service.includes("rate_percent"));
assert.ok(service.includes("age_days"));
assert.ok(service.includes("log_report_activity"));
assert.ok(migration.includes("REPORT_"));
console.log("Phase 14 unified report catalogue checks passed.");
