begin;

create sequence if not exists public.staff_assignment_number_seq start 1;

alter table public.staff_profiles drop constraint if exists staff_profiles_desktop_modules_check;
alter table public.staff_profiles add constraint staff_profiles_desktop_modules_check check(
  desktop_modules is null or desktop_modules <@ array[
    'dashboard','leads','students','counselling','applications','b2b','classes',
    'mocks','documents','finance','reports','hrms','settings','messages','assignments'
  ]::text[]
);

create table if not exists public.staff_assignments(
  id uuid primary key default gen_random_uuid(),
  assignment_code text not null unique,
  title text not null check(char_length(trim(title)) between 3 and 180),
  description text not null check(char_length(trim(description)) between 5 and 5000),
  category text not null default 'CUSTOM',
  deliverables text,
  priority text not null default 'MEDIUM' check(priority in('LOW','MEDIUM','HIGH','URGENT')),
  status text not null default 'ASSIGNED' check(status in('ASSIGNED','IN_PROGRESS','SUBMITTED','REVISION_REQUIRED','COMPLETED','CANCELLED')),
  due_at timestamptz not null,
  assigned_to uuid not null references public.staff_profiles(id),
  assigned_by uuid not null references public.staff_profiles(id),
  assignee_role public.staff_role not null,
  progress smallint not null default 0 check(progress between 0 and 100),
  completion_report text,
  evidence_links jsonb not null default '[]'::jsonb check(jsonb_typeof(evidence_links)='array'),
  submitted_at timestamptz,
  reviewer_notes text,
  reviewed_by uuid references public.staff_profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staff_assignments_assignee_idx on public.staff_assignments(assigned_to,status,due_at);
create index if not exists staff_assignments_assigner_idx on public.staff_assignments(assigned_by,created_at desc);
drop trigger if exists touch_staff_assignments on public.staff_assignments;
create trigger touch_staff_assignments before update on public.staff_assignments for each row execute function public.touch_updated_at();
drop trigger if exists admin_supervision_read_only on public.staff_assignments;
create trigger admin_supervision_read_only before insert or update or delete on public.staff_assignments for each row execute function public.prevent_admin_operational_mutation();

alter table public.staff_assignments enable row level security;
drop policy if exists staff_assignments_read on public.staff_assignments;
create policy staff_assignments_read on public.staff_assignments for select to authenticated using(
  public.current_staff_role()='ADMIN' or assigned_to=auth.uid() or assigned_by=auth.uid() or public.has_permission('assignments.review')
);

insert into public.permissions(role,permission_name,enabled)
select role,permission_name,true
from unnest(enum_range(null::public.staff_role)) role
cross join(values('assignments.view'),('assignments.submit')) permission(permission_name)
on conflict(role,permission_name) do update set enabled=true;

insert into public.permissions(role,permission_name,enabled)
select role,'assignments.assign',true from unnest(enum_range(null::public.staff_role)) role where role<>'ADMIN'
on conflict(role,permission_name) do update set enabled=true;

insert into public.permissions(role,permission_name,enabled)
select role,'assignments.review',true from unnest(array['DIRECTOR','HR_ADMIN','OPERATIONS_MANAGER']::text[]) role_text
join unnest(enum_range(null::public.staff_role)) role on role::text=role_text
on conflict(role,permission_name) do update set enabled=true;

update public.permissions set enabled=false where role='ADMIN' and permission_name in('assignments.assign','assignments.submit','assignments.review');
update public.staff_profiles set desktop_modules=array_append(coalesce(desktop_modules,'{}'::text[]),'assignments') where not('assignments'=any(coalesce(desktop_modules,'{}'::text[])));

create or replace function public.create_staff_assignment(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare task_uuid uuid; target record; code text;
begin
  if public.current_staff_role()='ADMIN' or not public.has_permission('assignments.assign') then raise exception 'Assignment creation permission required'; end if;
  select id,role,full_name into target from staff_profiles where id=(payload->>'assigned_to')::uuid and is_active;
  if target.id is null then raise exception 'Choose an active staff member'; end if;
  if nullif(trim(payload->>'title'),'') is null or nullif(trim(payload->>'description'),'') is null then raise exception 'Title and instructions are required'; end if;
  if nullif(payload->>'due_at','') is null or (payload->>'due_at')::timestamptz<=now() then raise exception 'Due date must be in the future'; end if;
  code:='ASN-'||to_char(timezone('Asia/Kathmandu',now()),'YYYY')||'-'||lpad(nextval('staff_assignment_number_seq')::text,5,'0');
  insert into staff_assignments(assignment_code,title,description,category,deliverables,priority,due_at,assigned_to,assigned_by,assignee_role)
  values(code,trim(payload->>'title'),trim(payload->>'description'),upper(coalesce(nullif(trim(payload->>'category'),''),'CUSTOM')),nullif(trim(payload->>'deliverables'),''),coalesce(nullif(payload->>'priority',''),'MEDIUM'),(payload->>'due_at')::timestamptz,target.id,auth.uid(),target.role)
  returning id into task_uuid;
  insert into staff_notifications(staff_id,type,title,body,action_url,metadata)
  values(target.id,'TASK_ASSIGNED','New assignment: '||trim(payload->>'title'),'Due '||to_char((payload->>'due_at')::timestamptz at time zone 'Asia/Kathmandu','DD Mon YYYY, HH12:MI AM'),'/assignments',jsonb_build_object('assignment_id',task_uuid,'assignment_code',code));
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'STAFF_ASSIGNMENT_CREATED','assignments',jsonb_build_object('assignment_id',task_uuid,'assigned_to',target.id,'assignee_role',target.role));
  return task_uuid;
end $$;

create or replace function public.update_my_assignment_progress(assignment_uuid uuid,next_progress integer)
returns void language plpgsql security definer set search_path=public as $$
begin
  if public.current_staff_role()='ADMIN' or not public.has_permission('assignments.submit') then raise exception 'Assignment update permission required'; end if;
  if next_progress<0 or next_progress>99 then raise exception 'Progress must be between 0 and 99 before submission'; end if;
  update staff_assignments set progress=next_progress,status=case when next_progress=0 then'ASSIGNED'else'IN_PROGRESS'end
  where id=assignment_uuid and assigned_to=auth.uid() and status in('ASSIGNED','IN_PROGRESS','REVISION_REQUIRED');
  if not found then raise exception 'This assignment cannot be updated'; end if;
end $$;

create or replace function public.submit_staff_assignment(assignment_uuid uuid,report_text text,evidence jsonb default'[]'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare assignment_record record;
begin
  if public.current_staff_role()='ADMIN' or not public.has_permission('assignments.submit') then raise exception 'Assignment submission permission required'; end if;
  if char_length(trim(coalesce(report_text,'')))<20 then raise exception 'Completion report must contain at least 20 characters'; end if;
  if jsonb_typeof(coalesce(evidence,'[]'::jsonb))<>'array' then raise exception 'Evidence must be a list'; end if;
  update staff_assignments set completion_report=trim(report_text),evidence_links=coalesce(evidence,'[]'::jsonb),progress=100,status='SUBMITTED',submitted_at=now(),reviewer_notes=null
  where id=assignment_uuid and assigned_to=auth.uid() and status in('ASSIGNED','IN_PROGRESS','REVISION_REQUIRED') returning * into assignment_record;
  if assignment_record.id is null then raise exception 'This assignment cannot be submitted'; end if;
  insert into staff_notifications(staff_id,type,title,body,action_url,metadata)
  values(assignment_record.assigned_by,'TASK_SUBMITTED','Assignment submitted: '||assignment_record.title,'Completion report is ready for review.','/assignments',jsonb_build_object('assignment_id',assignment_record.id));
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'STAFF_ASSIGNMENT_SUBMITTED','assignments',jsonb_build_object('assignment_id',assignment_record.id));
end $$;

create or replace function public.review_staff_assignment(assignment_uuid uuid,decision text,review_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare assignment_record record;
begin
  if public.current_staff_role()='ADMIN' then raise exception 'ADMIN is supervision-only and cannot review assignments'; end if;
  select * into assignment_record from staff_assignments where id=assignment_uuid for update;
  if assignment_record.id is null or assignment_record.status<>'SUBMITTED' then raise exception 'A submitted assignment is required'; end if;
  if assignment_record.assigned_by<>auth.uid() and not public.has_permission('assignments.review') then raise exception 'Assignment review permission required'; end if;
  if decision not in('COMPLETED','REVISION_REQUIRED') then raise exception 'Choose completed or revision required'; end if;
  if decision='REVISION_REQUIRED' and char_length(trim(coalesce(review_note,'')))<5 then raise exception 'Explain the required revision'; end if;
  update staff_assignments set status=decision,reviewer_notes=nullif(trim(review_note),''),reviewed_by=auth.uid(),completed_at=case when decision='COMPLETED'then now()else null end,progress=case when decision='COMPLETED'then 100 else 75 end where id=assignment_uuid;
  insert into staff_notifications(staff_id,type,title,body,action_url,metadata)
  values(assignment_record.assigned_to,case when decision='COMPLETED'then'TASK_COMPLETED'else'TASK_REVISION'end,case when decision='COMPLETED'then'Assignment approved'else'Assignment needs revision'end,assignment_record.title||coalesce(' · '||nullif(trim(review_note),''),''),'/assignments',jsonb_build_object('assignment_id',assignment_uuid));
  insert into audit_logs(user_id,action,module,metadata) values(auth.uid(),'STAFF_ASSIGNMENT_'||decision,'assignments',jsonb_build_object('assignment_id',assignment_uuid,'review_note',review_note));
end $$;

revoke all on function public.create_staff_assignment(jsonb),public.update_my_assignment_progress(uuid,integer),public.submit_staff_assignment(uuid,text,jsonb),public.review_staff_assignment(uuid,text,text) from public;
grant execute on function public.create_staff_assignment(jsonb),public.update_my_assignment_progress(uuid,integer),public.submit_staff_assignment(uuid,text,jsonb),public.review_staff_assignment(uuid,text,text) to authenticated;

commit;
