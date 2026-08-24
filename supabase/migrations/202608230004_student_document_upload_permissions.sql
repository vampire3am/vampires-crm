-- Staff who are trusted to edit student records must also be able to attach
-- the supporting evidence used by those records. Verification and deletion
-- remain restricted to document/visa management roles.
insert into public.permissions(role,permission_name,enabled)
select distinct role, permission_name, true
from public.permissions
cross join (values ('documents.view'),('documents.upload')) rights(permission_name)
where public.permissions.permission_name='students.edit'
  and public.permissions.enabled=true
on conflict(role,permission_name) do update set enabled=true;

drop policy if exists permitted_documents_upload on storage.objects;
create policy permitted_documents_upload
on storage.objects for insert to authenticated
with check (
  bucket_id='student-documents'
  and public.has_permission('documents.upload')
  and (storage.foldername(name))[1]=auth.uid()::text
);
