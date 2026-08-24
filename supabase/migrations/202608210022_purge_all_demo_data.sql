begin;

-- This installation has not gone live yet. Remove every operational/demo row
-- while retaining authentication-linked staff and authorization definitions.
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

-- With operational references gone, remove phantom profiles completely.
delete from public.staff_profiles p
where not exists (select 1 from auth.users u where u.id = p.id);

-- A real Authentication user may have a disabled profile from an earlier
-- cleanup attempt. Restore only those genuine profiles.
update public.staff_profiles p
set is_active = true,
    updated_at = now()
where exists (select 1 from auth.users u where u.id = p.id);

commit;
