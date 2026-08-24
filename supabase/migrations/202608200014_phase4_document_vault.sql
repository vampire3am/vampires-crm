-- Phase 4: private versioned document vault, verification, expiry and audit.
alter table public.documents add column if not exists version integer not null default 1 check(version>0);
alter table public.documents add column if not exists expires_on date;
alter table public.documents add column if not exists notes text check(notes is null or char_length(notes)<=3000);
alter table public.documents add column if not exists verified_by uuid references public.staff_profiles(id);
alter table public.documents add column if not exists verified_at timestamptz;
alter table public.documents add column if not exists replaced_document_id uuid references public.documents(id);
create index if not exists documents_expiry_idx on public.documents(expires_on) where expires_on is not null;

insert into public.permissions(role,permission_name,enabled)
select role,permission_name,true from (values('ADMIN'::public.staff_role),('DIRECTOR'),('DOCUMENTATION'),('VISA_OFFICER')) r(role)
cross join (values('documents.view'),('documents.upload'),('documents.verify')) p(permission_name)
on conflict(role,permission_name) do update set enabled=excluded.enabled;
insert into public.permissions(role,permission_name,enabled)
select role,'documents.view',true from (values('SENIOR_COUNSELLOR'::public.staff_role),('COUNSELLOR'),('FRONT_DESK')) r(role)
on conflict(role,permission_name) do update set enabled=excluded.enabled;
insert into public.permissions(role,permission_name,enabled) values('ADMIN','documents.delete',true),('DIRECTOR','documents.delete',true)
on conflict(role,permission_name) do update set enabled=excluded.enabled;

drop policy if exists active_staff_read_documents on public.documents;
drop policy if exists documentation_write_documents on public.documents;
drop policy if exists active_staff_read_document_activity on public.document_activity;
drop policy if exists documentation_write_activity on public.document_activity;
create policy documents_read on public.documents for select to authenticated using(public.has_permission('documents.view'));
create policy document_activity_read on public.document_activity for select to authenticated using(public.has_permission('documents.view'));
drop policy if exists staff_documents_read on storage.objects;
drop policy if exists staff_documents_insert on storage.objects;
drop policy if exists manager_documents_delete on storage.objects;
create policy permitted_documents_read on storage.objects for select to authenticated using(bucket_id='student-documents' and public.has_permission('documents.view'));
create policy permitted_documents_upload on storage.objects for insert to authenticated with check(bucket_id='student-documents' and public.has_permission('documents.upload') and (storage.foldername(name))[1]=auth.uid()::text);
create policy permitted_documents_delete on storage.objects for delete to authenticated using(bucket_id='student-documents' and public.has_permission('documents.delete'));

create or replace function public.register_document(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid; did uuid; next_version integer; prior uuid;
begin
 if not public.has_permission('documents.upload') then raise exception 'Insufficient permission to upload documents'; end if;
 select id into sid from students where student_code=trim(payload->>'student_code'); if sid is null then raise exception 'Student code not found'; end if;
 select id,version into prior,next_version from documents where student_id=sid and document_type=payload->>'document_type' order by version desc limit 1;
 next_version:=coalesce(next_version,0)+1;
 insert into documents(student_id,document_name,document_type,storage_path,file_size,mime_type,uploaded_by,status,version,expires_on,notes,replaced_document_id)
 values(sid,trim(payload->>'document_name'),payload->>'document_type',payload->>'storage_path',(payload->>'file_size')::bigint,payload->>'mime_type',auth.uid(),'UNDER_REVIEW',next_version,nullif(payload->>'expires_on','')::date,nullif(trim(payload->>'notes'),''),prior) returning id into did;
 insert into document_activity(document_id,action,performed_by) values(did,'UPLOADED_VERSION_'||next_version,auth.uid()); return did;
end $$;

create or replace function public.review_document(document_uuid uuid,next_status public.document_status,review_note text default null) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_permission('documents.verify') then raise exception 'Insufficient permission to verify documents'; end if;
 if next_status not in ('APPROVED','REJECTED','UNDER_REVIEW','EXPIRED') then raise exception 'Invalid review status'; end if;
 update documents set status=next_status,notes=coalesce(nullif(trim(review_note),''),notes),verified_by=case when next_status='APPROVED' then auth.uid() else null end,verified_at=case when next_status='APPROVED' then now() else null end where id=document_uuid;
 if not found then raise exception 'Document not found'; end if;
 insert into document_activity(document_id,action,performed_by) values(document_uuid,'STATUS_'||next_status,auth.uid());
end $$;

revoke all on function public.register_document(jsonb),public.review_document(uuid,public.document_status,text) from public;
grant execute on function public.register_document(jsonb),public.review_document(uuid,public.document_status,text) to authenticated;
