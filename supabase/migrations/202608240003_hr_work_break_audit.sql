-- Auditable screen-time breaks for the 60/5 employee wellness cycle.
create table if not exists public.hr_work_break_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  source text not null check (source in ('AUTOMATIC','MANUAL')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  planned_minutes integer not null default 5 check (planned_minutes between 1 and 60),
  actual_seconds integer check (actual_seconds is null or actual_seconds >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED')),
  created_at timestamptz not null default now()
);

alter table public.hr_work_break_logs enable row level security;

create policy hr_work_break_self_read on public.hr_work_break_logs
for select to authenticated
using (employee_id in (select id from public.hr_employees where staff_profile_id = auth.uid()));

create policy hr_work_break_manager_read on public.hr_work_break_logs
for select to authenticated
using (public.has_permission('hr.view'));

create or replace function public.hr_start_work_break(break_source text default 'MANUAL')
returns uuid language plpgsql security definer set search_path=public as $$
declare employee_uuid uuid; break_uuid uuid;
begin
  if break_source not in ('AUTOMATIC','MANUAL') then raise exception 'Invalid break source'; end if;
  select id into employee_uuid from hr_employees
  where staff_profile_id=auth.uid() and employment_status in ('ACTIVE','PROBATION');
  if employee_uuid is null then raise exception 'Active employee record not found'; end if;

  update hr_work_break_logs
  set ended_at=now(), actual_seconds=greatest(0,extract(epoch from(now()-started_at))::integer), status='COMPLETED'
  where employee_id=employee_uuid and status='ACTIVE';

  insert into hr_work_break_logs(employee_id,source)
  values(employee_uuid,break_source) returning id into break_uuid;
  return break_uuid;
end $$;

create or replace function public.hr_complete_work_break(break_uuid uuid)
returns void language plpgsql security definer set search_path=public as $$
declare employee_uuid uuid;
begin
  select id into employee_uuid from hr_employees where staff_profile_id=auth.uid();
  if employee_uuid is null then raise exception 'Employee record not found'; end if;
  update hr_work_break_logs
  set ended_at=now(), actual_seconds=greatest(0,extract(epoch from(now()-started_at))::integer), status='COMPLETED'
  where id=break_uuid and employee_id=employee_uuid and status='ACTIVE';
end $$;

revoke all on function public.hr_start_work_break(text), public.hr_complete_work_break(uuid) from public;
grant execute on function public.hr_start_work_break(text), public.hr_complete_work_break(uuid) to authenticated;
