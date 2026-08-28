begin;

-- Clear every operational CRM row. Uploaded binary objects are removed through
-- the Supabase Storage API because direct storage-table deletion is prohibited.
-- Authentication-linked staff profiles and the authorization matrix are kept
-- so authorized staff can still sign in to the clean installation.

do $$
declare
  table_record record;
begin
  for table_record in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in (
        'staff_profiles',
        'roles',
        'permissions',
        'role_permissions'
      )
  loop
    execute format(
      'truncate table public.%I restart identity cascade',
      table_record.tablename
    );
  end loop;
end
$$;

-- Remove only profiles that do not belong to a real Supabase Auth account.
delete from public.staff_profiles profile
where not exists (
  select 1
  from auth.users auth_user
  where auth_user.id = profile.id
);

update public.staff_profiles profile
set is_active = true,
    updated_at = now()
where exists (
  select 1
  from auth.users auth_user
  where auth_user.id = profile.id
);

commit;
