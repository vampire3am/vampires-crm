-- Configuration-driven leave policy, monthly accrual ledger and HR-only decisions.
insert into public.permissions(role,permission_name,enabled)
select 'HR_ADMIN'::public.staff_role, permission_name, true
from (values
  ('hr.view'),('hr.manage'),('hr.approve'),('hr.self_service'),
  ('payroll.view'),('payroll.manage'),('reports.view'),('audit.view')
) p(permission_name)
on conflict(role,permission_name) do update set enabled=excluded.enabled;

update public.permissions
set enabled=false
where role in ('ADMIN','DIRECTOR') and permission_name='hr.approve';

create table if not exists public.hr_leave_policies(
  leave_type text primary key,
  monthly_credit numeric(5,2) not null default 0 check(monthly_credit>=0),
  is_paid boolean not null default true,
  allow_half_day boolean not null default true,
  monthly_carry_forward boolean not null default true,
  year_end_action text not null default 'RESET' check(year_end_action in('RESET','CARRY_FORWARD')),
  max_year_end_carry numeric(6,2) check(max_year_end_carry is null or max_year_end_carry>=0),
  medical_document_after_days numeric(5,2),
  is_active boolean not null default true,
  updated_by uuid references public.staff_profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.hr_leave_policies(
  leave_type,monthly_credit,is_paid,allow_half_day,monthly_carry_forward,
  year_end_action,max_year_end_carry,medical_document_after_days
) values
  ('Annual Leave',0.5,true,true,true,'CARRY_FORWARD',6,null),
  ('Casual Leave',0.5,true,true,true,'RESET',0,null),
  ('Sick Leave',1,true,true,true,'RESET',0,2),
  ('Unpaid Leave',0,false,true,false,'RESET',0,null)
on conflict(leave_type) do nothing;

alter table public.hr_leave_requests
  add column if not exists day_fraction numeric(3,2) not null default 1 check(day_fraction in(0.5,1)),
  add column if not exists approved_at timestamptz;

alter table public.hr_attendance drop constraint if exists hr_attendance_status_check;
alter table public.hr_attendance add constraint hr_attendance_status_check
check(status in('PRESENT','LATE','HALF_DAY','PAID_LEAVE','UNPAID_LEAVE','HOLIDAY','WEEKLY_OFF','ABSENT','ON_LEAVE'));

create table if not exists public.hr_leave_balance_ledger(
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  leave_type text not null references public.hr_leave_policies(leave_type),
  period_start date not null check(period_start=date_trunc('month',period_start)::date),
  opening_balance numeric(7,2) not null default 0,
  credited numeric(7,2) not null default 0,
  adjusted numeric(7,2) not null default 0,
  used numeric(7,2) not null default 0,
  closing_balance numeric(7,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique(employee_id,leave_type,period_start)
);

alter table public.hr_leave_policies enable row level security;
alter table public.hr_leave_balance_ledger enable row level security;
drop policy if exists hr_leave_policy_read on public.hr_leave_policies;
create policy hr_leave_policy_read on public.hr_leave_policies for select to authenticated using(true);
drop policy if exists hr_leave_policy_manage on public.hr_leave_policies;
create policy hr_leave_policy_manage on public.hr_leave_policies for all to authenticated using(public.has_permission('hr.manage')) with check(public.has_permission('hr.manage'));
drop policy if exists hr_leave_ledger_read on public.hr_leave_balance_ledger;
create policy hr_leave_ledger_read on public.hr_leave_balance_ledger for select to authenticated using(
  public.has_permission('hr.view') or employee_id in(select id from public.hr_employees where staff_profile_id=auth.uid())
);

create or replace function public.hr_refresh_leave_balances(employee_uuid uuid, through_date date default current_date)
returns void language plpgsql security definer set search_path=public as $$
declare
  employee_record record;
  policy_record record;
  month_cursor date;
  first_month date;
  previous_closing numeric(7,2);
  month_used numeric(7,2);
  month_adjustment numeric(7,2);
  month_opening numeric(7,2);
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
      else
        month_opening:=case when policy_record.monthly_carry_forward then previous_closing else 0 end;
      end if;
      select coalesce(adjusted,0) into month_adjustment from hr_leave_balance_ledger
      where employee_id=employee_uuid and leave_type=policy_record.leave_type and period_start=month_cursor;
      month_adjustment:=coalesce(month_adjustment,0);
      select coalesce(sum(case when l.from_date=l.to_date then l.day_fraction else 1 end),0)
      into month_used
      from hr_leave_requests l
      cross join lateral generate_series(l.from_date,l.to_date,interval '1 day') leave_day
      where l.employee_id=employee_uuid and l.leave_type=policy_record.leave_type and l.status='APPROVED'
        and leave_day::date>=month_cursor and leave_day::date<(month_cursor+interval '1 month')::date;
      insert into hr_leave_balance_ledger(employee_id,leave_type,period_start,opening_balance,credited,adjusted,used,closing_balance)
      values(employee_uuid,policy_record.leave_type,month_cursor,month_opening,policy_record.monthly_credit,month_adjustment,month_used,
        greatest(0,month_opening+policy_record.monthly_credit+month_adjustment-month_used))
      on conflict(employee_id,leave_type,period_start) do update set
        opening_balance=excluded.opening_balance,credited=excluded.credited,used=excluded.used,
        closing_balance=excluded.closing_balance,updated_at=now();
      month_cursor:=(month_cursor+interval '1 month')::date;
    end loop;
  end loop;
end$$;

create or replace function public.hr_leave_balance_summary()
returns table(employee_id uuid,employee_code text,full_name text,leave_type text,monthly_credit numeric,
  period_start date,opening_balance numeric,credited numeric,adjusted numeric,used numeric,closing_balance numeric,
  is_paid boolean,allow_half_day boolean,year_end_action text,max_year_end_carry numeric)
language plpgsql security definer set search_path=public as $$
declare employee_record record;
begin
  for employee_record in
    select e.id from hr_employees e
    where e.employment_status in('ACTIVE','PROBATION','ON_LEAVE')
      and (public.has_permission('hr.view') or e.staff_profile_id=auth.uid())
  loop perform hr_refresh_leave_balances(employee_record.id,current_date); end loop;
  return query
  select e.id,e.employee_code,e.full_name,p.leave_type,p.monthly_credit,l.period_start,
    l.opening_balance,l.credited,l.adjusted,l.used,l.closing_balance,p.is_paid,p.allow_half_day,
    p.year_end_action,p.max_year_end_carry
  from hr_employees e cross join hr_leave_policies p
  left join lateral(
    select x.* from hr_leave_balance_ledger x where x.employee_id=e.id and x.leave_type=p.leave_type
    order by x.period_start desc limit 1
  ) l on true
  where p.is_active and (public.has_permission('hr.view') or e.staff_profile_id=auth.uid())
  order by e.full_name,p.leave_type;
end$$;

create or replace function public.hr_save_leave_policy(policy_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission('hr.manage') then raise exception 'HR configuration permission required'; end if;
  update hr_leave_policies set
    monthly_credit=coalesce((policy_payload->>'monthly_credit')::numeric,monthly_credit),
    allow_half_day=coalesce((policy_payload->>'allow_half_day')::boolean,allow_half_day),
    monthly_carry_forward=coalesce((policy_payload->>'monthly_carry_forward')::boolean,monthly_carry_forward),
    year_end_action=coalesce(policy_payload->>'year_end_action',year_end_action),
    max_year_end_carry=case when policy_payload ? 'max_year_end_carry' then (policy_payload->>'max_year_end_carry')::numeric else max_year_end_carry end,
    medical_document_after_days=case when policy_payload ? 'medical_document_after_days' then (policy_payload->>'medical_document_after_days')::numeric else medical_document_after_days end,
    updated_by=auth.uid(),updated_at=now()
  where leave_type=policy_payload->>'leave_type';
  if not found then raise exception 'Leave policy not found'; end if;
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'LEAVE_POLICY_UPDATED','hrms',policy_payload);
end$$;

create or replace function public.hr_request_leave(payload jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare eid uuid; lid uuid; start_date date; end_date date; requested_days numeric(5,1); fraction numeric(3,2); normalized_type text;
begin
  if public.current_staff_role()='ADMIN' then raise exception 'Administrators review configuration and cannot submit leave'; end if;
  select id into eid from hr_employees where staff_profile_id=auth.uid() and employment_status in('ACTIVE','PROBATION','ON_LEAVE');
  if eid is null then raise exception 'Active employee record not found for this login'; end if;
  start_date:=(payload->>'from_date')::date; end_date:=(payload->>'to_date')::date;
  if end_date<start_date then raise exception 'Leave end date cannot be before the start date'; end if;
  fraction:=case when payload->>'duration'='HALF_DAY' then 0.5 else 1 end;
  if fraction=0.5 and end_date<>start_date then raise exception 'Half-day leave must use one date'; end if;
  requested_days:=case when fraction=0.5 then 0.5 else (end_date-start_date)+1 end;
  normalized_type:=case payload->>'leave_type' when 'Sick / Medical' then 'Sick Leave' else payload->>'leave_type' end;
  if not exists(select 1 from hr_leave_policies where leave_type=normalized_type and is_active) then raise exception 'Select an active company leave type'; end if;
  if nullif(trim(payload->>'reason'),'') is null then raise exception 'Leave reason is required'; end if;
  if exists(select 1 from hr_leave_requests where employee_id=eid and status in('PENDING','APPROVED') and daterange(from_date,to_date,'[]')&&daterange(start_date,end_date,'[]')) then
    raise exception 'A pending or approved leave request already overlaps these dates';
  end if;
  insert into hr_leave_requests(employee_id,leave_type,from_date,to_date,days,day_fraction,reason)
  values(eid,normalized_type,start_date,end_date,requested_days,fraction,trim(payload->>'reason')) returning id into lid;
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'LEAVE_REQUESTED','hrms',jsonb_build_object('leave_id',lid,'days',requested_days,'leave_type',normalized_type));
  return lid;
end$$;

create or replace function public.hr_decide_leave(leave_uuid uuid,decision text,decision_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare request_record record; policy_record record; available_balance numeric(7,2);
begin
  if public.current_staff_role()<>'HR_ADMIN' or not public.has_permission('hr.approve') then raise exception 'Only HR can approve or reject leave'; end if;
  if decision not in('APPROVED','REJECTED') then raise exception 'Invalid decision'; end if;
  select * into request_record from hr_leave_requests where id=leave_uuid and status='PENDING' for update;
  if request_record.id is null then raise exception 'Pending leave request not found'; end if;
  if decision='APPROVED' then
    select * into policy_record from hr_leave_policies where leave_type=request_record.leave_type and is_active;
    if policy_record.leave_type is null then raise exception 'Leave policy is inactive'; end if;
    if exists(select 1 from hr_attendance where employee_id=request_record.employee_id and attendance_date between request_record.from_date and request_record.to_date and clock_in is not null) then
      raise exception 'Attendance is already recorded for one or more requested dates';
    end if;
    if policy_record.is_paid then
      perform hr_refresh_leave_balances(request_record.employee_id,request_record.to_date);
      select closing_balance into available_balance from hr_leave_balance_ledger
      where employee_id=request_record.employee_id and leave_type=request_record.leave_type and period_start<=date_trunc('month',request_record.to_date)::date
      order by period_start desc limit 1;
      if coalesce(available_balance,0)<request_record.days then raise exception 'Insufficient paid leave balance. Use Unpaid Leave instead'; end if;
    end if;
  end if;
  update hr_leave_requests set status=decision,approved_by=auth.uid(),approved_at=now(),decision_note=hr_decide_leave.decision_note where id=leave_uuid;
  if decision='APPROVED' then
    insert into hr_attendance(employee_id,attendance_date,status,source,approved_by)
    select request_record.employee_id,leave_day::date,case when policy_record.is_paid then 'PAID_LEAVE' else 'UNPAID_LEAVE' end,'MANUAL',auth.uid()
    from generate_series(request_record.from_date,request_record.to_date,interval '1 day') leave_day
    on conflict(employee_id,attendance_date) do update set status=excluded.status,approved_by=excluded.approved_by;
    perform hr_refresh_leave_balances(request_record.employee_id,request_record.to_date);
  end if;
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'LEAVE_'||decision,'hrms',jsonb_build_object('leave_id',leave_uuid,'reason',decision_note));
end$$;

revoke all on function public.hr_refresh_leave_balances(uuid,date),public.hr_leave_balance_summary(),public.hr_save_leave_policy(jsonb),public.hr_request_leave(jsonb),public.hr_decide_leave(uuid,text,text) from public;
grant execute on function public.hr_leave_balance_summary(),public.hr_request_leave(jsonb) to authenticated;
grant execute on function public.hr_save_leave_policy(jsonb),public.hr_decide_leave(uuid,text,text) to authenticated;
