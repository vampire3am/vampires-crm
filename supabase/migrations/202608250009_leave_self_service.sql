create or replace function public.hr_request_leave(payload jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  eid uuid;
  lid uuid;
  start_date date;
  end_date date;
  requested_days integer;
begin
  if public.current_staff_role() = 'ADMIN' then
    raise exception 'Administrators review leave requests and cannot submit one';
  end if;

  select id into eid from public.hr_employees
  where staff_profile_id=auth.uid() and employment_status in ('ACTIVE','PROBATION','ON_LEAVE');
  if eid is null then raise exception 'Active employee record not found for this login'; end if;

  start_date := (payload->>'from_date')::date;
  end_date := (payload->>'to_date')::date;
  if end_date < start_date then raise exception 'Leave end date cannot be before the start date'; end if;
  requested_days := (end_date-start_date)+1;
  if nullif(trim(payload->>'reason'),'') is null then raise exception 'Leave reason is required'; end if;

  if exists(
    select 1 from public.hr_leave_requests
    where employee_id=eid and status in ('PENDING','APPROVED')
      and daterange(from_date,to_date,'[]') && daterange(start_date,end_date,'[]')
  ) then raise exception 'A pending or approved leave request already overlaps these dates'; end if;

  insert into public.hr_leave_requests(employee_id,leave_type,from_date,to_date,days,reason)
  values(eid,payload->>'leave_type',start_date,end_date,requested_days,trim(payload->>'reason'))
  returning id into lid;
  return lid;
end$$;
revoke all on function public.hr_request_leave(jsonb) from public;
grant execute on function public.hr_request_leave(jsonb) to authenticated;
