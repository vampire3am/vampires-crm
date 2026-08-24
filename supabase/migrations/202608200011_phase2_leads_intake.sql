-- Phase 2: durable lead intake, ownership, follow-ups, history and conversion.
create type public.lead_stage as enum (
  'NEW_INQUIRY', 'CONTACTED', 'COUNSELLING_SCHEDULED', 'HOT_PROSPECT', 'CONVERTED', 'LOST'
);
create type public.lead_priority as enum ('HIGH', 'MEDIUM', 'LOW');

create sequence public.lead_number_seq;
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_code text not null unique,
  full_name text not null check (char_length(trim(full_name)) between 2 and 150),
  email citext,
  phone text not null check (char_length(regexp_replace(phone, '\D', '', 'g')) between 7 and 15),
  normalized_phone text generated always as (regexp_replace(phone, '\D', '', 'g')) stored,
  source text not null,
  target_country text not null,
  target_course text,
  target_intake text,
  budget_estimate text,
  assigned_counsellor uuid references public.staff_profiles(id),
  stage public.lead_stage not null default 'NEW_INQUIRY',
  priority public.lead_priority not null default 'MEDIUM',
  converted_student_id uuid unique references public.students(id),
  last_contact_at timestamptz,
  created_by uuid not null references public.staff_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index leads_email_active_unique on public.leads (lower(email::text))
  where email is not null and stage not in ('CONVERTED', 'LOST');
create unique index leads_phone_active_unique on public.leads (normalized_phone)
  where stage not in ('CONVERTED', 'LOST');
create index leads_pipeline_idx on public.leads(stage, priority, created_at desc);
create index leads_owner_idx on public.leads(assigned_counsellor, created_at desc);

create table public.lead_activities (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  activity_type text not null check (activity_type in ('CREATED','NOTE','STAGE_CHANGED','OWNER_CHANGED','FOLLOW_UP','CONVERTED')),
  body text check (body is null or char_length(body) <= 3000),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.staff_profiles(id),
  created_at timestamptz not null default now()
);
create index lead_activities_timeline_idx on public.lead_activities(lead_id, created_at desc);

create table public.lead_follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  due_at timestamptz not null,
  note text not null check (char_length(trim(note)) between 1 and 1000),
  completed_at timestamptz,
  assigned_to uuid references public.staff_profiles(id),
  created_by uuid not null references public.staff_profiles(id),
  created_at timestamptz not null default now()
);
create index lead_follow_ups_due_idx on public.lead_follow_ups(completed_at, due_at);

create trigger touch_leads before update on public.leads
for each row execute function public.touch_updated_at();

insert into public.permissions(role, permission_name, enabled)
select role, permission_name, true
from (values
  ('ADMIN'::public.staff_role), ('DIRECTOR'), ('SENIOR_COUNSELLOR'),
  ('COUNSELLOR'), ('FRONT_DESK'), ('MARKETING')
) roles(role)
cross join (values ('leads.view'), ('leads.create'), ('leads.edit')) permissions(permission_name)
on conflict (role, permission_name) do update set enabled = excluded.enabled;
insert into public.permissions(role, permission_name, enabled)
values ('ADMIN','leads.delete',true), ('DIRECTOR','leads.delete',true)
on conflict (role, permission_name) do update set enabled = excluded.enabled;

alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.lead_follow_ups enable row level security;
create policy leads_read on public.leads for select to authenticated using (public.has_permission('leads.view'));
create policy leads_update on public.leads for update to authenticated using (public.has_permission('leads.edit')) with check (public.has_permission('leads.edit'));
create policy leads_delete on public.leads for delete to authenticated using (public.has_permission('leads.delete'));
create policy lead_activities_read on public.lead_activities for select to authenticated using (public.has_permission('leads.view'));
create policy lead_follow_ups_read on public.lead_follow_ups for select to authenticated using (public.has_permission('leads.view'));
create policy lead_follow_ups_update on public.lead_follow_ups for update to authenticated using (public.has_permission('leads.edit')) with check (public.has_permission('leads.edit'));

create or replace function public.create_lead(payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare actor uuid := auth.uid(); lead_id uuid; code text; duplicate record;
begin
  if not public.has_permission('leads.create') then raise exception 'Insufficient permission to create leads'; end if;
  select id, lead_code into duplicate from leads where stage not in ('CONVERTED','LOST') and
    ((nullif(trim(payload->>'email'),'') is not null and lower(email::text)=lower(trim(payload->>'email'))) or
     normalized_phone=regexp_replace(payload->>'phone','\D','','g')) limit 1;
  if duplicate.id is not null then
    raise exception 'Duplicate active lead: %', duplicate.lead_code using errcode='unique_violation';
  end if;
  code := 'LEAD-'||to_char(timezone('Asia/Kathmandu',now()),'YYYY')||'-'||lpad(nextval('lead_number_seq')::text,5,'0');
  insert into leads(lead_code,full_name,email,phone,source,target_country,target_course,target_intake,budget_estimate,assigned_counsellor,stage,priority,created_by)
  values(code,trim(payload->>'full_name'),nullif(lower(trim(payload->>'email')),''),payload->>'phone',payload->>'source',payload->>'target_country',nullif(payload->>'target_course',''),nullif(payload->>'target_intake',''),nullif(payload->>'budget_estimate',''),nullif(payload->>'assigned_counsellor','')::uuid,coalesce((payload->>'stage')::lead_stage,'NEW_INQUIRY'),coalesce((payload->>'priority')::lead_priority,'MEDIUM'),actor)
  returning id into lead_id;
  insert into lead_activities(lead_id,activity_type,body,created_by) values(lead_id,'CREATED','Lead captured',actor);
  return jsonb_build_object('id',lead_id,'lead_code',code);
end $$;

create or replace function public.add_lead_note(lead_uuid uuid, note text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission('leads.edit') then raise exception 'Insufficient permission to edit leads'; end if;
  if char_length(trim(note)) not between 1 and 3000 then raise exception 'Note must be between 1 and 3000 characters'; end if;
  insert into lead_activities(lead_id,activity_type,body,created_by) values(lead_uuid,'NOTE',trim(note),auth.uid());
  update leads set last_contact_at=now() where id=lead_uuid;
end $$;

create or replace function public.convert_lead(lead_uuid uuid, student_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; actor uuid := auth.uid(); target public.leads;
begin
  if not public.has_permission('leads.edit') or not public.has_permission('students.create') then raise exception 'Insufficient permission to convert leads'; end if;
  select * into target from leads where id=lead_uuid for update;
  if target.id is null then raise exception 'Lead not found'; end if;
  if target.stage='CONVERTED' then raise exception 'Lead is already converted'; end if;
  result := public.register_student(student_payload || jsonb_build_object(
    'full_name',target.full_name,'email',target.email,'whatsapp',target.phone,
    'preferred_country',target.target_country,'preferred_course',coalesce(target.target_course,'Undecided'),
    'preferred_intake',coalesce(target.target_intake,'Undecided'),'lead_source',target.source
  ));
  update leads set stage='CONVERTED', converted_student_id=(result->>'id')::uuid, last_contact_at=now() where id=lead_uuid;
  insert into lead_activities(lead_id,activity_type,body,metadata,created_by)
  values(lead_uuid,'CONVERTED','Converted to student',jsonb_build_object('student_id',result->>'id','student_code',result->>'student_code'),actor);
  return result;
end $$;

revoke all on function public.create_lead(jsonb) from public;
revoke all on function public.add_lead_note(uuid,text) from public;
revoke all on function public.convert_lead(uuid,jsonb) from public;
grant execute on function public.create_lead(jsonb), public.add_lead_note(uuid,text), public.convert_lead(uuid,jsonb) to authenticated;
