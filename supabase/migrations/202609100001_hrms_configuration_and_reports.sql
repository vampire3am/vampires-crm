begin;

-- Complete, effective-dated HRMS configuration foundation. Statutory figures
-- are versioned and seeded as DRAFT until an authorized approver activates them.
create table if not exists public.hr_departments(
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null unique,
  parent_id uuid references public.hr_departments(id), head_employee_id uuid references public.hr_employees(id),
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.hr_designations(
  id uuid primary key default gen_random_uuid(), department_id uuid references public.hr_departments(id),
  code text not null unique, name text not null, grade text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(department_id,name)
);
create table if not exists public.hr_employee_number_settings(
  id boolean primary key default true check(id), prefix text not null default 'AECS-EMP-', padding smallint not null default 4 check(padding between 2 and 10),
  next_number bigint not null default 1 check(next_number>0), include_fiscal_year boolean not null default false,
  separator text not null default '-', updated_by uuid references public.staff_profiles(id), updated_at timestamptz not null default now()
);
insert into public.hr_employee_number_settings(id) values(true) on conflict(id) do nothing;

create table if not exists public.hr_attendance_policies(
  id uuid primary key default gen_random_uuid(), name text not null, effective_from date not null, effective_to date,
  standard_daily_minutes integer not null default 480, standard_weekly_minutes integer not null default 2880,
  grace_minutes integer not null default 15, half_day_after_minutes integer, absent_after_minutes integer,
  overtime_multiplier numeric(6,3) not null default 1.5, overtime_daily_cap_minutes integer not null default 240,
  overtime_weekly_cap_minutes integer not null default 1440, overtime_requires_approval boolean not null default true,
  missing_checkout_action text not null default 'REVIEW', salary_deduction_for_lateness boolean not null default false,
  status text not null default 'DRAFT' check(status in('DRAFT','ACTIVE','RETIRED')),
  approved_by uuid references public.staff_profiles(id), approved_at timestamptz,
  created_by uuid references public.staff_profiles(id) default auth.uid(), created_at timestamptz not null default now()
);
create unique index if not exists hr_attendance_one_active on public.hr_attendance_policies((status)) where status='ACTIVE';

create table if not exists public.hr_salary_component_definitions(
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  component_type text not null check(component_type in('EARNING','DEDUCTION','EMPLOYER_CONTRIBUTION')),
  calculation_method text not null default 'FIXED' check(calculation_method in('FIXED','PERCENT_BASIC','PERCENT_GROSS','FORMULA')),
  default_value numeric(14,4) not null default 0, taxable boolean not null default true, recurring boolean not null default true,
  statutory boolean not null default false, is_active boolean not null default true, effective_from date not null default current_date,
  effective_to date, created_at timestamptz not null default now()
);
create table if not exists public.hr_payroll_policies(
  id uuid primary key default gen_random_uuid(), name text not null, fiscal_year text not null,
  effective_from date not null, effective_to date, daily_rate_method text not null default 'ACTUAL_BS_MONTH_DAYS' check(daily_rate_method in('ACTUAL_BS_MONTH_DAYS','FIXED_30')),
  rounding_method text not null default 'NET_PAY_ONLY', rounding_precision smallint not null default 0,
  minimum_monthly_pay numeric(14,2), minimum_basic_pay numeric(14,2), minimum_basic_ratio numeric(7,4),
  festival_allowance_basic_months numeric(7,3) not null default 1,
  payroll_day smallint check(payroll_day between 1 and 32), lock_after_approval boolean not null default true,
  status text not null default 'DRAFT' check(status in('DRAFT','ACTIVE','RETIRED')),
  approved_by uuid references public.staff_profiles(id), approved_at timestamptz,
  created_by uuid references public.staff_profiles(id) default auth.uid(), created_at timestamptz not null default now()
);
create unique index if not exists hr_payroll_one_active on public.hr_payroll_policies((status)) where status='ACTIVE';

create table if not exists public.hr_tax_rule_sets(
  id uuid primary key default gen_random_uuid(), name text not null, fiscal_year text not null,
  effective_from date not null, effective_to date, currency text not null default 'NPR',
  employee_ssf_rate numeric(8,5) not null default 0, employer_ssf_rate numeric(8,5) not null default 0,
  retirement_cap_amount numeric(14,2), retirement_cap_income_ratio numeric(8,5), ssf_first_band_waived boolean not null default true,
  status text not null default 'DRAFT' check(status in('DRAFT','ACTIVE','RETIRED')),
  source_reference text, approved_by uuid references public.staff_profiles(id), approved_at timestamptz,
  created_by uuid references public.staff_profiles(id) default auth.uid(), created_at timestamptz not null default now(), unique(fiscal_year,name)
);
create unique index if not exists hr_tax_one_active on public.hr_tax_rule_sets((status)) where status='ACTIVE';
create table if not exists public.hr_tax_brackets(
  id uuid primary key default gen_random_uuid(), rule_set_id uuid not null references public.hr_tax_rule_sets(id) on delete cascade,
  sequence smallint not null, lower_bound numeric(14,2) not null, upper_bound numeric(14,2), rate numeric(8,5) not null,
  unique(rule_set_id,sequence), check(upper_bound is null or upper_bound>lower_bound)
);
create table if not exists public.hr_tds_ledger(
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.hr_employees(id),
  payroll_item_id uuid references public.hr_payroll_items(id), fiscal_year text not null, period_start date not null,
  transaction_type text not null check(transaction_type in('WITHHELD','ADJUSTMENT','DEPOSIT','REFUND')),
  taxable_income numeric(14,2) not null default 0, amount numeric(14,2) not null,
  reference_no text, deposited_on date, notes text, created_by uuid references public.staff_profiles(id) default auth.uid(), created_at timestamptz not null default now()
);

create table if not exists public.hr_employment_history(
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.hr_employees(id) on delete cascade,
  effective_from date not null default current_date, effective_to date, department text, designation text,
  manager_id uuid references public.hr_employees(id), employment_type text, employment_status text, reason text,
  changed_by uuid references public.staff_profiles(id) default auth.uid(), created_at timestamptz not null default now()
);
create table if not exists public.hr_salary_history(
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.hr_employees(id) on delete cascade,
  previous_basic numeric(14,2), new_basic numeric(14,2) not null, effective_from date not null default current_date,
  reason text, approved_by uuid references public.staff_profiles(id), changed_by uuid references public.staff_profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
insert into public.hr_employment_history(employee_id,effective_from,department,designation,manager_id,employment_type,employment_status,reason)
select e.id,e.join_date,e.department,e.job_title,e.manager_id,e.employment_type,e.employment_status,'History foundation backfill'
from public.hr_employees e where not exists(select 1 from public.hr_employment_history h where h.employee_id=e.id);
insert into public.hr_salary_history(employee_id,new_basic,effective_from,reason)
select e.id,e.base_salary,e.join_date,'Salary history foundation backfill'
from public.hr_employees e where not exists(select 1 from public.hr_salary_history h where h.employee_id=e.id);

create table if not exists public.hr_kpi_templates(
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  department_id uuid references public.hr_departments(id), description text, unit text not null default 'COUNT',
  default_target numeric(14,2), weight numeric(7,4) not null default 1, is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.hr_appraisal_cycles(
  id uuid primary key default gen_random_uuid(), name text not null, period_start date not null, period_end date not null,
  self_review_due date, manager_review_due date, status text not null default 'DRAFT' check(status in('DRAFT','OPEN','MODERATION','CLOSED')),
  rating_scale jsonb not null default '[1,2,3,4,5]'::jsonb, created_by uuid references public.staff_profiles(id) default auth.uid(), created_at timestamptz not null default now()
);

create table if not exists public.hr_document_types(
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  category text not null default 'EMPLOYEE', mandatory boolean not null default false, has_expiry boolean not null default false,
  reminder_days integer[] not null default '{60,30,7}', is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.hr_contracts(
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.hr_employees(id) on delete cascade,
  contract_number text not null unique, contract_type text not null, start_date date not null, end_date date,
  document_id uuid references public.hr_staff_documents(id), status text not null default 'DRAFT' check(status in('DRAFT','ACTIVE','EXPIRED','RENEWED','TERMINATED')),
  signed_by_employee boolean not null default false, signed_by_company boolean not null default false,
  renewal_of uuid references public.hr_contracts(id), notes text, created_by uuid references public.staff_profiles(id) default auth.uid(), created_at timestamptz not null default now()
);

create table if not exists public.hr_approval_routes(
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  workflow_type text not null check(workflow_type in('LEAVE','ATTENDANCE_CORRECTION','OVERTIME','SALARY_CHANGE','PAYROLL','CONTRACT','APPRAISAL')),
  is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.hr_approval_route_steps(
  id uuid primary key default gen_random_uuid(), route_id uuid not null references public.hr_approval_routes(id) on delete cascade,
  sequence smallint not null, approver_type text not null check(approver_type in('MANAGER','ROLE','EMPLOYEE')),
  approver_value text, can_delegate boolean not null default true, unique(route_id,sequence)
);
create table if not exists public.hr_notification_rules(
  id uuid primary key default gen_random_uuid(), event_type text not null unique, title_template text not null,
  body_template text not null, channels text[] not null default '{IN_APP}', reminder_days integer[] not null default '{}',
  recipient_rule text not null default 'SUBJECT', is_active boolean not null default true, created_at timestamptz not null default now()
);

-- Configurable employee numbering replaces the fixed code format while
-- preserving existing employee codes.
create or replace function public.hr_next_employee_code() returns text
language plpgsql security definer set search_path=public as $$
declare cfg public.hr_employee_number_settings%rowtype; n bigint; fy text='';
begin
  select * into cfg from hr_employee_number_settings where id=true for update;
  n:=cfg.next_number;
  update hr_employee_number_settings set next_number=next_number+1,updated_at=now() where id=true;
  if cfg.include_fiscal_year then select coalesce(fiscal_year,'') into fy from organizations order by updated_at desc limit 1; end if;
  return cfg.prefix||case when fy<>'' then replace(fy,' ','')||cfg.separator else '' end||lpad(n::text,cfg.padding,'0');
end $$;
alter table public.hr_employees alter column employee_code set default public.hr_next_employee_code();

create or replace function public.hr_capture_employee_history() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into hr_employment_history(employee_id,effective_from,department,designation,manager_id,employment_type,employment_status,reason)
    values(new.id,new.join_date,new.department,new.job_title,new.manager_id,new.employment_type,new.employment_status,'Initial employment record');
    insert into hr_salary_history(employee_id,new_basic,effective_from,reason) values(new.id,new.base_salary,new.join_date,'Initial salary');
  else
    if (old.department,old.job_title,old.manager_id,old.employment_type,old.employment_status) is distinct from (new.department,new.job_title,new.manager_id,new.employment_type,new.employment_status) then
      insert into hr_employment_history(employee_id,department,designation,manager_id,employment_type,employment_status,reason)
      values(new.id,new.department,new.job_title,new.manager_id,new.employment_type,new.employment_status,'Employee record updated');
    end if;
    if old.base_salary is distinct from new.base_salary then
      insert into hr_salary_history(employee_id,previous_basic,new_basic,reason) values(new.id,old.base_salary,new.base_salary,'Basic salary updated');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists hr_employee_history_trigger on public.hr_employees;
create trigger hr_employee_history_trigger after insert or update on public.hr_employees for each row execute function public.hr_capture_employee_history();

create or replace function public.hr_post_paid_payroll_tds() returns trigger
language plpgsql security definer set search_path=public as $$
declare fy text;
begin
  if new.status='PAID' and old.status is distinct from 'PAID' then
    select coalesce((select fiscal_year from hr_payroll_policies where status='ACTIVE' and effective_from<=new.period_end
      and (effective_to is null or effective_to>=new.period_start) order by effective_from desc limit 1),to_char(new.period_start,'YYYY')) into fy;
    insert into hr_tds_ledger(employee_id,payroll_item_id,fiscal_year,period_start,transaction_type,taxable_income,amount,reference_no,deposited_on,notes)
    select i.employee_id,i.id,fy,new.period_start,'WITHHELD',i.gross_salary,i.tds_tax,new.payment_reference,new.paid_at::date,'Posted automatically when payroll was marked paid'
    from hr_payroll_items i where i.payroll_run_id=new.id and i.tds_tax<>0
    and not exists(select 1 from hr_tds_ledger l where l.payroll_item_id=i.id and l.transaction_type='WITHHELD');
  end if;
  return new;
end $$;
drop trigger if exists hr_paid_payroll_tds_trigger on public.hr_payroll_runs;
create trigger hr_paid_payroll_tds_trigger after update of status on public.hr_payroll_runs for each row execute function public.hr_post_paid_payroll_tds();

-- Nine report groups required by the HRMS blueprint.
create table if not exists public.hr_report_catalog(
  report_key text primary key, name text not null, category text not null, description text not null, is_active boolean not null default true
);
insert into public.hr_report_catalog(report_key,name,category,description) values
('employee','Employee Reports','EMPLOYEE','Employee master, employment state and organization placement.'),
('attendance','Attendance Reports','ATTENDANCE','Daily and monthly attendance, lateness and worked hours.'),
('leave','Leave Reports','LEAVE','Leave balances, requests, decisions and utilization.'),
('payroll','Payroll Reports','PAYROLL','Payroll runs, employee totals and payment status.'),
('salary','Salary Reports','SALARY','Effective-dated basic salary and compensation history.'),
('performance','Performance Reports','PERFORMANCE','Performance targets and review outcomes.'),
('kpi','KPI Reports','KPI','KPI assignments, achievement and completion.'),
('appraisal','Appraisal Reports','APPRAISAL','Appraisal cycles and employee ratings.'),
('workforce','Workforce Reports','WORKFORCE','Department, designation and employment-status composition.')
on conflict(report_key) do update set name=excluded.name,category=excluded.category,description=excluded.description;

create or replace view public.hr_report_employee with(security_invoker=true) as
select id,employee_code,full_name,email,job_title,department,branch,join_date,employment_status from public.hr_employees;
create or replace view public.hr_report_attendance with(security_invoker=true) as
select a.id,e.employee_code,e.full_name,a.attendance_date,a.clock_in,a.clock_out,a.status,a.late_minutes from public.hr_attendance a join public.hr_employees e on e.id=a.employee_id;
create or replace view public.hr_report_leave with(security_invoker=true) as
select l.id,e.employee_code,e.full_name,l.leave_type,l.from_date,l.to_date,l.days,l.status,l.approved_at from public.hr_leave_requests l join public.hr_employees e on e.id=l.employee_id;
create or replace view public.hr_report_payroll with(security_invoker=true) as
select i.id,e.employee_code,e.full_name,r.period_start,r.period_end,r.status,i.gross_salary,i.tds_tax,i.net_salary from public.hr_payroll_items i join public.hr_payroll_runs r on r.id=i.payroll_run_id join public.hr_employees e on e.id=i.employee_id;
create or replace view public.hr_report_salary with(security_invoker=true) as
select h.id,e.employee_code,e.full_name,h.previous_basic,h.new_basic,h.effective_from,h.reason from public.hr_salary_history h join public.hr_employees e on e.id=h.employee_id;
create or replace view public.hr_report_performance with(security_invoker=true) as
select r.id,e.employee_code,e.full_name,r.review_period,r.rating,r.goals,r.manager_feedback,r.reviewed_at from public.hr_performance_reviews r join public.hr_employees e on e.id=r.employee_id;
create or replace view public.hr_report_kpi with(security_invoker=true) as
select t.id,e.employee_code,e.full_name,t.title,t.period_start,t.period_end,t.target_value,t.achieved_value,t.unit,t.status from public.hr_performance_targets t join public.hr_employees e on e.id=t.employee_id;
create or replace view public.hr_report_appraisal with(security_invoker=true) as
select r.id,e.employee_code,e.full_name,r.review_period,r.rating,r.reviewed_at from public.hr_performance_reviews r join public.hr_employees e on e.id=r.employee_id;
create or replace view public.hr_report_workforce with(security_invoker=true) as
select department,job_title,employment_status,count(*)::bigint employee_count,avg(base_salary)::numeric(14,2) average_basic_salary from public.hr_employees group by department,job_title,employment_status;

-- Seed the supplied FY 2083/84 proposal as DRAFT. Activation requires an
-- explicit authorized approval after accountant/HR verification.
insert into public.hr_payroll_policies(name,fiscal_year,effective_from,minimum_monthly_pay,minimum_basic_pay,minimum_basic_ratio,festival_allowance_basic_months,status)
select 'AECS Nepal payroll proposal','2083/84','2026-07-17',19550,12170,0.60,1,'DRAFT'
where not exists(select 1 from public.hr_payroll_policies where fiscal_year='2083/84' and name='AECS Nepal payroll proposal');
with inserted as (
  insert into public.hr_tax_rule_sets(name,fiscal_year,effective_from,employee_ssf_rate,employer_ssf_rate,retirement_cap_amount,retirement_cap_income_ratio,status,source_reference)
  select 'FY 2083/84 proposed natural-person schedule','2083/84','2026-07-17',0.11,0.20,500000,0.333333,'DRAFT','AECS payroll configuration brief - pending enacted-law verification'
  where not exists(select 1 from public.hr_tax_rule_sets where fiscal_year='2083/84' and name='FY 2083/84 proposed natural-person schedule') returning id
), rules as (select id from inserted union all select id from public.hr_tax_rule_sets where fiscal_year='2083/84' and name='FY 2083/84 proposed natural-person schedule' limit 1)
insert into public.hr_tax_brackets(rule_set_id,sequence,lower_bound,upper_bound,rate)
select rules.id,v.sequence,v.lower_bound,v.upper_bound,v.rate from rules cross join(values
  (1,0::numeric,1000000::numeric,0.01::numeric),(2,1000000,1500000,0.10),(3,1500000,2500000,0.20),(4,2500000,4000000,0.27),(5,4000000,null,0.29)
)v(sequence,lower_bound,upper_bound,rate) on conflict(rule_set_id,sequence) do nothing;

insert into public.permissions(role,permission_name,enabled)
select role,permission_name,true from unnest(array['ADMIN','HR_ADMIN']::public.staff_role[]) role
cross join unnest(array['hr.settings.manage','hr.reports.view','hr.reports.export']::text[]) permission_name
on conflict(role,permission_name) do update set enabled=true;
insert into public.permissions(role,permission_name,enabled)
select 'DIRECTOR'::public.staff_role,permission_name,true
from unnest(array['hr.reports.view','hr.reports.export']::text[]) permission_name
on conflict(role,permission_name) do update set enabled=true;

do $$ declare table_name text; begin
  foreach table_name in array array['hr_departments','hr_designations','hr_employee_number_settings','hr_attendance_policies','hr_salary_component_definitions','hr_payroll_policies','hr_tax_rule_sets','hr_tax_brackets','hr_tds_ledger','hr_employment_history','hr_salary_history','hr_kpi_templates','hr_appraisal_cycles','hr_document_types','hr_contracts','hr_approval_routes','hr_approval_route_steps','hr_notification_rules','hr_report_catalog'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_read',table_name);
    execute format('create policy %I on public.%I for select to authenticated using(public.has_permission(''hr.view'') or public.has_permission(''hr.reports.view'') or public.has_permission(''hr.settings.manage''))',table_name||'_read',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_manage',table_name);
    execute format('create policy %I on public.%I for all to authenticated using(public.has_permission(''hr.settings.manage'') or public.has_permission(''hr.manage'')) with check(public.has_permission(''hr.settings.manage'') or public.has_permission(''hr.manage''))',table_name||'_manage',table_name);
  end loop;
end $$;

insert into public.audit_logs(user_id,action,module,metadata)
values(null,'HRMS_CONFIGURATION_FOUNDATION_INSTALLED','hrms',jsonb_build_object('report_groups',9,'statutory_seed_status','DRAFT'));

commit;
