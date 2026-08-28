create or replace function public.hr_generate_payroll(period_start_date date,period_end_date date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  run_uuid uuid; employee_count integer; gross_total numeric(14,2); net_total numeric(14,2);
begin
  if not public.has_permission('payroll.manage') then raise exception 'Payroll management permission required'; end if;
  if period_start_date is null or period_end_date is null or period_end_date<period_start_date then raise exception 'Select a valid payroll period'; end if;
  if period_end_date-period_start_date>32 then raise exception 'A payroll run must cover one month'; end if;
  insert into hr_payroll_runs(period_start,period_end,status,prepared_by)
  values(period_start_date,period_end_date,'DRAFT',auth.uid())
  on conflict(period_start,period_end) do nothing returning id into run_uuid;
  if run_uuid is null then raise exception 'Payroll is already generated for this month'; end if;

  insert into hr_payroll_items(payroll_run_id,employee_id,basic_salary,allowance,commission,ssf_deduction,cit_deduction,tds_tax)
  select run_uuid,e.id,round(e.base_salary,2),0,0,round(e.base_salary*0.11,2),0,round(e.base_salary*0.01,2)
  from hr_employees e
  where e.employment_status in('ACTIVE','PROBATION','ON_LEAVE') and e.join_date<=period_end_date;

  select count(*),coalesce(sum(gross_salary),0),coalesce(sum(net_salary),0)
  into employee_count,gross_total,net_total from hr_payroll_items where payroll_run_id=run_uuid;
  if employee_count=0 then delete from hr_payroll_runs where id=run_uuid;raise exception 'No eligible staff records were found'; end if;
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'PAYROLL_GENERATED','hrms',jsonb_build_object('payroll_run_id',run_uuid,'period_start',period_start_date,'period_end',period_end_date,'employees',employee_count,'gross_total',gross_total,'net_total',net_total));
  return jsonb_build_object('run_id',run_uuid,'employee_count',employee_count,'gross_total',gross_total,'net_total',net_total,'status','DRAFT');
end$$;

revoke all on function public.hr_generate_payroll(date,date) from public;
grant execute on function public.hr_generate_payroll(date,date) to authenticated;
