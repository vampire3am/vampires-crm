-- Every active CRM staff account that can access Classes may manage its
-- batches, enrolments and attendance. has_permission() still requires an
-- authenticated, active staff profile.
insert into public.permissions (role, permission_name, enabled)
select role, permission_name, true
from unnest(enum_range(null::public.staff_role)) as role
cross join (values
  ('classes.view'),
  ('classes.manage'),
  ('attendance.manage'),
  ('mocks.manage')
) as permission(permission_name)
on conflict (role, permission_name)
do update set enabled = excluded.enabled;
