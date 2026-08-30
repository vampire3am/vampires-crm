begin;

-- ADMIN remains supervision-only across the CRM, with one explicit operational
-- exception: creating a staff assignment. Progress and completion are still
-- owned by the assignee, while review remains with authorized operational roles.
insert into public.permissions(role,permission_name,enabled)
values('ADMIN','assignments.assign',true)
on conflict(role,permission_name) do update set enabled=true;

create or replace function public.prevent_admin_assignment_changes()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if public.current_staff_role()='ADMIN' and tg_op<>'INSERT' then
    raise exception 'ADMIN can assign staff work but cannot change assignment execution records';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

drop trigger if exists admin_supervision_read_only on public.staff_assignments;
drop trigger if exists admin_assignment_authority on public.staff_assignments;
create trigger admin_assignment_authority before insert or update or delete on public.staff_assignments
for each row execute function public.prevent_admin_assignment_changes();

create or replace function public.create_staff_assignment(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare task_uuid uuid; target record; code text;
begin
  if not public.has_permission('assignments.assign') then raise exception 'Assignment creation permission required'; end if;
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

revoke all on function public.create_staff_assignment(jsonb) from public;
grant execute on function public.create_staff_assignment(jsonb) to authenticated;

insert into public.audit_logs(user_id,action,module,metadata)
values(null,'ADMIN_ASSIGNMENT_AUTHORITY_ENABLED','assignments',jsonb_build_object('role','ADMIN','authority','CREATE_ASSIGNMENT_ONLY'));

commit;
