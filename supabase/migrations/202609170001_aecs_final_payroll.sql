-- AECS Nepal payroll: final BS-calendar implementation backed by live HRMS data.

alter table public.hr_employees
  add column if not exists payroll_eligible boolean not null default true,
  add column if not exists exit_date date;

create table if not exists public.hr_payroll_profiles(
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  country_code text not null default 'NP',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.hr_employees add column if not exists payroll_profile_id uuid references public.hr_payroll_profiles(id);

create table if not exists public.hr_payroll_settings(
  profile_id uuid primary key references public.hr_payroll_profiles(id) on delete cascade,
  tds_status text not null default 'ACTIVE' check(tds_status in('ACTIVE','NOT_APPLICABLE','DISABLED')),
  tds_basis text not null default 'GROSS' check(tds_basis in('GROSS')),
  tds_rate numeric(8,6) not null default .01 check(tds_rate between 0 and 1),
  ssf_status text not null default 'NOT_APPLICABLE' check(ssf_status in('ACTIVE','NOT_APPLICABLE','DISABLED')),
  epf_status text not null default 'NOT_APPLICABLE' check(epf_status in('ACTIVE','NOT_APPLICABLE','DISABLED')),
  cit_status text not null default 'NOT_APPLICABLE' check(cit_status in('ACTIVE','NOT_APPLICABLE','DISABLED')),
  overtime_status text not null default 'DISABLED' check(overtime_status in('ACTIVE','DISABLED','REQUIRES_APPROVAL')),
  bonus_status text not null default 'REQUIRES_APPROVAL' check(bonus_status in('ACTIVE','DISABLED','REQUIRES_APPROVAL')),
  festival_status text not null default 'REQUIRES_APPROVAL' check(festival_status in('ACTIVE','DISABLED','REQUIRES_APPROVAL')),
  minimum_wage_status text not null default 'DISABLED' check(minimum_wage_status in('ACTIVE','DISABLED','REQUIRES_APPROVAL')),
  calculation_precision integer not null default 3 check(calculation_precision between 2 and 6),
  payment_rounding integer not null default 0 check(payment_rounding between 0 and 2),
  version integer not null default 1,
  updated_by uuid references public.staff_profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_bs_calendar(
  ad_date date primary key,
  bs_date text not null unique check(bs_date ~ '^\\d{4}-\\d{2}-\\d{2}$'),
  bs_fiscal_year text not null,
  bs_month smallint not null check(bs_month between 1 and 12),
  bs_day smallint not null check(bs_day between 1 and 32),
  day_type text not null default 'WORKING_DAY' check(day_type in('WORKING_DAY','WEEKLY_OFF','HOLIDAY')),
  holiday_name text,
  payroll_eligible_day boolean generated always as(day_type='WORKING_DAY') stored,
  calendar_status text not null default 'ACTIVE' check(calendar_status in('DRAFT','REVIEWED','APPROVED','ACTIVE','CLOSED')),
  approved_by uuid references public.staff_profiles(id),
  approved_at timestamptz
);

create table if not exists public.hr_attendance_periods(
  id uuid primary key default gen_random_uuid(),
  bs_fiscal_year text not null,
  bs_month smallint not null check(bs_month between 1 and 12),
  period_start date not null,
  period_end date not null check(period_end>=period_start),
  status text not null default 'OPEN' check(status in('OPEN','READY_TO_CLOSE','CLOSED','FROZEN_PENDING_CLOSE','LOCKED')),
  closed_by uuid references public.staff_profiles(id),
  closed_at timestamptz,
  remarks text,
  unique(bs_fiscal_year,bs_month)
);

alter table public.hr_payroll_runs drop constraint if exists hr_payroll_runs_status_check;
alter table public.hr_payroll_runs add constraint hr_payroll_runs_status_check
  check(status in('DRAFT','REVIEWED','APPROVED','FINALIZED','PAID','REVERSED','CANCELLED','PENDING_APPROVAL'));
alter table public.hr_payroll_runs
  add column if not exists bs_fiscal_year text,
  add column if not exists bs_month smallint check(bs_month between 1 and 12),
  add column if not exists calculation_bs_date text,
  add column if not exists reviewed_by uuid references public.staff_profiles(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists finalized_by uuid references public.staff_profiles(id),
  add column if not exists finalized_at timestamptz,
  add column if not exists reversed_by uuid references public.staff_profiles(id),
  add column if not exists reversed_at timestamptz,
  add column if not exists reversal_reason text,
  add column if not exists rule_snapshot jsonb not null default '{}'::jsonb;

alter table public.hr_payroll_items
  add column if not exists monthly_base_salary numeric(14,2) not null default 0,
  add column if not exists scheduled_working_days numeric(6,2) not null default 0,
  add column if not exists payable_days numeric(6,2) not null default 0,
  add column if not exists non_payable_days numeric(6,2) not null default 0,
  add column if not exists attendance_deduction numeric(14,2) not null default 0,
  add column if not exists other_deduction numeric(14,2) not null default 0;

drop view if exists public.hr_report_payroll;
alter table public.hr_payroll_items drop column if exists net_salary;
alter table public.hr_payroll_items add column net_salary numeric(14,2)
  generated always as(basic_salary+allowance+commission-ssf_deduction-cit_deduction-tds_tax-other_deduction) stored;
create view public.hr_report_payroll with(security_invoker=true) as
select i.id,e.employee_code,e.full_name,r.bs_fiscal_year,r.bs_month,r.period_start,r.period_end,r.status,
  i.monthly_base_salary,i.scheduled_working_days,i.payable_days,i.attendance_deduction,
  i.gross_salary,i.tds_tax,i.other_deduction,i.net_salary
from public.hr_payroll_items i join public.hr_payroll_runs r on r.id=i.payroll_run_id join public.hr_employees e on e.id=i.employee_id;

create table if not exists public.hr_payroll_approval_log(
  id bigint generated always as identity primary key,
  payroll_run_id uuid not null references public.hr_payroll_runs(id) on delete cascade,
  from_status text,
  to_status text not null,
  acted_by uuid not null references public.staff_profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_payroll_payments(
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.hr_payroll_runs(id),
  payment_reference text not null,
  amount numeric(16,2) not null check(amount>=0),
  paid_by uuid not null references public.staff_profiles(id),
  paid_at timestamptz not null default now(),
  unique(payroll_run_id,payment_reference)
);

create table if not exists public.hr_payroll_adjustments(
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id),
  bs_fiscal_year text not null,
  bs_month smallint not null check(bs_month between 1 and 12),
  adjustment_type text not null check(adjustment_type in('ALLOWANCE','BONUS','FESTIVAL','OVERTIME','EARNING','DEDUCTION','REVERSAL')),
  amount numeric(14,2) not null check(amount>0),
  reason text not null,
  status text not null default 'PENDING' check(status in('PENDING','APPROVED','REJECTED','APPLIED')),
  requested_by uuid not null references public.staff_profiles(id),
  approved_by uuid references public.staff_profiles(id),
  approved_at timestamptz,
  payroll_run_id uuid references public.hr_payroll_runs(id),
  created_at timestamptz not null default now()
);

insert into public.hr_payroll_profiles(code,name,country_code,is_active)
values('AECS_NEPAL_OFFICE','AECS Nepal Office','NP',true)
on conflict(code) do update set name=excluded.name,is_active=true;

insert into public.hr_payroll_settings(profile_id)
select id from public.hr_payroll_profiles where code='AECS_NEPAL_OFFICE'
on conflict(profile_id) do update set
  tds_status='ACTIVE',tds_basis='GROSS',tds_rate=.01,
  ssf_status='NOT_APPLICABLE',epf_status='NOT_APPLICABLE',cit_status='NOT_APPLICABLE',
  overtime_status='DISABLED',bonus_status='REQUIRES_APPROVAL',festival_status='REQUIRES_APPROVAL',minimum_wage_status='DISABLED';

update public.hr_employees set payroll_profile_id=(select id from public.hr_payroll_profiles where code='AECS_NEPAL_OFFICE')
where payroll_profile_id is null;

insert into public.permissions(role,permission_name,enabled)
select role,permission_name,true from (values
  ('HR_ADMIN'::public.staff_role,'attendance.close_month'),
  ('HR_ADMIN'::public.staff_role,'payroll.prepare'),
  ('FINANCE'::public.staff_role,'payroll.prepare'),
  ('ACCOUNTANT'::public.staff_role,'payroll.prepare'),
  ('FINANCE'::public.staff_role,'payroll.review'),
  ('ACCOUNTANT'::public.staff_role,'payroll.review'),
  ('DIRECTOR'::public.staff_role,'payroll.approve'),
  ('DIRECTOR'::public.staff_role,'payroll.finalize'),
  ('DIRECTOR'::public.staff_role,'payroll.reverse'),
  ('FINANCE'::public.staff_role,'payroll.pay'),
  ('ACCOUNTANT'::public.staff_role,'payroll.pay'),
  ('DIRECTOR'::public.staff_role,'payroll.sensitive.view'),
  ('HR_ADMIN'::public.staff_role,'payroll.sensitive.view'),
  ('FINANCE'::public.staff_role,'payroll.sensitive.view'),
  ('ACCOUNTANT'::public.staff_role,'payroll.sensitive.view'),
  ('DIRECTOR'::public.staff_role,'payroll.export'),
  ('FINANCE'::public.staff_role,'payroll.export'),
  ('ACCOUNTANT'::public.staff_role,'payroll.export')
) p(role,permission_name)
on conflict(role,permission_name) do update set enabled=true;

-- Admin retains full operational authority in the current CRM authorization model.
insert into public.permissions(role,permission_name,enabled)
select 'ADMIN'::public.staff_role,p,true from unnest(array[
  'attendance.close_month','payroll.prepare','payroll.review','payroll.approve','payroll.finalize',
  'payroll.reverse','payroll.pay','payroll.sensitive.view','payroll.export'
]) p on conflict(role,permission_name) do update set enabled=true;

do $$ declare t text; begin
  foreach t in array array['hr_payroll_profiles','hr_payroll_settings','hr_bs_calendar','hr_attendance_periods','hr_payroll_approval_log','hr_payroll_payments','hr_payroll_adjustments'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I',t||'_read',t);
    execute format('create policy %I on public.%I for select to authenticated using(public.has_permission(''payroll.view'') or public.has_permission(''payroll.manage''))',t||'_read',t);
  end loop;
end $$;

create or replace function public.hr_close_attendance_period(
  fiscal_year text,month_number integer,period_start_date date,period_end_date date,start_bs_date text,end_bs_date text,close_note text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare period_id uuid; d date; day_number integer; pending_count integer;
begin
  if not public.has_permission('attendance.close_month') and not public.has_permission('payroll.prepare') then raise exception 'Attendance close permission required'; end if;
  if period_end_date<period_start_date or month_number not between 1 and 12 then raise exception 'Invalid payroll period'; end if;
  select count(*) into pending_count from hr_attendance_corrections where status='PENDING' and attendance_date between period_start_date and period_end_date;
  if pending_count>0 then raise exception 'Resolve % pending attendance correction(s) before closing the month',pending_count; end if;
  day_number:=split_part(start_bs_date,'-',3)::integer;
  d:=period_start_date;
  while d<=period_end_date loop
    insert into hr_bs_calendar(ad_date,bs_date,bs_fiscal_year,bs_month,bs_day,day_type,calendar_status,approved_by,approved_at)
    values(d,split_part(start_bs_date,'-',1)||'-'||lpad(month_number::text,2,'0')||'-'||lpad(day_number::text,2,'0'),fiscal_year,month_number,day_number,
      case when extract(isodow from d)=6 then 'WEEKLY_OFF' else 'WORKING_DAY' end,'ACTIVE',auth.uid(),now())
    on conflict(ad_date) do update set bs_fiscal_year=excluded.bs_fiscal_year,bs_month=excluded.bs_month,bs_day=excluded.bs_day,calendar_status='ACTIVE';
    d:=d+1; day_number:=day_number+1;
  end loop;
  insert into hr_attendance_periods(bs_fiscal_year,bs_month,period_start,period_end,status,closed_by,closed_at,remarks)
  values(fiscal_year,month_number,period_start_date,period_end_date,'LOCKED',auth.uid(),now(),close_note)
  on conflict(bs_fiscal_year,bs_month) do update set period_start=excluded.period_start,period_end=excluded.period_end,status='LOCKED',closed_by=auth.uid(),closed_at=now(),remarks=excluded.remarks
  returning id into period_id;
  return period_id;
end $$;

create or replace function public.hr_generate_bs_payroll(fiscal_year text,month_number integer,calculation_bs text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p hr_attendance_periods%rowtype; profile hr_payroll_profiles%rowtype; settings hr_payroll_settings%rowtype; run_id uuid; emp record;
  scheduled numeric; payable numeric; base_pay numeric; allowance_total numeric; earning_total numeric; deduction_total numeric; gross_total numeric:=0; net_total numeric:=0; tax numeric; item_gross numeric; item_net numeric; employee_count integer:=0;
begin
  if not public.has_permission('payroll.prepare') and not public.has_permission('payroll.manage') then raise exception 'Payroll preparation permission required'; end if;
  select * into p from hr_attendance_periods where bs_fiscal_year=fiscal_year and bs_month=month_number and status='LOCKED';
  if not found then raise exception 'Attendance period must be closed and locked before payroll generation'; end if;
  select * into profile from hr_payroll_profiles where code='AECS_NEPAL_OFFICE' and is_active;
  select * into settings from hr_payroll_settings where profile_id=profile.id;
  if settings.profile_id is null then raise exception 'AECS payroll settings are incomplete'; end if;
  select count(*)::numeric into scheduled from hr_bs_calendar where bs_fiscal_year=fiscal_year and bs_month=month_number and payroll_eligible_day;
  if scheduled<=0 then raise exception 'No scheduled working days exist in the active BS calendar'; end if;
  insert into hr_payroll_runs(period_start,period_end,status,prepared_by,bs_fiscal_year,bs_month,calculation_bs_date,rule_snapshot)
  values(p.period_start,p.period_end,'DRAFT',auth.uid(),fiscal_year,month_number,calculation_bs,jsonb_build_object('profile',profile.code,'version',settings.version,'tds_rate',settings.tds_rate,'tds_basis',settings.tds_basis,'ssf',settings.ssf_status,'epf',settings.epf_status,'cit',settings.cit_status,'scheduled_working_days',scheduled))
  on conflict(period_start,period_end) do update set status='DRAFT',prepared_by=auth.uid(),bs_fiscal_year=fiscal_year,bs_month=month_number,calculation_bs_date=calculation_bs,rule_snapshot=excluded.rule_snapshot
  returning id into run_id;
  delete from hr_payroll_items where payroll_run_id=run_id;
  for emp in select * from hr_employees where payroll_eligible and payroll_profile_id=profile.id and employment_status in('ACTIVE','ON_LEAVE','PROBATION') and join_date<=p.period_end and (exit_date is null or exit_date>=p.period_start) loop
    select coalesce(sum(case a.status when 'PRESENT' then 1 when 'LATE' then 1 when 'HOLIDAY' then 1 when 'WEEKLY_OFF' then 0 when 'HALF_DAY' then .5 when 'PAID_LEAVE' then 1 when 'ON_LEAVE' then 1 else 0 end),0)
      into payable from hr_attendance a join hr_bs_calendar c on c.ad_date=a.attendance_date and c.payroll_eligible_day
      where a.employee_id=emp.id and a.attendance_date between p.period_start and p.period_end;
    base_pay:=round(emp.base_salary*(least(payable,scheduled)/scheduled),settings.calculation_precision);
    select coalesce(sum(amount),0) into allowance_total from hr_salary_components where employee_id=emp.id and component_type='ALLOWANCE' and effective_from<=p.period_end and (effective_to is null or effective_to>=p.period_start);
    select coalesce(sum(amount),0) into earning_total from hr_salary_components where employee_id=emp.id and component_type='COMMISSION' and effective_from<=p.period_end and (effective_to is null or effective_to>=p.period_start);
    select coalesce(sum(case when adjustment_type='DEDUCTION' then amount else 0 end),0),coalesce(sum(case when adjustment_type<>'DEDUCTION' then amount else 0 end),0)
      into deduction_total,item_gross from hr_payroll_adjustments where employee_id=emp.id and bs_fiscal_year=fiscal_year and bs_month=month_number and status='APPROVED';
    earning_total:=earning_total+item_gross;
    item_gross:=base_pay+allowance_total+earning_total;
    tax:=case when settings.tds_status='ACTIVE' then round(item_gross*settings.tds_rate,settings.calculation_precision) else 0 end;
    item_net:=round(item_gross-tax-deduction_total,settings.payment_rounding);
    insert into hr_payroll_items(payroll_run_id,employee_id,basic_salary,monthly_base_salary,scheduled_working_days,payable_days,non_payable_days,attendance_deduction,allowance,commission,ssf_deduction,cit_deduction,tds_tax,other_deduction)
    values(run_id,emp.id,base_pay,emp.base_salary,scheduled,payable,greatest(scheduled-payable,0),greatest(emp.base_salary-base_pay,0),allowance_total,earning_total,0,0,tax,deduction_total);
    update hr_payroll_adjustments set status='APPLIED',payroll_run_id=run_id where employee_id=emp.id and bs_fiscal_year=fiscal_year and bs_month=month_number and status='APPROVED';
    employee_count:=employee_count+1; gross_total:=gross_total+item_gross; net_total:=net_total+item_net;
  end loop;
  insert into hr_payroll_approval_log(payroll_run_id,from_status,to_status,acted_by,note) values(run_id,null,'DRAFT',auth.uid(),'Generated from locked attendance and live employee payroll data');
  return jsonb_build_object('run_id',run_id,'employee_count',employee_count,'gross_total',round(gross_total,2),'net_total',round(net_total,2),'status','DRAFT');
end $$;

create or replace function public.hr_transition_bs_payroll(run_uuid uuid,next_status text,note text default null,payment_reference text default null)
returns void language plpgsql security definer set search_path=public as $$
declare r hr_payroll_runs%rowtype; needed_permission text; total_net numeric;
begin
  select * into r from hr_payroll_runs where id=run_uuid for update;
  if not found then raise exception 'Payroll run not found'; end if;
  if r.status in('FINALIZED','PAID') and next_status not in('PAID','REVERSED') then raise exception 'Finalized payroll is immutable; use a linked reversal'; end if;
  if (r.status,next_status) not in (('DRAFT','REVIEWED'),('REVIEWED','APPROVED'),('APPROVED','FINALIZED'),('FINALIZED','PAID'),('FINALIZED','REVERSED'),('PAID','REVERSED')) then raise exception 'Invalid payroll transition from % to %',r.status,next_status; end if;
  needed_permission:=case next_status when 'REVIEWED' then 'payroll.review' when 'APPROVED' then 'payroll.approve' when 'FINALIZED' then 'payroll.finalize' when 'PAID' then 'payroll.pay' when 'REVERSED' then 'payroll.reverse' end;
  if not public.has_permission(needed_permission) and not public.has_permission('payroll.manage') then raise exception '% permission required',needed_permission; end if;
  if auth.uid()=r.prepared_by and next_status in('REVIEWED','APPROVED','FINALIZED') then raise exception 'Maker-checker control: the preparer cannot review, approve, or finalize this run'; end if;
  if next_status='APPROVED' and auth.uid()=r.reviewed_by then raise exception 'The reviewer cannot approve the same payroll run'; end if;
  if next_status='FINALIZED' and auth.uid() in(r.reviewed_by,r.approved_by) then raise exception 'The finalizer must be independent of the reviewer and approver'; end if;
  if next_status='PAID' and coalesce(trim(payment_reference),'')='' then raise exception 'Payment reference is required'; end if;
  if next_status='REVERSED' and coalesce(trim(note),'')='' then raise exception 'A reversal reason is required'; end if;
  update hr_payroll_runs set status=next_status,
    reviewed_by=case when next_status='REVIEWED' then auth.uid() else reviewed_by end,reviewed_at=case when next_status='REVIEWED' then now() else reviewed_at end,
    approved_by=case when next_status='APPROVED' then auth.uid() else approved_by end,approved_at=case when next_status='APPROVED' then now() else approved_at end,
    finalized_by=case when next_status='FINALIZED' then auth.uid() else finalized_by end,finalized_at=case when next_status='FINALIZED' then now() else finalized_at end,
    paid_at=case when next_status='PAID' then now() else paid_at end,payment_reference=case when next_status='PAID' then $4 else hr_payroll_runs.payment_reference end,
    reversed_by=case when next_status='REVERSED' then auth.uid() else reversed_by end,reversed_at=case when next_status='REVERSED' then now() else reversed_at end,reversal_reason=case when next_status='REVERSED' then note else reversal_reason end
  where id=run_uuid;
  insert into hr_payroll_approval_log(payroll_run_id,from_status,to_status,acted_by,note) values(run_uuid,r.status,next_status,auth.uid(),note);
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'PAYROLL_'||next_status,'hrms',jsonb_build_object('payroll_run_id',run_uuid,'from_status',r.status,'to_status',next_status,'payment_reference',case when next_status='PAID' then $4 else null end));
  if next_status='PAID' then
    select coalesce(sum(net_salary),0) into total_net from hr_payroll_items where payroll_run_id=run_uuid;
    insert into hr_payroll_payments(payroll_run_id,payment_reference,amount,paid_by) values(run_uuid,payment_reference,total_net,auth.uid());
  end if;
end $$;

revoke all on function public.hr_close_attendance_period(text,integer,date,date,text,text,text) from public;
revoke all on function public.hr_generate_bs_payroll(text,integer,text) from public;
revoke all on function public.hr_transition_bs_payroll(uuid,text,text,text) from public;
grant execute on function public.hr_close_attendance_period(text,integer,date,date,text,text,text) to authenticated;
grant execute on function public.hr_generate_bs_payroll(text,integer,text) to authenticated;
grant execute on function public.hr_transition_bs_payroll(uuid,text,text,text) to authenticated;
