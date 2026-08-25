create table if not exists public.class_faculty (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 1),
  email citext,
  phone text,
  specialization text,
  qualification text,
  employment_type text not null default 'Part-time' check (employment_type in ('Full-time','Part-time','Visiting')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','REMOVED')),
  notes text,
  created_by uuid references public.staff_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.test_prep_batches add column if not exists faculty_id uuid references public.class_faculty(id) on delete set null;

insert into public.class_faculty(full_name, status)
select distinct trim(instructor_name), 'ACTIVE'
from public.test_prep_batches
where nullif(trim(instructor_name),'') is not null and lower(trim(instructor_name)) <> 'unassigned'
and not exists (select 1 from public.class_faculty f where lower(f.full_name)=lower(trim(instructor_name)) and f.status <> 'REMOVED');

update public.test_prep_batches b set faculty_id=f.id
from public.class_faculty f
where b.faculty_id is null and lower(trim(b.instructor_name))=lower(f.full_name) and f.status <> 'REMOVED';

alter table public.class_faculty enable row level security;
drop policy if exists class_faculty_read on public.class_faculty;
drop policy if exists class_faculty_manage on public.class_faculty;
create policy class_faculty_read on public.class_faculty for select to authenticated using(public.has_permission('classes.view'));
create policy class_faculty_manage on public.class_faculty for all to authenticated using(public.has_permission('classes.manage')) with check(public.has_permission('classes.manage'));

create or replace function public.save_class_faculty(faculty_uuid uuid, payload jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare saved_id uuid;
begin
  if not public.has_permission('classes.manage') then raise exception 'Insufficient permission'; end if;
  if nullif(trim(payload->>'full_name'),'') is null then raise exception 'Faculty name is required'; end if;
  if faculty_uuid is null then
    insert into class_faculty(full_name,email,phone,specialization,qualification,employment_type,status,notes,created_by)
    values(trim(payload->>'full_name'),nullif(trim(payload->>'email'),''),nullif(trim(payload->>'phone'),''),nullif(trim(payload->>'specialization'),''),nullif(trim(payload->>'qualification'),''),coalesce(nullif(payload->>'employment_type',''),'Part-time'),coalesce(nullif(payload->>'status',''),'ACTIVE'),nullif(trim(payload->>'notes'),''),auth.uid())
    returning id into saved_id;
  else
    update class_faculty set full_name=trim(payload->>'full_name'),email=nullif(trim(payload->>'email'),''),phone=nullif(trim(payload->>'phone'),''),specialization=nullif(trim(payload->>'specialization'),''),qualification=nullif(trim(payload->>'qualification'),''),employment_type=coalesce(nullif(payload->>'employment_type',''),'Part-time'),status=coalesce(nullif(payload->>'status',''),'ACTIVE'),notes=nullif(trim(payload->>'notes'),''),updated_at=now() where id=faculty_uuid returning id into saved_id;
    if saved_id is null then raise exception 'Faculty profile not found'; end if;
    update test_prep_batches set instructor_name=trim(payload->>'full_name') where faculty_id=saved_id;
  end if;
  return saved_id;
end$$;

create or replace function public.remove_class_faculty(faculty_uuid uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission('classes.manage') then raise exception 'Insufficient permission'; end if;
  update test_prep_batches set faculty_id=null,instructor_name='Unassigned' where faculty_id=faculty_uuid and status in ('ACTIVE','UPCOMING');
  update class_faculty set status='REMOVED',updated_at=now() where id=faculty_uuid;
end$$;

create or replace function public.create_test_batch(payload jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare bid uuid; selected_faculty uuid; instructor_label text;
begin
  if not public.has_permission('classes.manage') then raise exception 'Insufficient permission'; end if;
  selected_faculty:=nullif(payload->>'faculty_id','')::uuid;
  if selected_faculty is not null then select full_name into instructor_label from class_faculty where id=selected_faculty and status='ACTIVE'; end if;
  instructor_label:=coalesce(instructor_label,nullif(trim(payload->>'instructor'),''),'Unassigned');
  insert into test_prep_batches(batch_code,course_type,title,timing,room,instructor_name,faculty_id,max_capacity,start_date,status)
  values(payload->>'batch_code',(payload->>'course_type')::batch_course_type,payload->>'title',payload->>'timing',payload->>'room',instructor_label,selected_faculty,(payload->>'max_capacity')::integer,(payload->>'start_date')::date,(payload->>'status')::batch_status)
  returning id into bid;
  return bid;
end$$;

revoke all on function public.save_class_faculty(uuid,jsonb),public.remove_class_faculty(uuid) from public;
grant execute on function public.save_class_faculty(uuid,jsonb),public.remove_class_faculty(uuid) to authenticated;
