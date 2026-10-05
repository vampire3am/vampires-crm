begin;

alter table public.hr_employees
  add column if not exists attendance_device_user_id text;

create unique index if not exists hr_employees_attendance_device_user_unique
  on public.hr_employees(attendance_device_user_id)
  where attendance_device_user_id is not null;

alter table public.hr_attendance
  add column if not exists punch_count integer not null default 0,
  add column if not exists source_device_id uuid;

create table if not exists public.hr_attendance_devices (
  id uuid primary key default gen_random_uuid(),
  serial_number text not null unique,
  name text not null,
  model text not null,
  ip_address inet not null,
  http_port integer not null default 80 check(http_port between 1 and 65535),
  sdk_port integer not null default 8000 check(sdk_port between 1 and 65535),
  ehome_enabled boolean not null default false,
  ehome_address_type text check(ehome_address_type in('IP','DOMAIN')),
  ehome_server_ip inet,
  ehome_version text,
  ehome_server_port integer check(ehome_server_port between 1 and 65535),
  ehome_account text,
  sync_enabled boolean not null default true,
  is_active boolean not null default true,
  last_event_at timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  bridge_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hr_attendance
  drop constraint if exists hr_attendance_source_device_id_fkey;
alter table public.hr_attendance
  add constraint hr_attendance_source_device_id_fkey
  foreign key(source_device_id) references public.hr_attendance_devices(id) on delete set null;

create table if not exists public.hr_attendance_device_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.hr_attendance_devices(id) on delete restrict,
  event_uid text not null,
  device_user_id text not null,
  employee_id uuid references public.hr_employees(id) on delete set null,
  occurred_at timestamptz not null,
  attendance_date date not null,
  event_kind text not null default 'FINGERPRINT',
  authentication_mode text,
  device_attendance_status text,
  processing_status text not null default 'RECEIVED'
    check(processing_status in('RECEIVED','PROCESSED','UNMAPPED','IGNORED_DUPLICATE','ERROR')),
  processing_note text,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(device_id,event_uid)
);

create index if not exists hr_attendance_device_events_employee_date_idx
  on public.hr_attendance_device_events(employee_id,attendance_date,occurred_at);
create index if not exists hr_attendance_device_events_unmapped_idx
  on public.hr_attendance_device_events(received_at desc)
  where processing_status='UNMAPPED';

insert into public.hr_attendance_devices(
  serial_number,name,model,ip_address,http_port,sdk_port,ehome_enabled,ehome_address_type,
  ehome_server_ip,ehome_version,ehome_server_port,ehome_account
) values (
  'GR6140877','AECS Bagbazar Fingerprint Terminal','DS-K1A8503EF-B','192.168.100.80',80,8000,
  true,'IP','192.168.100.84','4.0',7660,'aecs'
) on conflict(serial_number) do update set
  model=excluded.model,ip_address=excluded.ip_address,http_port=excluded.http_port,
  sdk_port=excluded.sdk_port,ehome_enabled=excluded.ehome_enabled,
  ehome_address_type=excluded.ehome_address_type,ehome_server_ip=excluded.ehome_server_ip,
  ehome_version=excluded.ehome_version,ehome_server_port=excluded.ehome_server_port,
  ehome_account=excluded.ehome_account,updated_at=now();

insert into public.permissions(role,permission_name,enabled)
select role,permission_name,true
from (values('ADMIN'::public.staff_role),('HR_ADMIN'),('IT_ADMIN')) roles(role)
cross join (values('attendance.device.view'),('attendance.device.manage'),('attendance.device.sync'),('attendance.device.events.view'),('attendance.mapping.manage')) permissions(permission_name)
on conflict(role,permission_name) do update set enabled=true;

insert into public.permissions(role,permission_name,enabled)
select 'DIRECTOR'::public.staff_role,permission_name,true
from (values('attendance.device.view'),('attendance.device.events.view')) permissions(permission_name)
on conflict(role,permission_name) do update set enabled=true;

insert into public.staff_permission_overrides(staff_id,permission_name,enabled,updated_by)
select sp.id,p.permission_name,true,null
from public.staff_profiles sp
cross join (values('attendance.device.view'),('attendance.device.manage'),('attendance.device.sync'),('attendance.device.events.view'),('attendance.mapping.manage')) p(permission_name)
where sp.is_active and sp.access_mode='EXACT' and sp.role::text in('ADMIN','HR_ADMIN','IT_ADMIN')
on conflict(staff_id,permission_name) do nothing;

alter table public.hr_attendance_devices enable row level security;
alter table public.hr_attendance_device_events enable row level security;

drop policy if exists hr_attendance_devices_authorized_read on public.hr_attendance_devices;
create policy hr_attendance_devices_authorized_read on public.hr_attendance_devices for select to authenticated
using(public.has_permission('attendance.device.view') or public.has_permission('attendance.device.manage'));

drop policy if exists hr_attendance_device_events_authorized_read on public.hr_attendance_device_events;
create policy hr_attendance_device_events_authorized_read on public.hr_attendance_device_events for select to authenticated
using(
  public.has_permission('attendance.device.events.view')
  or employee_id in(select id from public.hr_employees where staff_profile_id=auth.uid())
);

revoke insert,update,delete on public.hr_attendance_devices,public.hr_attendance_device_events from authenticated;
grant select on public.hr_attendance_devices,public.hr_attendance_device_events to authenticated;

create or replace function public.hr_ingest_hikvision_punch(
  p_device_serial text,
  p_event_uid text,
  p_device_user_id text,
  p_occurred_at timestamptz,
  p_event_kind text default 'FINGERPRINT',
  p_authentication_mode text default null,
  p_attendance_status text default null,
  p_raw_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_device public.hr_attendance_devices;
  v_event_id uuid;
  v_employee_id uuid;
  v_attendance_date date;
  v_event_uid text;
  v_punch_count integer;
  v_first_punch timestamptz;
  v_last_punch timestamptz;
  v_attendance_id uuid;
  v_late_minutes integer := 0;
begin
  if coalesce(trim(p_device_serial),'')='' or coalesce(trim(p_device_user_id),'')='' or p_occurred_at is null then
    raise exception 'Device serial, device user ID and punch time are required';
  end if;

  select * into v_device from public.hr_attendance_devices
  where serial_number=trim(p_device_serial) and is_active and sync_enabled for update;
  if not found then raise exception 'Attendance device is not registered or synchronization is disabled'; end if;

  v_attendance_date := (p_occurred_at at time zone 'Asia/Kathmandu')::date;
  v_event_uid := coalesce(nullif(trim(p_event_uid),''),md5(concat_ws('|',v_device.id,trim(p_device_user_id),p_occurred_at,p_event_kind,p_attendance_status)));

  insert into public.hr_attendance_device_events(
    device_id,event_uid,device_user_id,occurred_at,attendance_date,event_kind,
    authentication_mode,device_attendance_status,raw_payload
  ) values (
    v_device.id,v_event_uid,trim(p_device_user_id),p_occurred_at,v_attendance_date,
    coalesce(nullif(trim(p_event_kind),''),'FINGERPRINT'),p_authentication_mode,p_attendance_status,coalesce(p_raw_payload,'{}'::jsonb)
  ) on conflict(device_id,event_uid) do nothing returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('status','DUPLICATE','event_uid',v_event_uid);
  end if;

  select id into v_employee_id from public.hr_employees
  where attendance_device_user_id=trim(p_device_user_id) and employment_status<>'EXITED';

  if v_employee_id is null then
    update public.hr_attendance_device_events set processing_status='UNMAPPED',processed_at=now(),
      processing_note='No active employee is mapped to this device user ID.' where id=v_event_id;
    update public.hr_attendance_devices set last_event_at=greatest(coalesce(last_event_at,p_occurred_at),p_occurred_at),
      last_success_at=now(),last_attempt_at=now(),last_error=null,updated_at=now() where id=v_device.id;
    return jsonb_build_object('status','UNMAPPED','event_id',v_event_id,'device_user_id',trim(p_device_user_id));
  end if;

  update public.hr_attendance_device_events set employee_id=v_employee_id where id=v_event_id;

  if exists(
    select 1 from public.hr_attendance_device_events e
    where e.id<>v_event_id and e.device_id=v_device.id and e.employee_id=v_employee_id
      and e.processing_status='PROCESSED'
      and e.occurred_at between p_occurred_at-interval '30 seconds' and p_occurred_at+interval '30 seconds'
  ) then
    update public.hr_attendance_device_events set processing_status='IGNORED_DUPLICATE',processed_at=now(),
      processing_note='Ignored because another accepted punch exists within 30 seconds.' where id=v_event_id;
    return jsonb_build_object('status','IGNORED_DUPLICATE','event_id',v_event_id);
  end if;

  update public.hr_attendance_device_events set processing_status='PROCESSED',processed_at=now() where id=v_event_id;

  select count(*),min(occurred_at),max(occurred_at)
    into v_punch_count,v_first_punch,v_last_punch
  from public.hr_attendance_device_events
  where employee_id=v_employee_id and attendance_date=v_attendance_date and processing_status='PROCESSED';

  select greatest(0,floor(extract(epoch from(
    (v_first_punch at time zone 'Asia/Kathmandu')::time
    -(s.start_time+make_interval(mins=>s.grace_minutes))
  ))/60)::integer)
  into v_late_minutes
  from public.hr_shift_assignments a
  join public.hr_shifts s on s.id=a.shift_id
  where a.employee_id=v_employee_id and a.effective_from<=v_attendance_date
    and(a.effective_to is null or a.effective_to>=v_attendance_date)
  order by a.effective_from desc limit 1;
  v_late_minutes := coalesce(v_late_minutes,0);

  insert into public.hr_attendance(
    employee_id,attendance_date,clock_in,clock_out,status,late_minutes,source,punch_count,source_device_id
  ) values (
    v_employee_id,v_attendance_date,v_first_punch,
    case when v_punch_count>1 then v_last_punch else null end,
    case when v_late_minutes>0 then 'LATE' else 'PRESENT' end,
    v_late_minutes,'BIOMETRIC',v_punch_count,v_device.id
  ) on conflict(employee_id,attendance_date) do update set
    clock_in=excluded.clock_in,
    clock_out=excluded.clock_out,
    status=excluded.status,
    late_minutes=excluded.late_minutes,
    punch_count=excluded.punch_count,
    source='BIOMETRIC',
    source_device_id=excluded.source_device_id
  where public.hr_attendance.source<>'MANUAL'
  returning id into v_attendance_id;

  update public.hr_attendance_devices set
    last_event_at=greatest(coalesce(last_event_at,p_occurred_at),p_occurred_at),
    last_success_at=now(),last_attempt_at=now(),last_error=null,updated_at=now()
  where id=v_device.id;

  return jsonb_build_object(
    'status','PROCESSED','event_id',v_event_id,'attendance_id',v_attendance_id,
    'employee_id',v_employee_id,'attendance_date',v_attendance_date,
    'punch_count',v_punch_count,'clock_in',v_first_punch,
    'clock_out',case when v_punch_count>1 then v_last_punch else null end
  );
exception when others then
  update public.hr_attendance_devices set last_attempt_at=now(),last_error=sqlerrm,updated_at=now()
  where serial_number=trim(p_device_serial);
  raise;
end $$;

revoke all on function public.hr_ingest_hikvision_punch(text,text,text,timestamptz,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.hr_ingest_hikvision_punch(text,text,text,timestamptz,text,text,text,jsonb) to service_role;

create or replace function public.hr_create_employee(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare eid uuid;
begin
  if not public.has_permission('hr.manage') then raise exception 'Employee management permission required'; end if;
  if coalesce(trim(payload->>'attendance_device_user_id'),'')<>'' and not public.has_permission('attendance.mapping.manage') then
    raise exception 'Device attendance mapping permission required';
  end if;
  insert into hr_employees(
    full_name,email,phone,job_title,department,branch,join_date,base_salary,
    bank_account,pan_number,attendance_device_user_id,created_by
  ) values (
    payload->>'full_name',(payload->>'email')::citext,payload->>'phone',payload->>'job_title',
    payload->>'department',payload->>'branch',coalesce((payload->>'join_date')::date,current_date),
    (payload->>'base_salary')::numeric,payload->>'bank_account',payload->>'pan_number',
    nullif(trim(payload->>'attendance_device_user_id'),''),auth.uid()
  ) returning id into eid;
  return eid;
exception when unique_violation then
  raise exception 'That email or attendance device user number is already assigned';
end $$;

revoke all on function public.hr_create_employee(jsonb) from public;
grant execute on function public.hr_create_employee(jsonb) to authenticated;

create or replace function public.hr_update_employee(employee_uuid uuid,payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission('hr.manage') then raise exception 'Employee management permission required'; end if;
  if payload?'attendance_device_user_id' and not public.has_permission('attendance.mapping.manage') then
    raise exception 'Device attendance mapping permission required';
  end if;
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
    attendance_device_user_id=case when payload?'attendance_device_user_id' then nullif(trim(payload->>'attendance_device_user_id'),'') else attendance_device_user_id end,
    updated_at=now()
  where id=employee_uuid;
  if not found then raise exception 'Employee not found'; end if;
  insert into audit_logs(user_id,action,module,metadata)
  values(auth.uid(),'EMPLOYEE_UPDATED','hrms',jsonb_build_object('employee_id',employee_uuid,'fields',(select jsonb_agg(key) from jsonb_each(payload))));
exception when unique_violation then
  raise exception 'That attendance device user number is already assigned to another employee';
end $$;

revoke all on function public.hr_update_employee(uuid,jsonb) from public;
grant execute on function public.hr_update_employee(uuid,jsonb) to authenticated;

commit;
