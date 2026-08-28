alter table public.hr_leave_requests
  add column if not exists leave_allocations jsonb not null default '[]'::jsonb;

alter table public.hr_leave_requests drop constraint if exists hr_leave_allocations_array_check;
alter table public.hr_leave_requests add constraint hr_leave_allocations_array_check
  check(jsonb_typeof(leave_allocations)='array');

create or replace function public.hr_refresh_leave_balances(employee_uuid uuid, through_date date default current_date)
returns void language plpgsql security definer set search_path=public as $$
declare
  employee_record record; policy_record record; month_cursor date; first_month date;
  previous_closing numeric(7,2); month_used numeric(7,2); month_adjustment numeric(7,2); month_opening numeric(7,2);
begin
  select id,join_date into employee_record from hr_employees where id=employee_uuid;
  if employee_record.id is null then raise exception 'Employee record not found'; end if;
  first_month:=date_trunc('month',greatest(employee_record.join_date,date_trunc('year',least(current_date,through_date))::date))::date;
  for policy_record in select * from hr_leave_policies where is_active and is_paid order by leave_type loop
    month_cursor:=first_month;
    while month_cursor<=date_trunc('month',through_date)::date loop
      select closing_balance into previous_closing from hr_leave_balance_ledger
      where employee_id=employee_uuid and leave_type=policy_record.leave_type and period_start<month_cursor
      order by period_start desc limit 1;
      previous_closing:=coalesce(previous_closing,0);
      if extract(month from month_cursor)=1 then
        month_opening:=case when policy_record.year_end_action='CARRY_FORWARD'
          then least(previous_closing,coalesce(policy_record.max_year_end_carry,previous_closing)) else 0 end;
      else month_opening:=case when policy_record.monthly_carry_forward then previous_closing else 0 end;
      end if;
      select coalesce(adjusted,0) into month_adjustment from hr_leave_balance_ledger
      where employee_id=employee_uuid and leave_type=policy_record.leave_type and period_start=month_cursor;
      month_adjustment:=coalesce(month_adjustment,0);
      select coalesce(sum(
        case when jsonb_array_length(l.leave_allocations)>0 then coalesce((
          select sum((allocation->>'days')::numeric) from jsonb_array_elements(l.leave_allocations) allocation
          where allocation->>'leave_type'=policy_record.leave_type
        ),0) else case when l.leave_type=policy_record.leave_type then case when l.from_date=l.to_date then l.day_fraction else l.days end else 0 end end
      ),0) into month_used
      from hr_leave_requests l
      where l.employee_id=employee_uuid and l.status='APPROVED'
        and l.from_date>=month_cursor and l.from_date<(month_cursor+interval '1 month')::date;
      insert into hr_leave_balance_ledger(employee_id,leave_type,period_start,opening_balance,credited,adjusted,used,closing_balance)
      values(employee_uuid,policy_record.leave_type,month_cursor,month_opening,policy_record.monthly_credit,month_adjustment,month_used,
        greatest(0,month_opening+policy_record.monthly_credit+month_adjustment-month_used))
      on conflict(employee_id,leave_type,period_start) do update set opening_balance=excluded.opening_balance,
        credited=excluded.credited,used=excluded.used,closing_balance=excluded.closing_balance,updated_at=now();
      month_cursor:=(month_cursor+interval '1 month')::date;
    end loop;
  end loop;
end$$;

create or replace function public.hr_request_leave(payload jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  eid uuid; lid uuid; start_date date; end_date date; requested_days numeric(5,1); fraction numeric(3,2);
  normalized_type text; allocations jsonb; allocation record; allocation_total numeric(5,1):=0; allocation_count integer:=0;
begin
  if public.current_staff_role()='ADMIN' then raise exception 'Administrators review configuration and cannot submit leave'; end if;
  select id into eid from hr_employees where staff_profile_id=auth.uid() and employment_status in('ACTIVE','PROBATION','ON_LEAVE');
  if eid is null then raise exception 'Active employee record not found for this login'; end if;
  start_date:=(payload->>'from_date')::date; end_date:=(payload->>'to_date')::date;
  if end_date<start_date then raise exception 'Leave end date cannot be before the start date'; end if;
  fraction:=case when payload->>'duration'='HALF_DAY' then 0.5 else 1 end;
  if fraction=0.5 and end_date<>start_date then raise exception 'Half-day leave must use one date'; end if;
  requested_days:=case when fraction=0.5 then 0.5 else (end_date-start_date)+1 end;
  allocations:=coalesce(payload->'allocations','[]'::jsonb);
  if jsonb_array_length(allocations)=0 then
    normalized_type:=case payload->>'leave_type' when 'Sick / Medical' then 'Sick Leave' else payload->>'leave_type' end;
    allocations:=jsonb_build_array(jsonb_build_object('leave_type',normalized_type,'days',requested_days));
  end if;
  for allocation in select value from jsonb_array_elements(allocations) loop
    allocation_count:=allocation_count+1;
    normalized_type:=case allocation.value->>'leave_type' when 'Sick / Medical' then 'Sick Leave' else allocation.value->>'leave_type' end;
    if not exists(select 1 from hr_leave_policies where leave_type=normalized_type and is_active) then raise exception 'Select active company leave types'; end if;
    if (allocation.value->>'days')::numeric<=0 or mod((allocation.value->>'days')::numeric,0.5)<>0 then raise exception 'Leave allocation must use 0.5-day increments'; end if;
    allocation_total:=allocation_total+(allocation.value->>'days')::numeric;
  end loop;
  if allocation_count>1 and (start_date<>end_date or requested_days<>1) then raise exception 'Combined leave balances can currently be used for one full day only'; end if;
  if allocation_total<>requested_days then raise exception 'Allocated leave must equal the requested duration'; end if;
  if nullif(trim(payload->>'reason'),'') is null then raise exception 'Leave reason is required'; end if;
  if exists(select 1 from hr_leave_requests where employee_id=eid and status in('PENDING','APPROVED') and daterange(from_date,to_date,'[]')&&daterange(start_date,end_date,'[]')) then raise exception 'A pending or approved leave request already overlaps these dates'; end if;
  normalized_type:=case when allocation_count>1 then 'Mixed Leave' else allocations->0->>'leave_type' end;
  insert into hr_leave_requests(employee_id,leave_type,leave_allocations,from_date,to_date,days,day_fraction,reason)
  values(eid,normalized_type,allocations,start_date,end_date,requested_days,fraction,trim(payload->>'reason')) returning id into lid;
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'LEAVE_REQUESTED','hrms',jsonb_build_object('leave_id',lid,'days',requested_days,'allocations',allocations));
  return lid;
end$$;

create or replace function public.hr_decide_leave(leave_uuid uuid,decision text,decision_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare request_record record; allocation record; policy_record record; available_balance numeric(7,2); all_paid boolean:=true;
begin
  if public.current_staff_role()<>'HR_ADMIN' or not public.has_permission('hr.approve') then raise exception 'Only HR can approve or reject leave'; end if;
  if decision not in('APPROVED','REJECTED') then raise exception 'Invalid decision'; end if;
  select * into request_record from hr_leave_requests where id=leave_uuid and status='PENDING' for update;
  if request_record.id is null then raise exception 'Pending leave request not found'; end if;
  if decision='APPROVED' then
    if exists(select 1 from hr_attendance where employee_id=request_record.employee_id and attendance_date between request_record.from_date and request_record.to_date and clock_in is not null) then raise exception 'Attendance is already recorded for one or more requested dates'; end if;
    perform hr_refresh_leave_balances(request_record.employee_id,request_record.to_date);
    for allocation in select value from jsonb_array_elements(case when jsonb_array_length(request_record.leave_allocations)>0 then request_record.leave_allocations else jsonb_build_array(jsonb_build_object('leave_type',request_record.leave_type,'days',request_record.days)) end) loop
      select * into policy_record from hr_leave_policies where leave_type=allocation.value->>'leave_type' and is_active;
      if policy_record.leave_type is null then raise exception 'A selected leave policy is inactive'; end if;
      all_paid:=all_paid and policy_record.is_paid;
      if policy_record.is_paid then
        select closing_balance into available_balance from hr_leave_balance_ledger
        where employee_id=request_record.employee_id and leave_type=allocation.value->>'leave_type' and period_start<=date_trunc('month',request_record.to_date)::date order by period_start desc limit 1;
        if coalesce(available_balance,0)<(allocation.value->>'days')::numeric then raise exception 'Insufficient % balance',allocation.value->>'leave_type'; end if;
      end if;
    end loop;
  end if;
  update hr_leave_requests set status=decision,approved_by=auth.uid(),approved_at=now(),decision_note=hr_decide_leave.decision_note where id=leave_uuid;
  if decision='APPROVED' then
    insert into hr_attendance(employee_id,attendance_date,status,source,approved_by)
    select request_record.employee_id,leave_day::date,case when all_paid then 'PAID_LEAVE' else 'UNPAID_LEAVE' end,'MANUAL',auth.uid()
    from generate_series(request_record.from_date,request_record.to_date,interval '1 day') leave_day
    on conflict(employee_id,attendance_date) do update set status=excluded.status,approved_by=excluded.approved_by;
    perform hr_refresh_leave_balances(request_record.employee_id,request_record.to_date);
  end if;
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'LEAVE_'||decision,'hrms',jsonb_build_object('leave_id',leave_uuid,'reason',decision_note));
end$$;

revoke all on function public.hr_refresh_leave_balances(uuid,date),public.hr_request_leave(jsonb),public.hr_decide_leave(uuid,text,text) from public;
grant execute on function public.hr_request_leave(jsonb),public.hr_decide_leave(uuid,text,text) to authenticated;
