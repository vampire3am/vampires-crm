-- Phase 3: counselling, shortlists, applications, visas, tasks and escalation.
alter table public.counselling_records add column if not exists target_country text;
alter table public.counselling_records add column if not exists preferred_course text;
alter table public.counselling_records add column if not exists outcome text;
alter table public.university_applications drop constraint if exists university_applications_country_check;
alter table public.university_applications add constraint university_applications_country_check check(country in ('UK','Australia','Canada','USA','Germany','New Zealand','Finland','Ireland','Japan','Other'));

create table public.course_shortlists (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  university_name text not null, country text not null, course_name text not null, intake text not null,
  tuition_fee text, scholarship text, status text not null default 'SHORTLISTED' check(status in ('SHORTLISTED','RECOMMENDED','SELECTED','REJECTED')),
  added_by uuid not null references public.staff_profiles(id), created_at timestamptz not null default now(),
  unique(student_id,university_name,course_name,intake)
);
create index course_shortlists_student_idx on public.course_shortlists(student_id,created_at desc);

create table public.application_events (
  id bigint generated always as identity primary key, application_id uuid not null references public.university_applications(id) on delete cascade,
  event_type text not null, from_stage public.application_stage, to_stage public.application_stage,
  notes text check(notes is null or char_length(notes)<=3000), created_by uuid not null references public.staff_profiles(id), created_at timestamptz not null default now()
);
create index application_events_timeline_idx on public.application_events(application_id,created_at desc);

create table public.case_tasks (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  application_id uuid references public.university_applications(id) on delete cascade, title text not null check(char_length(trim(title)) between 2 and 200),
  description text, due_at timestamptz not null, priority public.lead_priority not null default 'MEDIUM',
  status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),
  assigned_to uuid not null references public.staff_profiles(id), created_by uuid not null references public.staff_profiles(id),
  completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index case_tasks_queue_idx on public.case_tasks(status,due_at,priority);
create trigger touch_case_tasks before update on public.case_tasks for each row execute function public.touch_updated_at();

insert into public.permissions(role,permission_name,enabled)
select role,permission_name,true from (values ('ADMIN'::public.staff_role),('DIRECTOR'),('SENIOR_COUNSELLOR'),('COUNSELLOR'),('VISA_OFFICER')) r(role)
cross join (values ('counselling.view'),('counselling.edit'),('applications.view'),('applications.edit'),('case_tasks.view'),('case_tasks.edit')) p(permission_name)
on conflict(role,permission_name) do update set enabled=excluded.enabled;
insert into public.permissions(role,permission_name,enabled)
select role,permission_name,true from (values ('FRONT_DESK'::public.staff_role),('DOCUMENTATION')) r(role)
cross join (values ('counselling.view'),('applications.view'),('case_tasks.view')) p(permission_name)
on conflict(role,permission_name) do update set enabled=excluded.enabled;

drop policy if exists active_staff_read_counselling_records on public.counselling_records;
drop policy if exists counselling_staff_write on public.counselling_records;
drop policy if exists counselling_staff_update on public.counselling_records;
drop policy if exists staff_applications_policy on public.university_applications;
create policy counselling_read on public.counselling_records for select to authenticated using(public.has_permission('counselling.view'));
create policy applications_read on public.university_applications for select to authenticated using(public.has_permission('applications.view'));
alter table public.course_shortlists enable row level security; alter table public.application_events enable row level security; alter table public.case_tasks enable row level security;
create policy shortlists_read on public.course_shortlists for select to authenticated using(public.has_permission('counselling.view'));
create policy application_events_read on public.application_events for select to authenticated using(public.has_permission('applications.view'));
create policy case_tasks_read on public.case_tasks for select to authenticated using(public.has_permission('case_tasks.view'));
create policy case_tasks_update on public.case_tasks for update to authenticated using(public.has_permission('case_tasks.edit')) with check(public.has_permission('case_tasks.edit'));

create or replace function public.create_counselling_record(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid; rid uuid;
begin
 if not public.has_permission('counselling.edit') then raise exception 'Insufficient permission'; end if;
 select id into sid from students where student_code=trim(payload->>'student_code'); if sid is null then raise exception 'Student code not found'; end if;
 insert into counselling_records(student_id,assigned_staff,notes,follow_up_date,created_by,target_country,preferred_course,outcome)
 values(sid,auth.uid(),trim(payload->>'notes'),nullif(payload->>'follow_up_date','')::date,auth.uid(),payload->>'target_country',payload->>'preferred_course',payload->>'outcome') returning id into rid;
 return rid;
end $$;

create or replace function public.create_university_application(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid; aid uuid;
begin
 if not public.has_permission('applications.edit') then raise exception 'Insufficient permission'; end if;
 select id into sid from students where student_code=trim(payload->>'student_code'); if sid is null then raise exception 'Student code not found'; end if;
 insert into university_applications(student_id,university_name,country,course_name,intake,stage,tuition_fee,scholarship,deadline,officer_id,notes)
 values(sid,trim(payload->>'university_name'),payload->>'country',trim(payload->>'course'),payload->>'intake',coalesce((payload->>'stage')::application_stage,'SUBMITTED'),payload->>'tuition_fee',payload->>'scholarship',nullif(payload->>'deadline','')::date,auth.uid(),nullif(trim(payload->>'notes'),'')) returning id into aid;
 insert into application_events(application_id,event_type,to_stage,notes,created_by) values(aid,'APPLICATION_CREATED',coalesce((payload->>'stage')::application_stage,'SUBMITTED'),'Application created',auth.uid());
 return aid;
end $$;

create or replace function public.advance_application_stage(application_uuid uuid,next_stage public.application_stage,stage_note text default null) returns void language plpgsql security definer set search_path=public as $$
declare prior public.application_stage;
begin
 if not public.has_permission('applications.edit') then raise exception 'Insufficient permission'; end if;
 select stage into prior from university_applications where id=application_uuid for update; if prior is null then raise exception 'Application not found'; end if;
 update university_applications set stage=next_stage where id=application_uuid;
 insert into application_events(application_id,event_type,from_stage,to_stage,notes,created_by) values(application_uuid,'STAGE_CHANGED',prior,next_stage,nullif(trim(stage_note),''),auth.uid());
end $$;

create or replace function public.create_case_task(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid; tid uuid;
begin
 if not public.has_permission('case_tasks.edit') then raise exception 'Insufficient permission'; end if;
 select id into sid from students where student_code=trim(payload->>'student_code'); if sid is null then raise exception 'Student code not found'; end if;
 insert into case_tasks(student_id,application_id,title,description,due_at,priority,assigned_to,created_by)
 values(sid,nullif(payload->>'application_id','')::uuid,trim(payload->>'title'),nullif(trim(payload->>'description'),''),(payload->>'due_at')::timestamptz,coalesce((payload->>'priority')::lead_priority,'MEDIUM'),coalesce(nullif(payload->>'assigned_to','')::uuid,auth.uid()),auth.uid()) returning id into tid; return tid;
end $$;

revoke all on function public.create_counselling_record(jsonb),public.create_university_application(jsonb),public.advance_application_stage(uuid,public.application_stage,text),public.create_case_task(jsonb) from public;
grant execute on function public.create_counselling_record(jsonb),public.create_university_application(jsonb),public.advance_application_stage(uuid,public.application_stage,text),public.create_case_task(jsonb) to authenticated;
