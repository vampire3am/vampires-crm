-- Dedicated HR authority. System administrators configure access but do not approve leave.
alter type public.staff_role add value if not exists 'HR_ADMIN';
