begin;

-- ADMIN has full operational authority inside HRMS, while remaining blocked
-- from entering or editing data in the rest of the CRM. Personal attendance
-- self-service is intentionally excluded, so ADMIN still has no clock in/out.
insert into public.permissions(role,permission_name,enabled)
select 'ADMIN'::public.staff_role,permission_name,true
from unnest(array[
  'hr.view','hr.manage','hr.approve','hr.documents.manage',
  'attendance.view','attendance.correct','attendance.manage','leave.approve',
  'performance.view','performance.manage','salary.view','salary.manage',
  'payroll.view','payroll.manage','payroll.prepare','payroll.approve','payroll.pay'
]::text[]) permission_name
on conflict(role,permission_name) do update set enabled=true;

create or replace function public.prevent_admin_operational_mutation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if public.current_staff_role()='ADMIN' then
    if tg_table_name like 'hr\_%' escape '\' and public.has_permission('hr.manage') then
      if tg_op='DELETE' then return old; end if;
      return new;
    end if;
    raise exception 'ADMIN can modify HRMS records only; other CRM data remains supervision-only';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

-- The restrictive storage guard now permits only the confidential HR document
-- bucket when the ADMIN account has the matching HR document permission.
drop policy if exists admin_supervision_no_storage_insert on storage.objects;
drop policy if exists admin_supervision_no_storage_update on storage.objects;
drop policy if exists admin_supervision_no_storage_delete on storage.objects;
create policy admin_supervision_no_storage_insert on storage.objects as restrictive for insert to authenticated
with check(
  public.current_staff_role() is distinct from 'ADMIN'::public.staff_role
  or (bucket_id='hr-staff-documents' and public.has_permission('hr.documents.manage'))
);
create policy admin_supervision_no_storage_update on storage.objects as restrictive for update to authenticated
using(
  public.current_staff_role() is distinct from 'ADMIN'::public.staff_role
  or (bucket_id='hr-staff-documents' and public.has_permission('hr.documents.manage'))
)
with check(
  public.current_staff_role() is distinct from 'ADMIN'::public.staff_role
  or (bucket_id='hr-staff-documents' and public.has_permission('hr.documents.manage'))
);
create policy admin_supervision_no_storage_delete on storage.objects as restrictive for delete to authenticated
using(
  public.current_staff_role() is distinct from 'ADMIN'::public.staff_role
  or (bucket_id='hr-staff-documents' and public.has_permission('hr.documents.manage'))
);

insert into public.audit_logs(user_id,action,module,metadata)
values(null,'ADMIN_HRMS_AUTHORITY_ENABLED','hrms',jsonb_build_object('role','ADMIN','authority','FULL_HRMS_EXCEPT_SELF_ATTENDANCE'));

commit;
