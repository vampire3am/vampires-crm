alter table public.documents alter column student_id drop not null;
alter table public.documents add column if not exists b2b_partner_id text references public.b2b_partners(id) on delete restrict;
alter table public.documents drop constraint if exists documents_document_type_check;
alter table public.documents add constraint documents_document_type_check check(document_type in ('Academic Documents','Passport','English Test Result','Financial Documents','Application Documents','Visa Documents','B2B Agreement','Other'));
alter table public.documents add constraint documents_owner_check check((student_id is not null)::integer+(b2b_partner_id is not null)::integer=1) not valid;
create index if not exists documents_b2b_partner_idx on public.documents(b2b_partner_id,created_at desc) where b2b_partner_id is not null;

create or replace function public.register_b2b_document(payload jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare pid text; did uuid; next_version integer; prior uuid;
begin
 if not public.has_permission('documents.upload') then raise exception 'Insufficient permission to upload documents'; end if;
 select id into pid from public.b2b_partners where id=payload->>'partner_id';
 if pid is null then raise exception 'B2B partner not found'; end if;
 if (payload->>'file_size')::bigint>1048576 then raise exception 'Each document must be 1 MB or smaller'; end if;
 select id,version into prior,next_version from public.documents where b2b_partner_id=pid and document_type='B2B Agreement' order by version desc limit 1;
 next_version:=coalesce(next_version,0)+1;
 insert into public.documents(b2b_partner_id,document_name,document_type,storage_path,file_size,mime_type,uploaded_by,status,version,expires_on,notes,replaced_document_id)
 values(pid,trim(payload->>'document_name'),'B2B Agreement',payload->>'storage_path',(payload->>'file_size')::bigint,payload->>'mime_type',auth.uid(),'UNDER_REVIEW',next_version,nullif(payload->>'expires_on','')::date,nullif(trim(payload->>'notes'),''),prior)
 returning id into did;
 insert into public.document_activity(document_id,action,performed_by) values(did,'B2B_AGREEMENT_UPLOADED_VERSION_'||next_version,auth.uid());
 return did;
end$$;

revoke all on function public.register_b2b_document(jsonb) from public;
grant execute on function public.register_b2b_document(jsonb) to authenticated;
