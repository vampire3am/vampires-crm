import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql=readFileSync("supabase/migrations/202608200014_phase4_document_vault.sql","utf8");
const service=readFileSync("src/services/documentService.ts","utf8");
for(const item of ["version integer","expires_on date","verified_by uuid","replaced_document_id","register_document","review_document","permitted_documents_read","permitted_documents_upload","documents.verify"])assert.ok(sql.includes(item),`Missing Phase 4 contract: ${item}`);
assert.ok(service.includes('.storage.from("student-documents")'),"Documents must use the private storage bucket");
assert.ok(service.includes("createSignedUrl"),"Preview and downloads must use expiring signed URLs");
assert.ok(!service.includes("localStorage"),"Document records must not use browser storage");
console.log("Phase 4 document vault contract: PASS");
