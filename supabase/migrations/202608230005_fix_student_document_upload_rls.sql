-- Allow every active CRM staff member to maintain supporting student evidence.
-- Review and deletion remain controlled by their existing dedicated permissions.
insert into public.permissions(role, permission_name, enabled)
select role, permission_name, true
from unnest(enum_range(null::public.staff_role)) role
cross join (values ('documents.view'), ('documents.upload')) rights(permission_name)
on conflict (role, permission_name) do update set enabled = true;

drop policy if exists permitted_documents_upload on storage.objects;
create policy permitted_documents_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'student-documents'
  and public.is_active_staff()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.register_document(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  did uuid;
  next_version integer;
  prior uuid;
begin
  if not public.is_active_staff() then
    raise exception 'Only active staff can upload student documents';
  end if;

  select id into sid
  from students
  where student_code = trim(payload->>'student_code');

  if sid is null then
    raise exception 'Student code not found';
  end if;

  select id, version into prior, next_version
  from documents
  where student_id = sid
    and document_type = payload->>'document_type'
  order by version desc
  limit 1;

  next_version := coalesce(next_version, 0) + 1;

  insert into documents (
    student_id, document_name, document_type, storage_path, file_size,
    mime_type, uploaded_by, status, version, expires_on, notes,
    replaced_document_id
  ) values (
    sid, trim(payload->>'document_name'), payload->>'document_type',
    payload->>'storage_path', (payload->>'file_size')::bigint,
    payload->>'mime_type', auth.uid(), 'UNDER_REVIEW', next_version,
    nullif(payload->>'expires_on', '')::date,
    nullif(trim(payload->>'notes'), ''), prior
  ) returning id into did;

  insert into document_activity(document_id, action, performed_by)
  values (did, 'UPLOADED_VERSION_' || next_version, auth.uid());

  return did;
end
$$;

revoke all on function public.register_document(jsonb) from public;
grant execute on function public.register_document(jsonb) to authenticated;
