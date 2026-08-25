-- Allow every active, authenticated staff role to delete student records.
-- has_permission() also verifies that the staff profile is active.
insert into public.permissions (role, permission_name, enabled)
select role, 'students.delete', true
from unnest(enum_range(null::public.staff_role)) as role
on conflict (role, permission_name)
do update set enabled = excluded.enabled;

drop policy if exists permitted_staff_delete_students on public.students;
create policy permitted_staff_delete_students
on public.students for delete to authenticated
using (public.has_permission('students.delete'));
