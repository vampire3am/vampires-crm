import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync(new URL("../src/services/staffAdminService.ts", import.meta.url), "utf8");

assert.match(service, /supabase\.auth\.getSession\(\)/);
assert.match(service, /Authorization: `Bearer \$\{token\}`/);
assert.match(service, /supabase\.auth\.refreshSession\(\)/);
assert.match(service, /details\?\.error === "Unauthorized"/);

console.log("Staff administrator session checks passed");