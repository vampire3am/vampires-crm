begin;

-- Screen-rest wellness history existed before employee break management. Keep
-- that history for its original audit screen without treating it as employee
-- lunch, tea, personal, prayer, or other break data.
alter table public.hr_work_break_logs add column if not exists record_category text;

update public.hr_work_break_logs b
set record_category=case
  when t.code='SCREEN_REST' and b.started_at<timestamptz '2026-09-26 00:00:00+05:45'
    then 'LEGACY_SCREEN_AUDIT'
  else 'EMPLOYEE_BREAK'
end
from public.hr_break_types t
where b.break_type_id=t.id and b.record_category is null;

update public.hr_work_break_logs set record_category='EMPLOYEE_BREAK' where record_category is null;
alter table public.hr_work_break_logs alter column record_category set default 'EMPLOYEE_BREAK';
alter table public.hr_work_break_logs alter column record_category set not null;
alter table public.hr_work_break_logs drop constraint if exists hr_work_break_logs_category_check;
alter table public.hr_work_break_logs add constraint hr_work_break_logs_category_check
  check(record_category in('EMPLOYEE_BREAK','SCREEN_WELLNESS','LEGACY_SCREEN_AUDIT'));
create index if not exists hr_work_break_category_date_idx
  on public.hr_work_break_logs(record_category,work_date desc,employee_id);

-- Every linked staff account, including an administrator who is also an
-- employee, may use the dashboard break control. Viewing and correction remain
-- governed by their separate management permissions.
insert into public.permissions(role,permission_name,enabled)
select role,'breaks.use',true from unnest(enum_range(null::public.staff_role)) role
on conflict(role,permission_name) do update set enabled=true;

insert into public.staff_permission_overrides(staff_id,permission_name,enabled,updated_by)
select sp.id,'breaks.use',true,null
from public.staff_profiles sp
where sp.is_active and sp.access_mode='EXACT'
on conflict(staff_id,permission_name) do nothing;

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
    where b.employee_id=eid and b.status='ACTIVE' and b.record_category='EMPLOYEE_BREAK' limit 1;
  select jsonb_build_object(
    'employee_id',eid,'employee_code',e.employee_code,'full_name',e.full_name,
    'attendance_id',attendance_record.id,'clock_in',attendance_record.clock_in,'clock_out',attendance_record.clock_out,
    'attendance_date',attendance_record.attendance_date,'active_break',active_record,
    'breaks_taken',(select count(*) from hr_work_break_logs b where b.employee_id=eid and b.record_category='EMPLOYEE_BREAK' and b.work_date=(now() at time zone 'Asia/Kathmandu')::date and b.status in('COMPLETED','MANUALLY_ADJUSTED')),
    'total_break_seconds',coalesce((select sum(b.actual_seconds) from hr_work_break_logs b where b.employee_id=eid and b.record_category='EMPLOYEE_BREAK' and b.work_date=(now() at time zone 'Asia/Kathmandu')::date and b.status in('COMPLETED','MANUALLY_ADJUSTED')),0),
    'break_types',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'code',t.code,'name',t.name) order by t.sort_order,t.name),'[]'::jsonb) from hr_break_types t where t.is_active)
  ) into result from hr_employees e where e.id=eid;
  return result;
end$$;

-- Compatibility entry point used only by the five-minute wellness reminder.
-- The shared start/end rules still enforce attendance and one active break.
create or replace function public.hr_start_work_break(break_source text default 'MANUAL')
returns uuid language plpgsql security definer set search_path=public as $$
declare type_uuid uuid; break_uuid uuid;
begin
  select id into type_uuid from hr_break_types where code='SCREEN_REST' and is_active;
  break_uuid:=public.hr_start_break(type_uuid,'Started from the wellness reminder.',gen_random_uuid(),break_source);
  update hr_work_break_logs set record_category='SCREEN_WELLNESS' where id=break_uuid;
  update hr_work_break_audit a set after_record=to_jsonb(b)
  from hr_work_break_logs b where a.break_id=break_uuid and a.break_id=b.id and a.action='STARTED';
  return break_uuid;
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
where b.record_category='EMPLOYEE_BREAK'
group by b.work_date,b.employee_id,e.employee_code,e.full_name,e.department,a.clock_in,a.clock_out;

create or replace view public.hr_report_breaks with(security_invoker=true) as
select b.id,b.work_date,e.employee_code,e.full_name,e.department,t.name break_type,b.started_at,b.ended_at,b.actual_seconds,b.status,b.source,b.remarks
from hr_work_break_logs b join hr_employees e on e.id=b.employee_id join hr_break_types t on t.id=b.break_type_id
where b.record_category='EMPLOYEE_BREAK';

revoke all on function public.hr_my_break_state(),public.hr_start_work_break(text) from public;
grant execute on function public.hr_my_break_state(),public.hr_start_work_break(text) to authenticated;

commit;
