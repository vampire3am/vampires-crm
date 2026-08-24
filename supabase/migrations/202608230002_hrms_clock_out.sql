-- Employee self-service clock-out. Admins continue to review all records through hr.view.
create or replace function public.hr_resolve_my_employee()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  employee_uuid uuid;
  login_email citext;
  profile_record record;
begin
  select id into employee_uuid from public.hr_employees where staff_profile_id = auth.uid();
  if employee_uuid is not null then return employee_uuid; end if;

  select email::citext into login_email from auth.users where id = auth.uid();
  if login_email is null then return null; end if;

  update public.hr_employees
  set staff_profile_id = auth.uid(), updated_at = now()
  where lower(email::text) = lower(login_email::text)
    and staff_profile_id is null
  returning id into employee_uuid;
  if employee_uuid is not null then return employee_uuid; end if;

  select id, full_name, email, role, is_active
  into profile_record
  from public.staff_profiles
  where id = auth.uid();

  if profile_record.id is null or not profile_record.is_active then return null; end if;

  insert into public.hr_employees(
    staff_profile_id, full_name, email, job_title, department, branch,
    join_date, employment_status, base_salary, created_by
  ) values (
    profile_record.id,
    profile_record.full_name,
    profile_record.email,
    initcap(replace(profile_record.role::text, '_', ' ')),
    case
      when profile_record.role::text = 'FINANCE' then 'Finance'
      when profile_record.role::text in ('COUNSELLOR', 'DOCUMENTATION') then 'Counselling'
      when profile_record.role::text in ('ADMIN', 'DIRECTOR') then 'Management'
      else 'Operations'
    end,
    'AECS Bagbazar Main Office',
    current_date,
    'ACTIVE',
    0,
    profile_record.id
  )
  on conflict (email) do update
    set staff_profile_id = excluded.staff_profile_id,
        updated_at = now()
  returning id into employee_uuid;
  return employee_uuid;
end;
$$;

create or replace function public.hr_my_attendance_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_uuid uuid;
  result jsonb;
begin
  employee_uuid := public.hr_resolve_my_employee();
  if employee_uuid is null then return null; end if;
  select jsonb_build_object(
    'employee_code', e.employee_code,
    'full_name', e.full_name,
    'clock_in', a.clock_in,
    'clock_out', a.clock_out,
    'status', coalesce(a.status, 'NOT_CLOCKED_IN'),
    'late_minutes', coalesce(a.late_minutes, 0)
  ) into result
  from hr_employees e
  left join hr_attendance a on a.employee_id=e.id and a.attendance_date=(now() at time zone 'Asia/Kathmandu')::date
  where e.id=employee_uuid;
  return result;
end;
$$;

create or replace function public.hr_clock_in()
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare eid uuid; aid uuid; nepal_clock time; late integer:=0;
begin
  eid := public.hr_resolve_my_employee();
  if eid is null then raise exception 'No employee record matches your signed-in email'; end if;
  if not exists(select 1 from hr_employees where id=eid and employment_status in('ACTIVE','PROBATION')) then raise exception 'Employee record is not active'; end if;
  nepal_clock := now() at time zone 'Asia/Kathmandu';
  late := greatest(0, floor(extract(epoch from (nepal_clock - time '10:15')) / 60)::integer);
  insert into hr_attendance(employee_id,attendance_date,clock_in,status,late_minutes) values(eid,(now() at time zone 'Asia/Kathmandu')::date,now(),case when late>0 then'LATE'else'PRESENT'end,late)
  on conflict(employee_id,attendance_date) do update set clock_in=coalesce(hr_attendance.clock_in,excluded.clock_in) returning id into aid;
  return aid;
end;
$$;

update public.hr_shifts
set start_time = time '09:00', end_time = time '18:00', grace_minutes = 75
where name = 'Standard Office';

-- Correct existing punches using the official Nepal-time cutoff.
update public.hr_attendance
set status = case when (clock_in at time zone 'Asia/Kathmandu')::time > time '10:15' then 'LATE' else 'PRESENT' end,
    late_minutes = greatest(0, floor(extract(epoch from (((clock_in at time zone 'Asia/Kathmandu')::time) - time '10:15')) / 60)::integer)
where clock_in is not null
  and status in ('PRESENT', 'LATE');

create or replace function public.hr_clock_out()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_uuid uuid;
  attendance_uuid uuid;
begin
  employee_uuid := public.hr_resolve_my_employee();

  if employee_uuid is null then
    raise exception 'Active employee record not found';
  end if;

  update hr_attendance
  set clock_out = now()
  where employee_id = employee_uuid
    and attendance_date = (now() at time zone 'Asia/Kathmandu')::date
    and clock_in is not null
    and clock_out is null
  returning id into attendance_uuid;

  if attendance_uuid is null then
    raise exception 'Clock in before clocking out, or today''s shift is already closed';
  end if;

  return attendance_uuid;
end;
$$;

revoke all on function public.hr_resolve_my_employee(), public.hr_my_attendance_status(), public.hr_clock_in(), public.hr_clock_out() from public;
grant execute on function public.hr_resolve_my_employee(), public.hr_my_attendance_status(), public.hr_clock_in(), public.hr_clock_out() to authenticated;
