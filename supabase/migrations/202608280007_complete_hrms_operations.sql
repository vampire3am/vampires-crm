-- Complete HRMS operations: employee lifecycle, shifts, attendance corrections,
-- salary components, controlled payroll, performance and private staff documents.

alter table public.hr_employees
  add column if not exists manager_id uuid references public.hr_employees(id),
  add column if not exists employment_type text not null default 'FULL_TIME',
  add column if not exists probation_end_date date,
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists current_address text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists citizenship_number text,
  add column if not exists ssf_number text,
  add column if not exists payment_method text not null default 'BANK_TRANSFER',
  add column if not exists exit_date date,
  add column if not exists exit_reason text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.staff_profiles(id);

alter table public.hr_employees drop constraint if exists hr_employees_employment_type_check;
alter table public.hr_employees add constraint hr_employees_employment_type_check
  check(employment_type in('FULL_TIME','PART_TIME','CONTRACT','INTERN','CONSULTANT'));
alter table public.hr_employees drop constraint if exists hr_employees_payment_method_check;
alter table public.hr_employees add constraint hr_employees_payment_method_check
  check(payment_method in('BANK_TRANSFER','CASH','CHEQUE'));

alter table public.hr_payroll_runs
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references public.staff_profiles(id),
  add column if not exists approved_at timestamptz,
  add column if not exists paid_by uuid references public.staff_profiles(id),
  add column if not exists payment_reference text,
  add column if not exists locked_at timestamptz,
  add column if not exists notes text;

alter table public.hr_staff_documents
  add column if not exists file_size bigint,
  add column if not exists mime_type text,
  add column if not exists status text not null default 'UPLOADED',
  add column if not exists verified_by uuid references public.staff_profiles(id),
  add column if not exists verified_at timestamptz,
  add column if not exists rejection_note text;
alter table public.hr_staff_documents drop constraint if exists hr_staff_documents_status_check;
alter table public.hr_staff_documents add constraint hr_staff_documents_status_check
  check(status in('UPLOADED','VERIFIED','REJECTED','EXPIRED'));

create table if not exists public.hr_attendance_corrections(
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid references public.hr_attendance(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  attendance_date date not null,
  requested_clock_in timestamptz,
  requested_clock_out timestamptz,
  requested_status text not null check(requested_status in('PRESENT','LATE','HALF_DAY','ON_LEAVE','ABSENT')),
  reason text not null,
  status text not null default 'PENDING' check(status in('PENDING','APPROVED','REJECTED','CANCELLED')),
  requested_by uuid not null references public.staff_profiles(id),
  decided_by uuid references public.staff_profiles(id),
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_salary_components(
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  component_type text not null check(component_type in('ALLOWANCE','COMMISSION','CIT_DEDUCTION','OTHER_DEDUCTION')),
  name text not null,
  amount numeric(14,2) not null check(amount>=0),
  effective_from date not null,
  effective_to date,
  is_recurring boolean not null default true,
  created_by uuid not null references public.staff_profiles(id),
  created_at timestamptz not null default now(),
  check(effective_to is null or effective_to>=effective_from)
);

create table if not exists public.hr_performance_targets(
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  title text not null,
  description text,
  period_start date not null,
  period_end date not null,
  target_value numeric(14,2),
  achieved_value numeric(14,2) not null default 0,
  unit text not null default 'COUNT',
  status text not null default 'ACTIVE' check(status in('DRAFT','ACTIVE','COMPLETED','CANCELLED')),
  assigned_by uuid not null references public.staff_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(period_end>=period_start)
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hr-staff-documents','hr-staff-documents',false,20971520,array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into public.permissions(role,permission_name,enabled)
select role,permission_name,true
from (values('ADMIN'::public.staff_role),('DIRECTOR')) roles(role)
cross join (values
 ('attendance.view'),('attendance.correct'),('attendance.manage'),('leave.approve'),
 ('salary.view'),('salary.manage'),('payroll.prepare'),('payroll.approve'),('payroll.pay'),
 ('performance.view'),('performance.manage'),('hr.documents.manage')
) p(permission_name)
on conflict(role,permission_name) do update set enabled=true;

insert into public.permissions(role,permission_name,enabled)
select role,permission_name,true
from (values('ACCOUNTANT'::public.staff_role),('FINANCE')) roles(role)
cross join (values('salary.view'),('payroll.view'),('payroll.prepare')) p(permission_name)
on conflict(role,permission_name) do update set enabled=true;

insert into public.permissions(role,permission_name,enabled)
select role,'attendance.view',true from unnest(enum_range(null::public.staff_role)) role
on conflict(role,permission_name) do update set enabled=true;

do $$ declare t text; begin
  foreach t in array array['hr_attendance_corrections','hr_salary_components','hr_performance_targets'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

drop policy if exists hr_attendance_corrections_read on public.hr_attendance_corrections;
create policy hr_attendance_corrections_read on public.hr_attendance_corrections for select to authenticated
using(public.has_permission('attendance.manage') or requested_by=auth.uid());
drop policy if exists hr_salary_components_read on public.hr_salary_components;
create policy hr_salary_components_read on public.hr_salary_components for select to authenticated
using(public.has_permission('salary.view') or employee_id in(select id from public.hr_employees where staff_profile_id=auth.uid()));
drop policy if exists hr_performance_targets_read on public.hr_performance_targets;
create policy hr_performance_targets_read on public.hr_performance_targets for select to authenticated
using(public.has_permission('performance.view') or employee_id in(select id from public.hr_employees where staff_profile_id=auth.uid()));

drop policy if exists hr_staff_documents_storage_read on storage.objects;
create policy hr_staff_documents_storage_read on storage.objects for select to authenticated
using(bucket_id='hr-staff-documents' and (public.has_permission('hr.documents.manage') or exists(
  select 1 from public.hr_staff_documents d join public.hr_employees e on e.id=d.employee_id
  where d.storage_path=name and e.staff_profile_id=auth.uid()
)));
drop policy if exists hr_staff_documents_storage_insert on storage.objects;
create policy hr_staff_documents_storage_insert on storage.objects for insert to authenticated
with check(bucket_id='hr-staff-documents' and public.has_permission('hr.documents.manage'));
drop policy if exists hr_staff_documents_storage_delete on storage.objects;
create policy hr_staff_documents_storage_delete on storage.objects for delete to authenticated
using(bucket_id='hr-staff-documents' and public.has_permission('hr.documents.manage'));

drop policy if exists hr_staff_documents_self_read on public.hr_staff_documents;
create policy hr_staff_documents_self_read on public.hr_staff_documents for select to authenticated
using(employee_id in(select id from public.hr_employees where staff_profile_id=auth.uid()));

create or replace function public.hr_update_employee(employee_uuid uuid,payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission('hr.manage') then raise exception 'Employee management permission required'; end if;
  update hr_employees set
    full_name=coalesce(nullif(payload->>'full_name',''),full_name), email=coalesce(nullif(payload->>'email','')::citext,email),
    phone=coalesce(payload->>'phone',phone), job_title=coalesce(nullif(payload->>'job_title',''),job_title),
    department=coalesce(nullif(payload->>'department',''),department), branch=coalesce(nullif(payload->>'branch',''),branch),
    base_salary=coalesce((payload->>'base_salary')::numeric,base_salary), bank_account=coalesce(payload->>'bank_account',bank_account),
    pan_number=coalesce(payload->>'pan_number',pan_number), ssf_number=coalesce(payload->>'ssf_number',ssf_number),
    citizenship_number=coalesce(payload->>'citizenship_number',citizenship_number), current_address=coalesce(payload->>'current_address',current_address),
    emergency_contact_name=coalesce(payload->>'emergency_contact_name',emergency_contact_name), emergency_contact_phone=coalesce(payload->>'emergency_contact_phone',emergency_contact_phone),
    employment_type=coalesce(nullif(payload->>'employment_type',''),employment_type), payment_method=coalesce(nullif(payload->>'payment_method',''),payment_method),
    manager_id=coalesce(nullif(payload->>'manager_id','')::uuid,manager_id), updated_at=now()
  where id=employee_uuid;
  if not found then raise exception 'Employee not found'; end if;
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'EMPLOYEE_UPDATED','hrms',jsonb_build_object('employee_id',employee_uuid));
end $$;

create or replace function public.hr_change_employment_status(employee_uuid uuid,new_status text,reason text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission('hr.manage') then raise exception 'Employee management permission required'; end if;
  if new_status not in('ACTIVE','ON_LEAVE','PROBATION','SUSPENDED','EXITED') then raise exception 'Invalid employment status'; end if;
  if new_status='EXITED' and coalesce(trim(reason),'')='' then raise exception 'Exit reason is required'; end if;
  update hr_employees set employment_status=new_status,exit_date=case when new_status='EXITED' then current_date else null end,
    exit_reason=case when new_status='EXITED' then reason else null end,
    archived_at=case when new_status='EXITED' then now() else null end,
    archived_by=case when new_status='EXITED' then auth.uid() else null end,updated_at=now()
  where id=employee_uuid;
  if not found then raise exception 'Employee not found'; end if;
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'EMPLOYMENT_STATUS_CHANGED','hrms',jsonb_build_object('employee_id',employee_uuid,'status',new_status,'reason',reason));
end $$;

create or replace function public.hr_save_shift(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$ declare shift_uuid uuid; begin
  if not public.has_permission('hr.manage') then raise exception 'Shift management permission required'; end if;
  shift_uuid=nullif(payload->>'id','')::uuid;
  if shift_uuid is null then
    insert into hr_shifts(name,start_time,end_time,grace_minutes,weekly_days,is_active)
    values(payload->>'name',(payload->>'start_time')::time,(payload->>'end_time')::time,coalesce((payload->>'grace_minutes')::integer,15),coalesce(array(select jsonb_array_elements_text(payload->'weekly_days')::smallint),'{1,2,3,4,5,6}'),true)
    returning id into shift_uuid;
  else
    update hr_shifts set name=payload->>'name',start_time=(payload->>'start_time')::time,end_time=(payload->>'end_time')::time,
      grace_minutes=coalesce((payload->>'grace_minutes')::integer,grace_minutes),weekly_days=coalesce(array(select jsonb_array_elements_text(payload->'weekly_days')::smallint),weekly_days),is_active=coalesce((payload->>'is_active')::boolean,is_active)
    where id=shift_uuid;
  end if;
  return shift_uuid;
end $$;

create or replace function public.hr_assign_shift(employee_uuid uuid,shift_uuid uuid,start_date date,end_date date default null)
returns uuid language plpgsql security definer set search_path=public as $$ declare assignment_uuid uuid; begin
  if not public.has_permission('hr.manage') then raise exception 'Shift management permission required'; end if;
  update hr_shift_assignments set effective_to=start_date-1 where employee_id=employee_uuid and effective_to is null and effective_from<start_date;
  insert into hr_shift_assignments(employee_id,shift_id,effective_from,effective_to) values(employee_uuid,shift_uuid,start_date,end_date)
  on conflict(employee_id,effective_from) do update set shift_id=excluded.shift_id,effective_to=excluded.effective_to returning id into assignment_uuid;
  return assignment_uuid;
end $$;

create or replace function public.hr_request_attendance_correction(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$ declare eid uuid; correction_uuid uuid; begin
  select id into eid from hr_employees where staff_profile_id=auth.uid();
  if public.has_permission('attendance.manage') and nullif(payload->>'employee_id','') is not null then eid=(payload->>'employee_id')::uuid; end if;
  if eid is null then raise exception 'Employee record not found'; end if;
  insert into hr_attendance_corrections(attendance_id,employee_id,attendance_date,requested_clock_in,requested_clock_out,requested_status,reason,requested_by)
  values(nullif(payload->>'attendance_id','')::uuid,eid,(payload->>'attendance_date')::date,nullif(payload->>'clock_in','')::timestamptz,nullif(payload->>'clock_out','')::timestamptz,payload->>'status',payload->>'reason',auth.uid())
  returning id into correction_uuid;
  return correction_uuid;
end $$;

create or replace function public.hr_decide_attendance_correction(correction_uuid uuid,decision text,decision_note text default null)
returns void language plpgsql security definer set search_path=public as $$ declare c record; begin
  if not public.has_permission('attendance.manage') then raise exception 'Attendance approval permission required'; end if;
  if decision not in('APPROVED','REJECTED') then raise exception 'Invalid decision'; end if;
  select * into c from hr_attendance_corrections where id=correction_uuid and status='PENDING' for update;
  if c.id is null then raise exception 'Pending correction not found'; end if;
  if decision='APPROVED' then
    insert into hr_attendance(employee_id,attendance_date,clock_in,clock_out,status,source,approved_by)
    values(c.employee_id,c.attendance_date,c.requested_clock_in,c.requested_clock_out,c.requested_status,'MANUAL',auth.uid())
    on conflict(employee_id,attendance_date) do update set clock_in=excluded.clock_in,clock_out=excluded.clock_out,status=excluded.status,source='MANUAL',approved_by=auth.uid();
  end if;
  update hr_attendance_corrections set status=decision,decided_by=auth.uid(),decision_note=hr_decide_attendance_correction.decision_note,decided_at=now() where id=correction_uuid;
end $$;

create or replace function public.hr_save_salary_component(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$ declare component_uuid uuid; begin
  if not public.has_permission('salary.manage') then raise exception 'Salary management permission required'; end if;
  insert into hr_salary_components(employee_id,component_type,name,amount,effective_from,effective_to,is_recurring,created_by)
  values((payload->>'employee_id')::uuid,payload->>'component_type',payload->>'name',(payload->>'amount')::numeric,(payload->>'effective_from')::date,nullif(payload->>'effective_to','')::date,coalesce((payload->>'is_recurring')::boolean,true),auth.uid()) returning id into component_uuid;
  return component_uuid;
end $$;

create or replace function public.hr_update_payroll_item(item_uuid uuid,payload jsonb)
returns void language plpgsql security definer set search_path=public as $$ begin
  if not public.has_permission('payroll.prepare') and not public.has_permission('payroll.manage') then raise exception 'Payroll preparation permission required'; end if;
  update hr_payroll_items i set allowance=coalesce((payload->>'allowance')::numeric,i.allowance),commission=coalesce((payload->>'commission')::numeric,i.commission),
    cit_deduction=coalesce((payload->>'cit_deduction')::numeric,i.cit_deduction),tds_tax=coalesce((payload->>'tds_tax')::numeric,i.tds_tax)
  from hr_payroll_runs r where i.id=item_uuid and r.id=i.payroll_run_id and r.status='DRAFT';
  if not found then raise exception 'Only a draft payroll item can be edited'; end if;
end $$;

create or replace function public.hr_transition_payroll(run_uuid uuid,next_status text,note text default null,payment_reference text default null)
returns void language plpgsql security definer set search_path=public as $$ declare current_run record; begin
  select * into current_run from hr_payroll_runs where id=run_uuid for update;
  if current_run.id is null then raise exception 'Payroll run not found'; end if;
  if next_status='PENDING_APPROVAL' then
    if current_run.status<>'DRAFT' or not(public.has_permission('payroll.prepare') or public.has_permission('payroll.manage')) then raise exception 'Draft payroll preparation permission required'; end if;
    update hr_payroll_runs set status=next_status,submitted_at=now(),submitted_by=auth.uid(),notes=note where id=run_uuid;
  elsif next_status='APPROVED' then
    if current_run.status<>'PENDING_APPROVAL' or not public.has_permission('payroll.approve') then raise exception 'Payroll approval permission required'; end if;
    if current_run.submitted_by=auth.uid() then raise exception 'Payroll must be approved by a different authorized user'; end if;
    update hr_payroll_runs set status=next_status,approved_at=now(),approved_by=auth.uid(),locked_at=now(),notes=coalesce(note,notes) where id=run_uuid;
  elsif next_status='PAID' then
    if current_run.status<>'APPROVED' or not public.has_permission('payroll.pay') then raise exception 'Payroll payment permission required'; end if;
    if coalesce(trim(payment_reference),'')='' then raise exception 'Payment reference is required'; end if;
    update hr_payroll_runs set status=next_status,paid_at=now(),paid_by=auth.uid(),payment_reference=hr_transition_payroll.payment_reference where id=run_uuid;
  elsif next_status='CANCELLED' then
    if current_run.status not in('DRAFT','PENDING_APPROVAL') or not public.has_permission('payroll.manage') then raise exception 'Payroll cancellation permission required'; end if;
    update hr_payroll_runs set status=next_status,notes=note,locked_at=now() where id=run_uuid;
  else raise exception 'Invalid payroll transition';
  end if;
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'PAYROLL_'||next_status,'hrms',jsonb_build_object('payroll_run_id',run_uuid,'note',note,'payment_reference',payment_reference));
end $$;

create or replace function public.hr_save_performance_target(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$ declare target_uuid uuid; begin
  if not public.has_permission('performance.manage') then raise exception 'Performance management permission required'; end if;
  insert into hr_performance_targets(employee_id,title,description,period_start,period_end,target_value,achieved_value,unit,status,assigned_by)
  values((payload->>'employee_id')::uuid,payload->>'title',payload->>'description',(payload->>'period_start')::date,(payload->>'period_end')::date,nullif(payload->>'target_value','')::numeric,coalesce((payload->>'achieved_value')::numeric,0),coalesce(payload->>'unit','COUNT'),coalesce(payload->>'status','ACTIVE'),auth.uid()) returning id into target_uuid;
  return target_uuid;
end $$;

create or replace function public.hr_create_performance_review(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$ declare review_uuid uuid; begin
  if not public.has_permission('performance.manage') then raise exception 'Performance management permission required'; end if;
  insert into hr_performance_reviews(employee_id,review_period,rating,goals,manager_feedback,reviewed_by)
  values((payload->>'employee_id')::uuid,payload->>'review_period',(payload->>'rating')::numeric,payload->>'goals',payload->>'manager_feedback',auth.uid()) returning id into review_uuid;
  return review_uuid;
end $$;

create or replace function public.hr_register_staff_document(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$ declare document_uuid uuid; begin
  if not public.has_permission('hr.documents.manage') then raise exception 'HR document permission required'; end if;
  insert into hr_staff_documents(employee_id,document_type,file_name,storage_path,expires_on,file_size,mime_type,uploaded_by)
  values((payload->>'employee_id')::uuid,payload->>'document_type',payload->>'file_name',payload->>'storage_path',nullif(payload->>'expires_on','')::date,(payload->>'file_size')::bigint,payload->>'mime_type',auth.uid()) returning id into document_uuid;
  return document_uuid;
end $$;

create or replace function public.hr_verify_staff_document(document_uuid uuid,decision text,note text default null)
returns void language plpgsql security definer set search_path=public as $$ begin
  if not public.has_permission('hr.documents.manage') then raise exception 'HR document permission required'; end if;
  if decision not in('VERIFIED','REJECTED') then raise exception 'Invalid document decision'; end if;
  update hr_staff_documents set status=decision,verified_by=auth.uid(),verified_at=now(),rejection_note=case when decision='REJECTED' then note else null end where id=document_uuid;
  if not found then raise exception 'Document not found'; end if;
end $$;

revoke all on function public.hr_update_employee(uuid,jsonb),public.hr_change_employment_status(uuid,text,text),public.hr_save_shift(jsonb),public.hr_assign_shift(uuid,uuid,date,date),public.hr_request_attendance_correction(jsonb),public.hr_decide_attendance_correction(uuid,text,text),public.hr_save_salary_component(jsonb),public.hr_update_payroll_item(uuid,jsonb),public.hr_transition_payroll(uuid,text,text,text),public.hr_save_performance_target(jsonb),public.hr_create_performance_review(jsonb),public.hr_register_staff_document(jsonb),public.hr_verify_staff_document(uuid,text,text) from public;
grant execute on function public.hr_update_employee(uuid,jsonb),public.hr_change_employment_status(uuid,text,text),public.hr_save_shift(jsonb),public.hr_assign_shift(uuid,uuid,date,date),public.hr_request_attendance_correction(jsonb),public.hr_decide_attendance_correction(uuid,text,text),public.hr_save_salary_component(jsonb),public.hr_update_payroll_item(uuid,jsonb),public.hr_transition_payroll(uuid,text,text,text),public.hr_save_performance_target(jsonb),public.hr_create_performance_review(jsonb),public.hr_register_staff_document(jsonb),public.hr_verify_staff_document(uuid,text,text) to authenticated;
