begin;

-- ADMIN is a supervision role. It can inspect operational records and reports,
-- but it cannot create, change, approve, delete, upload, pay, or configure data.
update public.permissions set enabled=false where role='ADMIN';

insert into public.permissions(role,permission_name,enabled)
select 'ADMIN'::public.staff_role,permission_name,true
from unnest(array[
  'dashboard.view','notifications.view','audit.view','monitoring.view',
  'leads.view','students.view','applications.view','case_tasks.view',
  'counselling.view','documents.view','b2b.view','classes.view',
  'finance.view','hr.view','attendance.view','performance.view',
  'payroll.view','salary.view','reports.view','reports.export'
]::text[]) permission_name
on conflict(role,permission_name) do update set enabled=true;

-- Remove any historical per-user write grants from administrators and make the
-- role template authoritative for every ADMIN account.
delete from public.staff_permission_overrides override_row
using public.staff_profiles profile
where override_row.staff_id=profile.id and profile.role='ADMIN';

update public.staff_profiles
set access_mode='ROLE_PLUS',
    desktop_modules=array['dashboard','leads','students','counselling','applications','b2b','classes','mocks','documents','finance','reports','hrms','settings']::text[]
where role='ADMIN';

-- Legacy policies treat managers as writers. Directors remain operational
-- managers; administrators no longer satisfy that legacy write predicate.
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from staff_profiles where id=auth.uid() and is_active and role='DIRECTOR')
$$;

-- Final database guard for older tables whose historical policies allowed any
-- active staff member to write. This applies even through security-definer RPCs.
create or replace function public.prevent_admin_operational_mutation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if public.current_staff_role()='ADMIN' then
    raise exception 'ADMIN is a supervision-only role and cannot modify CRM data';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

do $$
declare target_table record;
begin
  for target_table in
    select tablename from pg_tables
    where schemaname='public'
      and tablename<>all(array['staff_notifications','communication_channel_members','audit_logs','report_exports'])
  loop
    execute format('drop trigger if exists admin_supervision_read_only on public.%I',target_table.tablename);
    execute format('create trigger admin_supervision_read_only before insert or update or delete on public.%I for each row execute function public.prevent_admin_operational_mutation()',target_table.tablename);
  end loop;
end
$$;

-- Keep document viewing available while denying every authenticated ADMIN write
-- to storage, including paths covered by old permissive bucket policies.
drop policy if exists admin_supervision_no_storage_insert on storage.objects;
drop policy if exists admin_supervision_no_storage_update on storage.objects;
drop policy if exists admin_supervision_no_storage_delete on storage.objects;
create policy admin_supervision_no_storage_insert on storage.objects as restrictive for insert to authenticated
with check(public.current_staff_role() is distinct from 'ADMIN'::public.staff_role);
create policy admin_supervision_no_storage_update on storage.objects as restrictive for update to authenticated
using(public.current_staff_role() is distinct from 'ADMIN'::public.staff_role)
with check(public.current_staff_role() is distinct from 'ADMIN'::public.staff_role);
create policy admin_supervision_no_storage_delete on storage.objects as restrictive for delete to authenticated
using(public.current_staff_role() is distinct from 'ADMIN'::public.staff_role);

insert into public.audit_logs(user_id,action,module,metadata)
values(null,'ADMIN_SUPERVISION_POLICY_ENABLED','security',jsonb_build_object('role','ADMIN','mode','READ_ONLY'));

commit;
