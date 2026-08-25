create or replace function public.hr_my_leave_requests()
returns table(
  id uuid,
  employee_code text,
  full_name text,
  leave_type text,
  from_date date,
  to_date date,
  days integer,
  reason text,
  status text,
  approved_by_name text,
  created_at timestamptz
)
language sql
security definer
set search_path=public
as $$
  select l.id, e.employee_code, e.full_name, l.leave_type, l.from_date, l.to_date,
         l.days, l.reason, l.status, approver.full_name, l.created_at
  from public.hr_leave_requests l
  join public.hr_employees e on e.id=l.employee_id
  left join public.staff_profiles approver on approver.id=l.approved_by
  where e.staff_profile_id=auth.uid()
  order by l.created_at desc;
$$;

revoke all on function public.hr_my_leave_requests() from public;
grant execute on function public.hr_my_leave_requests() to authenticated;
