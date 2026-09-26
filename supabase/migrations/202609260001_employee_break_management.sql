begin;

create table if not exists public.hr_break_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  name text not null check (length(trim(name)) between 2 and 80),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references public.staff_profiles(id),
  updated_by uuid references public.staff_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.hr_break_types(code,name,sort_order) values
  ('TIFFIN_LUNCH','Tiffin / Lunch',10),
  ('TEA_COFFEE','Tea / Coffee',20),
  ('PERSONAL','Personal',30),
  ('PRAYER','Prayer',40),
  ('SCREEN_REST','Screen Rest / Wellness',50),
  ('OTHER','Other',60)
on conflict(code) do update set name=excluded.name,sort_order=excluded.sort_order;

alter table public.hr_work_break_logs
  add column if not exists attendance_id uuid references public.hr_attendance(id) on delete set null,
  add column if not exists break_type_id uuid references public.hr_break_types(id),
  add column if not exists work_date date,
  add column if not exists remarks text,
  add column if not exists created_by uuid references public.staff_profiles(id),
  add column if not exists updated_by uuid references public.staff_profiles(id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists start_request_id uuid,
  add column if not exists end_request_id uuid;

update public.hr_work_break_logs b
set break_type_id=t.id
from public.hr_break_types t
where b.break_type_id is null and t.code='SCREEN_REST';
update public.hr_work_break_logs
set work_date=(started_at at time zone 'Asia/Kathmandu')::date
where work_date is null;
update public.hr_work_break_logs b
set attendance_id=a.id
from public.hr_attendance a
where b.attendance_id is null and a.employee_id=b.employee_id and a.attendance_date=b.work_date;

alter table public.hr_work_break_logs alter column break_type_id set not null;
alter table public.hr_work_break_logs alter column work_date set not null;
alter table public.hr_work_break_logs drop constraint if exists hr_work_break_logs_status_check;
alter table public.hr_work_break_logs add constraint hr_work_break_logs_status_check
  check(status in('ACTIVE','COMPLETED','CANCELLED','MANUALLY_ADJUSTED'));
alter table public.hr_work_break_logs drop constraint if exists hr_work_break_logs_timestamps_check;
alter table public.hr_work_break_logs add constraint hr_work_break_logs_timestamps_check
  check((status='ACTIVE' and ended_at is null and actual_seconds is null) or
        (status<>'ACTIVE' and ended_at is not null and actual_seconds is not null and actual_seconds>=0));

-- Preserve the newest active row if legacy clients managed to create more than one.
with ranked as (
  select id,row_number() over(partition by employee_id order by started_at desc,id desc) position
  from public.hr_work_break_logs where status='ACTIVE'
)
update public.hr_work_break_logs b
set ended_at=now(),actual_seconds=greatest(0,extract(epoch from(now()-b.started_at))::integer),
    status='MANUALLY_ADJUSTED',remarks=concat_ws(E'\n',b.remarks,'Closed while enabling single-active-break enforcement.'),updated_at=now()
from ranked r where b.id=r.id and r.position>1;

create unique index if not exists hr_work_break_one_active_per_employee
  on public.hr_work_break_logs(employee_id) where status='ACTIVE';
create unique index if not exists hr_work_break_start_request_unique
  on public.hr_work_break_logs(start_request_id) where start_request_id is not null;
create unique index if not exists hr_work_break_end_request_unique
  on public.hr_work_break_logs(end_request_id) where end_request_id is not null;
create index if not exists hr_work_break_date_employee_idx
  on public.hr_work_break_logs(work_date desc,employee_id);

create table if not exists public.hr_work_break_audit (
  id bigint generated always as identity primary key,
  break_id uuid not null references public.hr_work_break_logs(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  actor_id uuid references public.staff_profiles(id),
  action text not null check(action in('STARTED','ENDED','AUTO_CLOSED_CLOCK_OUT','CANCELLED','MANUALLY_ADJUSTED')),
  reason text,
  before_record jsonb,
  after_record jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hr_work_break_audit_break_idx on public.hr_work_break_audit(break_id,created_at desc);

-- Repair legacy rows left ACTIVE after their linked attendance was already
-- clocked out. The correction is explicit and retains before/after evidence.
with stale as materialized (
  select b.id,b.employee_id,to_jsonb(b) before_record,greatest(b.started_at,a.clock_out) corrected_end
  from public.hr_work_break_logs b join public.hr_attendance a on a.id=b.attendance_id
  where b.status='ACTIVE' and a.clock_out is not null for update of b
), updated as (
  update public.hr_work_break_logs b set ended_at=s.corrected_end,
    actual_seconds=greatest(0,extract(epoch from(s.corrected_end-b.started_at))::integer),
    status='MANUALLY_ADJUSTED',remarks=concat_ws(E'\n',b.remarks,'Legacy active break closed at recorded attendance clock-out.'),updated_at=now()
  from stale s where b.id=s.id returning b.*
)
insert into public.hr_work_break_audit(break_id,employee_id,actor_id,action,reason,before_record,after_record)
select u.id,u.employee_id,null,'MANUALLY_ADJUSTED','Legacy active break closed at recorded attendance clock-out.',s.before_record,to_jsonb(u)
from updated u join stale s on s.id=u.id;

with cancelled as materialized (
  select b.id,b.employee_id,to_jsonb(b) before_record from public.hr_work_break_logs b
  where b.status='CANCELLED' and (b.actual_seconds<>0 or b.ended_at<>b.started_at) for update
), normalized as (
  update public.hr_work_break_logs b set ended_at=b.started_at,actual_seconds=0,updated_at=now()
  from cancelled c where b.id=c.id returning b.*
)
insert into public.hr_work_break_audit(break_id,employee_id,actor_id,action,reason,before_record,after_record)
select n.id,n.employee_id,null,'MANUALLY_ADJUSTED','Normalized cancelled break to zero reportable duration.',c.before_record,to_jsonb(n)
from normalized n join cancelled c on c.id=n.id;

insert into public.permissions(role,permission_name,enabled)
select role,'breaks.use',true from unnest(enum_range(null::public.staff_role)) role where role::text<>'ADMIN'
on conflict(role,permission_name) do update set enabled=true;
insert into public.permissions(role,permission_name,enabled)
select role,'breaks.team_view',true from (values('HR_ADMIN'::public.staff_role),('DIRECTOR'),('SENIOR_COUNSELLOR')) r(role)
on conflict(role,permission_name) do update set enabled=true;
insert into public.permissions(role,permission_name,enabled)
select role,permission_name,true from (values('ADMIN'::public.staff_role),('HR_ADMIN')) r(role)
cross join (values('breaks.view_all'),('breaks.manage'),('break_types.manage'),('breaks.reports.view'),('breaks.export')) p(permission_name)
on conflict(role,permission_name) do update set enabled=true;
insert into public.permissions(role,permission_name,enabled)
select 'DIRECTOR'::public.staff_role,permission_name,true
from (values('breaks.view_all'),('breaks.reports.view'),('breaks.export')) p(permission_name)
on conflict(role,permission_name) do update set enabled=true;

-- Exact-access accounts intentionally ignore role defaults. Seed only this new
-- module's approved role baseline so existing users are not locked out after
-- deployment; administrators can still change each override in Users & Permissions.
insert into public.staff_permission_overrides(staff_id,permission_name,enabled,updated_by)
select sp.id,'breaks.use',true,null from public.staff_profiles sp
where sp.is_active and sp.access_mode='EXACT' and sp.role::text<>'ADMIN'
on conflict(staff_id,permission_name) do nothing;
insert into public.staff_permission_overrides(staff_id,permission_name,enabled,updated_by)
select sp.id,'breaks.team_view',true,null from public.staff_profiles sp
where sp.is_active and sp.access_mode='EXACT' and sp.role::text in('HR_ADMIN','DIRECTOR','SENIOR_COUNSELLOR')
on conflict(staff_id,permission_name) do nothing;
insert into public.staff_permission_overrides(staff_id,permission_name,enabled,updated_by)
select sp.id,p.permission_name,true,null from public.staff_profiles sp
cross join (values('breaks.view_all'),('breaks.manage'),('break_types.manage'),('breaks.reports.view'),('breaks.export')) p(permission_name)
where sp.is_active and sp.access_mode='EXACT' and sp.role::text in('ADMIN','HR_ADMIN')
on conflict(staff_id,permission_name) do nothing;
insert into public.staff_permission_overrides(staff_id,permission_name,enabled,updated_by)
select sp.id,p.permission_name,true,null from public.staff_profiles sp
cross join (values('breaks.view_all'),('breaks.reports.view'),('breaks.export')) p(permission_name)
where sp.is_active and sp.access_mode='EXACT' and sp.role::text='DIRECTOR'
on conflict(staff_id,permission_name) do nothing;

alter table public.hr_break_types enable row level security;
alter table public.hr_work_break_logs enable row level security;
alter table public.hr_work_break_audit enable row level security;

drop policy if exists hr_break_types_read on public.hr_break_types;
create policy hr_break_types_read on public.hr_break_types for select to authenticated using(true);
drop policy if exists hr_break_types_manage_insert on public.hr_break_types;
create policy hr_break_types_manage_insert on public.hr_break_types for insert to authenticated
with check(public.has_permission('break_types.manage'));
drop policy if exists hr_break_types_manage_update on public.hr_break_types;
create policy hr_break_types_manage_update on public.hr_break_types for update to authenticated
using(public.has_permission('break_types.manage')) with check(public.has_permission('break_types.manage'));

drop policy if exists hr_work_break_self_read on public.hr_work_break_logs;
drop policy if exists hr_work_break_manager_read on public.hr_work_break_logs;
drop policy if exists hr_work_break_authorized_read on public.hr_work_break_logs;
create policy hr_work_break_authorized_read on public.hr_work_break_logs for select to authenticated using(
  employee_id in(select id from public.hr_employees where staff_profile_id=auth.uid())
  or public.has_permission('breaks.view_all')
  or (public.has_permission('breaks.team_view') and employee_id in(
    select team.id from public.hr_employees team
    where team.manager_id=(select manager.id from public.hr_employees manager where manager.staff_profile_id=auth.uid())
  ))
);
drop policy if exists hr_work_break_audit_authorized_read on public.hr_work_break_audit;
create policy hr_work_break_audit_authorized_read on public.hr_work_break_audit for select to authenticated using(
  employee_id in(select id from public.hr_employees where staff_profile_id=auth.uid())
  or public.has_permission('breaks.view_all')
  or (public.has_permission('breaks.team_view') and employee_id in(
    select team.id from public.hr_employees team
    where team.manager_id=(select manager.id from public.hr_employees manager where manager.staff_profile_id=auth.uid())
  ))
);

revoke insert,update,delete on public.hr_work_break_logs,public.hr_work_break_audit from authenticated;
grant select on public.hr_work_break_logs,public.hr_work_break_audit,public.hr_break_types to authenticated;
grant insert,update on public.hr_break_types to authenticated;

create or replace function public.hr_my_break_state()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare eid uuid; attendance_record record; active_record jsonb; result jsonb;
begin
  eid:=public.hr_resolve_my_employee();
  if eid is null then return null; end if;
  select * into attendance_record from hr_attendance
    where employee_id=eid and clock_in is not null and (
      attendance_date=(now() at time zone 'Asia/Kathmandu')::date
      or (clock_out is null and clock_in>=now()-interval '24 hours')
    ) order by attendance_date desc,clock_in desc limit 1;
  select jsonb_build_object('id',b.id,'break_type_id',b.break_type_id,'break_type',t.name,'started_at',b.started_at,'remarks',b.remarks)
    into active_record from hr_work_break_logs b join hr_break_types t on t.id=b.break_type_id
    where b.employee_id=eid and b.status='ACTIVE' limit 1;
  select jsonb_build_object(
    'employee_id',eid,'employee_code',e.employee_code,'full_name',e.full_name,
    'attendance_id',attendance_record.id,'clock_in',attendance_record.clock_in,'clock_out',attendance_record.clock_out,
    'attendance_date',attendance_record.attendance_date,'active_break',active_record,
    'breaks_taken',(select count(*) from hr_work_break_logs b where b.employee_id=eid and b.work_date=(now() at time zone 'Asia/Kathmandu')::date and b.status in('COMPLETED','MANUALLY_ADJUSTED')),
    'total_break_seconds',coalesce((select sum(b.actual_seconds) from hr_work_break_logs b where b.employee_id=eid and b.work_date=(now() at time zone 'Asia/Kathmandu')::date and b.status in('COMPLETED','MANUALLY_ADJUSTED')),0),
    'break_types',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'code',t.code,'name',t.name) order by t.sort_order,t.name),'[]'::jsonb) from hr_break_types t where t.is_active)
  ) into result from hr_employees e where e.id=eid;
  return result;
end$$;

create or replace function public.hr_start_break(break_type_uuid uuid,break_remarks text default null,request_uuid uuid default gen_random_uuid(),break_source text default 'MANUAL')
returns uuid language plpgsql security definer set search_path=public as $$
declare eid uuid; aid uuid; bid uuid;
begin
  if not public.has_permission('breaks.use') then raise exception 'Break self-service permission required'; end if;
  if break_source not in('AUTOMATIC','MANUAL') then raise exception 'Invalid break source'; end if;
  select id into bid from hr_work_break_logs where start_request_id=request_uuid;
  if bid is not null then return bid; end if;
  eid:=public.hr_resolve_my_employee();
  if eid is null then raise exception 'Active employee record not found'; end if;
  perform 1 from hr_employees where id=eid for update;
  if not exists(select 1 from hr_break_types where id=break_type_uuid and is_active) then raise exception 'Select an active break type'; end if;
  select id into aid from hr_attendance where employee_id=eid and clock_in is not null and clock_out is null
    and (attendance_date=(now() at time zone 'Asia/Kathmandu')::date or clock_in>=now()-interval '24 hours')
    order by attendance_date desc,clock_in desc limit 1;
  if aid is null then raise exception 'Clock in before starting a break'; end if;
  if exists(select 1 from hr_work_break_logs where employee_id=eid and status='ACTIVE') then raise exception 'You already have an active break'; end if;
  insert into hr_work_break_logs(employee_id,attendance_id,break_type_id,work_date,source,started_at,status,remarks,created_by,updated_by,start_request_id)
  select eid,a.id,break_type_uuid,a.attendance_date,break_source,now(),'ACTIVE',nullif(trim(break_remarks),''),auth.uid(),auth.uid(),request_uuid
  from hr_attendance a where a.id=aid returning id into bid;
  insert into hr_work_break_audit(break_id,employee_id,actor_id,action,after_record)
  select id,employee_id,auth.uid(),'STARTED',to_jsonb(b) from hr_work_break_logs b where id=bid;
  return bid;
end$$;

-- Preserve compatibility with the existing wellness reminder while routing it
-- through the same attendance, permission, concurrency and audit rules.
create or replace function public.hr_start_work_break(break_source text default 'MANUAL')
returns uuid language plpgsql security definer set search_path=public as $$
declare type_uuid uuid;
begin
  select id into type_uuid from hr_break_types where code='SCREEN_REST' and is_active;
  return public.hr_start_break(type_uuid,'Started from the wellness reminder.',gen_random_uuid(),break_source);
end$$;

create or replace function public.hr_complete_work_break(break_uuid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.hr_end_break(break_uuid,gen_random_uuid());
end$$;

create or replace function public.hr_end_break(break_uuid uuid,request_uuid uuid default gen_random_uuid())
returns void language plpgsql security definer set search_path=public as $$
declare eid uuid; old_record hr_work_break_logs; new_record hr_work_break_logs;
begin
  if not public.has_permission('breaks.use') then raise exception 'Break self-service permission required'; end if;
  eid:=public.hr_resolve_my_employee();
  select * into old_record from hr_work_break_logs where id=break_uuid and employee_id=eid for update;
  if old_record.id is null then raise exception 'Break record not found'; end if;
  if old_record.status<>'ACTIVE' then
    if old_record.end_request_id=request_uuid then return; end if;
    raise exception 'This break is already closed';
  end if;
  update hr_work_break_logs set ended_at=now(),actual_seconds=greatest(0,extract(epoch from(now()-started_at))::integer),
    status='COMPLETED',updated_by=auth.uid(),updated_at=now(),end_request_id=request_uuid where id=break_uuid returning * into new_record;
  insert into hr_work_break_audit(break_id,employee_id,actor_id,action,before_record,after_record)
  values(break_uuid,eid,auth.uid(),'ENDED',to_jsonb(old_record),to_jsonb(new_record));
end$$;

create or replace function public.hr_manage_work_break(break_uuid uuid,management_action text,reason text,new_started_at timestamptz default null,new_ended_at timestamptz default null,new_break_type_id uuid default null,new_remarks text default null)
returns void language plpgsql security definer set search_path=public as $$
declare old_record hr_work_break_logs; new_record hr_work_break_logs; next_status text;
begin
  if not public.has_permission('breaks.manage') then raise exception 'Break management permission required'; end if;
  if length(trim(coalesce(reason,'')))<5 then raise exception 'A correction reason of at least 5 characters is required'; end if;
  if management_action not in('CANCEL','ADJUST','CLOSE') then raise exception 'Invalid break management action'; end if;
  select * into old_record from hr_work_break_logs where id=break_uuid for update;
  if old_record.id is null then raise exception 'Break record not found'; end if;
  next_status:=case when management_action='CANCEL' then 'CANCELLED' else 'MANUALLY_ADJUSTED' end;
  update hr_work_break_logs set
    started_at=coalesce(new_started_at,started_at),
    ended_at=case when management_action='CANCEL' then coalesce(ended_at,started_at) else coalesce(new_ended_at,ended_at,now()) end,
    break_type_id=coalesce(new_break_type_id,break_type_id),remarks=coalesce(new_remarks,remarks),status=next_status,
    actual_seconds=case when management_action='CANCEL' then 0 else greatest(0,extract(epoch from(coalesce(new_ended_at,ended_at,now())-coalesce(new_started_at,started_at)))::integer) end,
    updated_by=auth.uid(),updated_at=now() where id=break_uuid returning * into new_record;
  insert into hr_work_break_audit(break_id,employee_id,actor_id,action,reason,before_record,after_record)
  values(break_uuid,old_record.employee_id,auth.uid(),case when management_action='CANCEL' then'CANCELLED'else'MANUALLY_ADJUSTED'end,trim(reason),to_jsonb(old_record),to_jsonb(new_record));
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'WORK_BREAK_'||management_action,'hrms',jsonb_build_object('break_id',break_uuid,'employee_id',old_record.employee_id,'reason',trim(reason)));
end$$;

create or replace function public.hr_save_break_type(type_uuid uuid,type_name text,type_code text,type_active boolean,type_sort_order integer default 100)
returns uuid language plpgsql security definer set search_path=public as $$
declare saved_id uuid;
begin
  if not public.has_permission('break_types.manage') then raise exception 'Break type management permission required'; end if;
  if length(trim(type_name))<2 then raise exception 'Break type name is required'; end if;
  if type_code !~ '^[A-Z][A-Z0-9_]{1,39}$' then raise exception 'Break type code must use uppercase letters, numbers, and underscores'; end if;
  if type_uuid is null then
    insert into hr_break_types(code,name,is_active,sort_order,created_by,updated_by) values(type_code,trim(type_name),type_active,type_sort_order,auth.uid(),auth.uid()) returning id into saved_id;
  else
    update hr_break_types set code=type_code,name=trim(type_name),is_active=type_active,sort_order=type_sort_order,updated_by=auth.uid(),updated_at=now() where id=type_uuid returning id into saved_id;
  end if;
  return saved_id;
end$$;

-- Clock-out is authoritative and cannot leave a forgotten break running.
create or replace function public.hr_clock_out()
returns uuid language plpgsql security definer set search_path=public as $$
declare employee_uuid uuid; attendance_uuid uuid; break_record hr_work_break_logs; closed_record hr_work_break_logs;
begin
  employee_uuid:=public.hr_resolve_my_employee();
  if employee_uuid is null then raise exception 'Active employee record not found'; end if;
  select * into break_record from hr_work_break_logs where employee_id=employee_uuid and status='ACTIVE' for update;
  if break_record.id is not null then
    update hr_work_break_logs set ended_at=now(),actual_seconds=greatest(0,extract(epoch from(now()-started_at))::integer),status='COMPLETED',
      remarks=concat_ws(E'\n',remarks,'Automatically ended when the employee clocked out.'),updated_by=auth.uid(),updated_at=now()
      where id=break_record.id returning * into closed_record;
    insert into hr_work_break_audit(break_id,employee_id,actor_id,action,reason,before_record,after_record)
    values(break_record.id,employee_uuid,auth.uid(),'AUTO_CLOSED_CLOCK_OUT','Employee clocked out while the break was active.',to_jsonb(break_record),to_jsonb(closed_record));
  end if;
  update hr_attendance set clock_out=now() where employee_id=employee_uuid and clock_in is not null and clock_out is null
    and (attendance_date=(now() at time zone 'Asia/Kathmandu')::date or clock_in>=now()-interval '24 hours')
    returning id into attendance_uuid;
  if attendance_uuid is null then raise exception 'Clock in before clocking out, or today''s shift is already closed'; end if;
  return attendance_uuid;
end$$;

create or replace view public.hr_break_daily_summary with(security_invoker=true) as
select b.work_date,b.employee_id,e.employee_code,e.full_name,e.department,
  count(*) filter(where b.status in('COMPLETED','MANUALLY_ADJUSTED'))::integer total_breaks,
  coalesce(sum(b.actual_seconds) filter(where b.status in('COMPLETED','MANUALLY_ADJUSTED')),0)::bigint total_break_seconds,
  coalesce(avg(b.actual_seconds) filter(where b.status in('COMPLETED','MANUALLY_ADJUSTED')),0)::numeric(12,2) average_break_seconds,
  min(b.started_at) first_break_at,max(b.started_at) last_break_at,
  greatest(0,coalesce(extract(epoch from(a.clock_out-a.clock_in)),extract(epoch from(now()-a.clock_in)),0))::bigint attendance_seconds,
  greatest(0,coalesce(extract(epoch from(a.clock_out-a.clock_in)),extract(epoch from(now()-a.clock_in)),0)-coalesce(sum(b.actual_seconds) filter(where b.status in('COMPLETED','MANUALLY_ADJUSTED')),0))::bigint net_work_seconds
from hr_work_break_logs b join hr_employees e on e.id=b.employee_id left join hr_attendance a on a.id=b.attendance_id
group by b.work_date,b.employee_id,e.employee_code,e.full_name,e.department,a.clock_in,a.clock_out;

create or replace view public.hr_report_breaks with(security_invoker=true) as
select b.id,b.work_date,e.employee_code,e.full_name,e.department,t.name break_type,b.started_at,b.ended_at,b.actual_seconds,b.status,b.source,b.remarks
from hr_work_break_logs b join hr_employees e on e.id=b.employee_id join hr_break_types t on t.id=b.break_type_id;

-- Older production projects may predate the HR report catalogue migration.
create table if not exists public.hr_report_catalog(
  report_key text primary key,
  name text not null,
  category text not null,
  description text not null,
  is_active boolean not null default true
);
alter table public.hr_report_catalog enable row level security;
drop policy if exists hr_report_catalog_authorized_read on public.hr_report_catalog;
create policy hr_report_catalog_authorized_read on public.hr_report_catalog for select to authenticated
using(public.has_permission('hr.reports.view') or public.has_permission('breaks.reports.view'));
insert into public.hr_report_catalog(report_key,name,category,description) values
('breaks','Employee Break Reports','BREAKS','Daily break records, duration, status and attendance-linked employee history.')
on conflict(report_key) do update set name=excluded.name,category=excluded.category,description=excluded.description;

revoke all on function public.hr_my_break_state(),public.hr_start_break(uuid,text,uuid,text),public.hr_end_break(uuid,uuid),public.hr_start_work_break(text),public.hr_complete_work_break(uuid),public.hr_manage_work_break(uuid,text,text,timestamptz,timestamptz,uuid,text),public.hr_save_break_type(uuid,text,text,boolean,integer) from public;
grant execute on function public.hr_my_break_state(),public.hr_start_break(uuid,text,uuid,text),public.hr_end_break(uuid,uuid),public.hr_start_work_break(text),public.hr_complete_work_break(uuid),public.hr_manage_work_break(uuid,text,text,timestamptz,timestamptz,uuid,text),public.hr_save_break_type(uuid,text,text,boolean,integer) to authenticated;
grant select on public.hr_break_daily_summary,public.hr_report_breaks to authenticated;

commit;
