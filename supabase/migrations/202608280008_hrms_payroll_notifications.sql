-- Make salary components affect payroll and route important HR events into the
-- unified notification centre.

create or replace function public.staff_has_permission(target_staff uuid,requested_permission text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from staff_profiles sp where sp.id=target_staff and sp.is_active and(
    exists(select 1 from staff_permission_overrides o where o.staff_id=sp.id and o.permission_name=requested_permission and o.enabled)
    or(sp.access_mode='ROLE_PLUS' and exists(select 1 from permissions p where p.role=sp.role and p.permission_name=requested_permission and p.enabled))
  ))
$$;
revoke all on function public.staff_has_permission(uuid,text) from public;

create or replace function public.hr_generate_payroll(period_start_date date,period_end_date date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare run_uuid uuid; employee_count integer; gross_total numeric(14,2); net_total numeric(14,2);
begin
  if not(public.has_permission('payroll.prepare') or public.has_permission('payroll.manage')) then raise exception 'Payroll preparation permission required'; end if;
  if period_start_date is null or period_end_date is null or period_end_date<period_start_date then raise exception 'Select a valid payroll period'; end if;
  if period_end_date-period_start_date>32 then raise exception 'A payroll run must cover one month'; end if;
  insert into hr_payroll_runs(period_start,period_end,status,prepared_by)
  values(period_start_date,period_end_date,'DRAFT',auth.uid())
  on conflict(period_start,period_end) do nothing returning id into run_uuid;
  if run_uuid is null then raise exception 'Payroll is already generated for this month'; end if;

  insert into hr_payroll_items(payroll_run_id,employee_id,basic_salary,allowance,commission,ssf_deduction,cit_deduction,tds_tax)
  select run_uuid,e.id,round(e.base_salary,2),coalesce(c.allowance,0),coalesce(c.commission,0),round(e.base_salary*0.11,2),coalesce(c.cit,0),round(e.base_salary*0.01,2)+coalesce(c.other_deduction,0)
  from hr_employees e
  left join lateral(
    select
      sum(amount) filter(where component_type='ALLOWANCE') allowance,
      sum(amount) filter(where component_type='COMMISSION') commission,
      sum(amount) filter(where component_type='CIT_DEDUCTION') cit,
      sum(amount) filter(where component_type='OTHER_DEDUCTION') other_deduction
    from hr_salary_components sc where sc.employee_id=e.id and sc.effective_from<=period_end_date
      and(sc.effective_to is null or sc.effective_to>=period_start_date)
  ) c on true
  where e.employment_status in('ACTIVE','PROBATION','ON_LEAVE') and e.join_date<=period_end_date;

  select count(*),coalesce(sum(gross_salary),0),coalesce(sum(net_salary),0)
  into employee_count,gross_total,net_total from hr_payroll_items where payroll_run_id=run_uuid;
  if employee_count=0 then delete from hr_payroll_runs where id=run_uuid;raise exception 'No eligible staff records were found'; end if;
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'PAYROLL_GENERATED','hrms',jsonb_build_object('payroll_run_id',run_uuid,'period_start',period_start_date,'period_end',period_end_date,'employees',employee_count,'gross_total',gross_total,'net_total',net_total));
  return jsonb_build_object('run_id',run_uuid,'employee_count',employee_count,'gross_total',gross_total,'net_total',net_total,'status','DRAFT');
end $$;

create or replace function public.notify_hr_correction_request()
returns trigger language plpgsql security definer set search_path=public as $$
declare employee_name text;
begin
  select full_name into employee_name from hr_employees where id=new.employee_id;
  insert into staff_notifications(staff_id,type,title,body,action_url,metadata)
  select distinct sp.id,'ATTENDANCE_CORRECTION','Attendance correction requires review',employee_name||' requested a correction for '||to_char(new.attendance_date,'DD Mon YYYY'),'/hrms?tab=attendance',jsonb_build_object('correction_id',new.id)
  from staff_profiles sp where sp.is_active and public.staff_has_permission(sp.id,'attendance.manage');
  return new;
end $$;
drop trigger if exists notify_hr_correction_request_trigger on public.hr_attendance_corrections;
create trigger notify_hr_correction_request_trigger after insert on public.hr_attendance_corrections for each row execute function public.notify_hr_correction_request();

create or replace function public.notify_hr_correction_decision()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.status is distinct from new.status and new.status in('APPROVED','REJECTED') then
    insert into staff_notifications(staff_id,type,title,body,action_url,metadata)
    values(new.requested_by,'ATTENDANCE_'||new.status,'Attendance correction '||lower(new.status),'Your correction for '||to_char(new.attendance_date,'DD Mon YYYY')||' was '||lower(new.status),'/hrms?tab=attendance',jsonb_build_object('correction_id',new.id));
  end if;
  return new;
end $$;
drop trigger if exists notify_hr_correction_decision_trigger on public.hr_attendance_corrections;
create trigger notify_hr_correction_decision_trigger after update on public.hr_attendance_corrections for each row execute function public.notify_hr_correction_decision();

create or replace function public.notify_performance_target()
returns trigger language plpgsql security definer set search_path=public as $$ declare recipient uuid; begin
  select staff_profile_id into recipient from hr_employees where id=new.employee_id;
  if recipient is not null then insert into staff_notifications(staff_id,type,title,body,action_url,metadata)
  values(recipient,'PERFORMANCE_TARGET','New performance target assigned',new.title||' · Due '||to_char(new.period_end,'DD Mon YYYY'),'/hrms?tab=performance',jsonb_build_object('target_id',new.id)); end if;
  return new;
end $$;
drop trigger if exists notify_performance_target_trigger on public.hr_performance_targets;
create trigger notify_performance_target_trigger after insert on public.hr_performance_targets for each row execute function public.notify_performance_target();

create or replace function public.notify_payroll_status()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.status is distinct from new.status then
    if new.status='PENDING_APPROVAL' then
      insert into staff_notifications(staff_id,type,title,body,action_url,metadata)
      select distinct sp.id,'PAYROLL_APPROVAL','Payroll awaiting approval','Payroll for '||to_char(new.period_start,'Mon YYYY')||' is ready for review','/hrms?tab=payroll',jsonb_build_object('payroll_run_id',new.id)
      from staff_profiles sp where sp.is_active and public.staff_has_permission(sp.id,'payroll.approve');
    elsif new.status='PAID' then
      insert into staff_notifications(staff_id,type,title,body,action_url,metadata)
      select e.staff_profile_id,'PAYROLL_PAID','Salary disbursed','Payroll for '||to_char(new.period_start,'Mon YYYY')||' has been marked paid','/hrms?tab=payroll',jsonb_build_object('payroll_run_id',new.id,'payment_reference',new.payment_reference)
      from hr_payroll_items i join hr_employees e on e.id=i.employee_id where i.payroll_run_id=new.id and e.staff_profile_id is not null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists notify_payroll_status_trigger on public.hr_payroll_runs;
create trigger notify_payroll_status_trigger after update on public.hr_payroll_runs for each row execute function public.notify_payroll_status();

revoke all on function public.hr_generate_payroll(date,date) from public;
grant execute on function public.hr_generate_payroll(date,date) to authenticated;
