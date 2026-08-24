create type public.document_status as enum ('UPLOADED','UNDER_REVIEW','APPROVED','REJECTED','EXPIRED');
create type public.application_status as enum ('COUNSELLING_COMPLETED','UNIVERSITY_SHORTLISTED','APPLICATION_PREPARED','SUBMITTED','OFFER_RECEIVED','OFFER_ACCEPTED','CAS_COE_RECEIVED','VISA_SUBMITTED','VISA_APPROVED','COMPLETED');
create type public.visa_status as enum ('NOT_STARTED','PREPARING','SUBMITTED','APPROVED','REJECTED');

create table public.documents(id uuid primary key default gen_random_uuid(),student_id uuid not null references students(id) on delete cascade,document_name text not null,document_type text not null check(document_type in ('Academic Documents','Passport','English Test Result','Financial Documents','Application Documents','Visa Documents','Other')),storage_path text not null unique,file_size bigint not null check(file_size>0 and file_size<=20971520),mime_type text not null,uploaded_by uuid not null references staff_profiles(id),status document_status not null default 'UPLOADED',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index documents_student_idx on documents(student_id,created_at desc);
create table public.document_activity(id bigint generated always as identity primary key,document_id uuid not null references documents(id) on delete cascade,action text not null,performed_by uuid not null references staff_profiles(id),created_at timestamptz not null default now());
create table public.document_checklists(id uuid primary key default gen_random_uuid(),country text not null,document_type text not null,required boolean not null default true,sort_order integer not null default 0,unique(country,document_type));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('student-documents','student-documents',false,20971520,array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy staff_documents_read on storage.objects for select to authenticated using(bucket_id='student-documents' and public.is_active_staff());
create policy staff_documents_insert on storage.objects for insert to authenticated with check(bucket_id='student-documents' and public.is_active_staff());
create policy manager_documents_delete on storage.objects for delete to authenticated using(bucket_id='student-documents' and public.is_manager());

create table public.applications(id uuid primary key default gen_random_uuid(),student_id uuid not null references students(id) on delete cascade,country text not null,university text not null,course text not null,intake text not null,application_status application_status not null default 'COUNSELLING_COMPLETED',created_by uuid not null references staff_profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index applications_status_idx on applications(application_status,updated_at desc);create index applications_student_idx on applications(student_id);
create table public.application_activity(id bigint generated always as identity primary key,application_id uuid not null references applications(id) on delete cascade,status application_status not null,remarks text,performed_by uuid not null references staff_profiles(id),created_at timestamptz not null default now());
create table public.visa_tracking(id uuid primary key default gen_random_uuid(),student_id uuid not null unique references students(id) on delete cascade,visa_status visa_status not null default 'NOT_STARTED',submitted_date date,decision_date date,remarks text,updated_by uuid not null references staff_profiles(id),updated_at timestamptz not null default now());

create table public.permissions(id bigint generated always as identity primary key,role staff_role not null,permission_name text not null,enabled boolean not null default false,unique(role,permission_name));
create table public.system_settings(id bigint generated always as identity primary key,setting_name text not null unique,setting_value jsonb not null,updated_by uuid references staff_profiles(id),updated_at timestamptz not null default now());
create table public.audit_logs(id bigint generated always as identity primary key,user_id uuid references staff_profiles(id),action text not null,module text not null,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create index audit_logs_created_idx on audit_logs(created_at desc);

insert into permissions(role,permission_name,enabled) select r,p,true from unnest(array['ADMIN','DIRECTOR']::staff_role[]) r cross join unnest(array['students.view','students.edit','students.delete','documents.manage','applications.manage','counselling.manage','admin.manage']) p on conflict do nothing;
insert into permissions(role,permission_name,enabled) values('FRONT_DESK','students.view',true),('FRONT_DESK','students.edit',true),('COUNSELLOR','students.view',true),('COUNSELLOR','counselling.manage',true),('DOCUMENTATION','students.view',true),('DOCUMENTATION','documents.manage',true) on conflict do nothing;
insert into system_settings(setting_name,setting_value) values('countries','["UK","Australia","Canada","USA","Japan","Korea"]'),('lead_sources','["Walk-in","Referral","Facebook","Instagram","Website","Education fair","Other"]'),('intakes','["January","May","September"]') on conflict do nothing;

do $$ declare t text; begin foreach t in array array['documents','document_activity','document_checklists','applications','application_activity','visa_tracking','permissions','system_settings','audit_logs'] loop execute format('alter table public.%I enable row level security',t); execute format('create policy active_staff_read_%I on public.%I for select using (public.is_active_staff())',t,t); end loop; end $$;
create policy documentation_write_documents on documents for all using(public.is_manager() or exists(select 1 from staff_profiles where id=auth.uid() and role='DOCUMENTATION' and is_active)) with check(public.is_active_staff());
create policy documentation_write_activity on document_activity for insert with check(public.is_active_staff() and performed_by=auth.uid());
create policy staff_write_applications on applications for all using(public.is_active_staff()) with check(public.is_active_staff());
create policy staff_write_application_activity on application_activity for insert with check(public.is_active_staff() and performed_by=auth.uid());
create policy staff_write_visa on visa_tracking for all using(public.is_active_staff()) with check(public.is_active_staff());
create policy manager_permissions on permissions for all using(public.is_manager()) with check(public.is_manager());
create policy manager_settings on system_settings for all using(public.is_manager()) with check(public.is_manager());
create policy manager_audit on audit_logs for insert with check(public.is_active_staff() and user_id=auth.uid());

create trigger touch_documents before update on documents for each row execute function touch_updated_at();create trigger touch_applications before update on applications for each row execute function touch_updated_at();

create or replace function public.audit_application() returns trigger language plpgsql security definer set search_path=public as $$ begin if tg_op='INSERT' or old.application_status is distinct from new.application_status then insert into application_activity(application_id,status,performed_by) values(new.id,new.application_status,auth.uid()); insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),case when tg_op='INSERT' then 'APPLICATION_CREATED' else 'APPLICATION_STATUS_CHANGED' end,'applications',jsonb_build_object('application_id',new.id,'status',new.application_status)); end if; return new; end $$;
create trigger audit_application_change after insert or update on applications for each row execute function audit_application();
