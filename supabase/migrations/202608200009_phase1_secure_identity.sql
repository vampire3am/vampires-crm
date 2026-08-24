-- Phase 1: canonical staff identity, profile metadata, and database authorization.
-- Enum values are additive so this migration remains safe for existing installations.
alter type public.staff_role add value if not exists 'SENIOR_COUNSELLOR';
alter type public.staff_role add value if not exists 'VISA_OFFICER';
alter type public.staff_role add value if not exists 'ACCOUNTANT';
alter type public.staff_role add value if not exists 'FACULTY';
alter type public.staff_role add value if not exists 'MARKETING';
alter type public.staff_role add value if not exists 'IT_ADMIN';

alter table public.staff_profiles
  add column if not exists job_title text not null default 'Staff Member',
  add column if not exists branch text not null default 'Kathmandu Central Hub',
  add column if not exists department text not null default 'General Operations',
  add column if not exists phone text,
  add column if not exists avatar_bg text;

create or replace function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.staff_profiles
  where id = auth.uid() and is_active
$$;

create or replace function public.has_permission(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.permissions p
    join public.staff_profiles s on s.id = auth.uid()
    where s.is_active
      and p.role = s.role
      and p.permission_name = requested_permission
      and p.enabled
  )
$$;

revoke all on function public.current_staff_role() from public;
revoke all on function public.has_permission(text) from public;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.has_permission(text) to authenticated;

-- Staff may update only the non-privileged presentation fields of their own profile
-- through a controlled RPC. Role, active state, and identity remain manager-owned.
create or replace function public.update_my_staff_profile(profile_updates jsonb)
returns public.staff_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.staff_profiles;
begin
  update public.staff_profiles
  set
    full_name = coalesce(nullif(trim(profile_updates->>'full_name'), ''), full_name),
    phone = case when profile_updates ? 'phone' then nullif(trim(profile_updates->>'phone'), '') else phone end,
    avatar_bg = case when profile_updates ? 'avatar_bg' then nullif(trim(profile_updates->>'avatar_bg'), '') else avatar_bg end
  where id = auth.uid() and is_active
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Active staff profile not found';
  end if;
  return updated_profile;
end;
$$;

revoke all on function public.update_my_staff_profile(jsonb) from public;
grant execute on function public.update_my_staff_profile(jsonb) to authenticated;
