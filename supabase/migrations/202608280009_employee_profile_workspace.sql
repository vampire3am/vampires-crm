-- Full employee profile editing and salary component maintenance.

create or replace function public.hr_update_employee(employee_uuid uuid,payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission('hr.manage') then raise exception 'Employee management permission required'; end if;
  update hr_employees set
    full_name=case when payload?'full_name' then nullif(trim(payload->>'full_name'),'') else full_name end,
    email=case when payload?'email' then nullif(trim(payload->>'email'),'')::citext else email end,
    phone=case when payload?'phone' then nullif(trim(payload->>'phone'),'') else phone end,
    job_title=case when payload?'job_title' then nullif(trim(payload->>'job_title'),'') else job_title end,
    department=case when payload?'department' then nullif(trim(payload->>'department'),'') else department end,
    branch=case when payload?'branch' then nullif(trim(payload->>'branch'),'') else branch end,
    join_date=case when payload?'join_date' then (payload->>'join_date')::date else join_date end,
    probation_end_date=case when payload?'probation_end_date' then nullif(payload->>'probation_end_date','')::date else probation_end_date end,
    date_of_birth=case when payload?'date_of_birth' then nullif(payload->>'date_of_birth','')::date else date_of_birth end,
    gender=case when payload?'gender' then nullif(trim(payload->>'gender'),'') else gender end,
    current_address=case when payload?'current_address' then nullif(trim(payload->>'current_address'),'') else current_address end,
    emergency_contact_name=case when payload?'emergency_contact_name' then nullif(trim(payload->>'emergency_contact_name'),'') else emergency_contact_name end,
    emergency_contact_phone=case when payload?'emergency_contact_phone' then nullif(trim(payload->>'emergency_contact_phone'),'') else emergency_contact_phone end,
    citizenship_number=case when payload?'citizenship_number' then nullif(trim(payload->>'citizenship_number'),'') else citizenship_number end,
    pan_number=case when payload?'pan_number' then nullif(trim(payload->>'pan_number'),'') else pan_number end,
    ssf_number=case when payload?'ssf_number' then nullif(trim(payload->>'ssf_number'),'') else ssf_number end,
    bank_account=case when payload?'bank_account' then nullif(trim(payload->>'bank_account'),'') else bank_account end,
    base_salary=case when payload?'base_salary' then (payload->>'base_salary')::numeric else base_salary end,
    employment_type=case when payload?'employment_type' then payload->>'employment_type' else employment_type end,
    payment_method=case when payload?'payment_method' then payload->>'payment_method' else payment_method end,
    manager_id=case when payload?'manager_id' then nullif(payload->>'manager_id','')::uuid else manager_id end,
    updated_at=now()
  where id=employee_uuid;
  if not found then raise exception 'Employee not found'; end if;
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'EMPLOYEE_UPDATED','hrms',jsonb_build_object('employee_id',employee_uuid,'fields',(select jsonb_agg(key) from jsonb_each(payload))));
end $$;

create or replace function public.hr_delete_salary_component(component_uuid uuid)
returns void language plpgsql security definer set search_path=public as $$
declare employee_uuid uuid; component_name text;
begin
  if not public.has_permission('salary.manage') then raise exception 'Salary management permission required'; end if;
  delete from hr_salary_components where id=component_uuid returning employee_id,name into employee_uuid,component_name;
  if not found then raise exception 'Salary component not found'; end if;
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'SALARY_COMPONENT_REMOVED','hrms',jsonb_build_object('employee_id',employee_uuid,'component_id',component_uuid,'name',component_name));
end $$;

create or replace function public.hr_employee_activity(employee_uuid uuid)
returns table(id bigint,action text,metadata jsonb,created_at timestamptz,actor_name text)
language sql stable security definer set search_path=public as $$
  select a.id,a.action,a.metadata,a.created_at,coalesce(s.full_name,'System') actor_name
  from audit_logs a left join staff_profiles s on s.id=a.user_id
  where public.has_permission('hr.view') and a.module='hrms' and a.metadata->>'employee_id'=employee_uuid::text
  order by a.created_at desc limit 100
$$;

revoke all on function public.hr_update_employee(uuid,jsonb),public.hr_delete_salary_component(uuid),public.hr_employee_activity(uuid) from public;
grant execute on function public.hr_update_employee(uuid,jsonb),public.hr_delete_salary_component(uuid),public.hr_employee_activity(uuid) to authenticated;
