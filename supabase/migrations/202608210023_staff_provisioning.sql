-- Secure in-CRM staff provisioning metadata.
alter table public.staff_profiles
  add column if not exists desktop_modules text[],
  add column if not exists assigned_responsibilities text not null default '';

alter table public.staff_profiles drop constraint if exists staff_profiles_desktop_modules_check;
alter table public.staff_profiles add constraint staff_profiles_desktop_modules_check
check (
  desktop_modules is null or desktop_modules <@ array[
    'dashboard','leads','students','counselling','applications','b2b','classes',
    'mocks','documents','finance','reports','hrms','settings','messages'
  ]::text[]
);

comment on column public.staff_profiles.desktop_modules is
  'Optional per-user CRM navigation allow-list. NULL uses the role default.';
comment on column public.staff_profiles.assigned_responsibilities is
  'Administrator-defined duties shown in staff administration.';
