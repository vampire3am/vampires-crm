alter table public.staff_profiles
  add column if not exists access_mode text not null default 'ROLE_PLUS',
  add column if not exists inactivity_minutes integer not null default 30;

alter table public.staff_profiles drop constraint if exists staff_profiles_access_mode_check;
alter table public.staff_profiles add constraint staff_profiles_access_mode_check check(access_mode in('ROLE_PLUS','EXACT'));
alter table public.staff_profiles drop constraint if exists staff_profiles_inactivity_minutes_check;
alter table public.staff_profiles add constraint staff_profiles_inactivity_minutes_check check(inactivity_minutes between 5 and 720);

create table if not exists public.staff_permission_overrides(
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  permission_name text not null,
  enabled boolean not null default true,
  updated_by uuid references public.staff_profiles(id),
  updated_at timestamptz not null default now(),
  primary key(staff_id,permission_name)
);
alter table public.staff_permission_overrides enable row level security;

drop policy if exists staff_permission_overrides_self_read on public.staff_permission_overrides;
create policy staff_permission_overrides_self_read on public.staff_permission_overrides for select to authenticated
using(staff_id=auth.uid() or public.current_staff_role() in('ADMIN','DIRECTOR'));

insert into public.permissions(role,permission_name,enabled)
select role,'dashboard.view',true from unnest(enum_range(null::public.staff_role)) role
on conflict(role,permission_name) do update set enabled=true;

insert into public.permissions(role,permission_name,enabled)
select role,permission_name,true from (
  values('ADMIN'::public.staff_role),('DIRECTOR'),('SENIOR_COUNSELLOR'),('ACCOUNTANT'),('MARKETING'),('FINANCE')
) roles(role) cross join (values('b2b.view'),('b2b.create'),('b2b.edit')) permissions(permission_name)
on conflict(role,permission_name) do update set enabled=true;
insert into public.permissions(role,permission_name,enabled)
values('ADMIN','b2b.delete',true),('DIRECTOR','b2b.delete',true)
on conflict(role,permission_name) do update set enabled=true;

drop policy if exists b2b_partners_read on public.b2b_partners;
drop policy if exists b2b_partners_create on public.b2b_partners;
drop policy if exists b2b_partners_update on public.b2b_partners;
drop policy if exists b2b_partners_delete on public.b2b_partners;
create policy b2b_partners_read on public.b2b_partners for select to authenticated using(public.has_permission('b2b.view'));
create policy b2b_partners_create on public.b2b_partners for insert to authenticated with check(public.has_permission('b2b.create'));
create policy b2b_partners_update on public.b2b_partners for update to authenticated using(public.has_permission('b2b.edit')) with check(public.has_permission('b2b.edit'));
create policy b2b_partners_delete on public.b2b_partners for delete to authenticated using(public.has_permission('b2b.delete'));

create or replace function public.has_permission(requested_permission text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from staff_profiles sp
    where sp.id=auth.uid() and sp.is_active and (
      exists(select 1 from staff_permission_overrides o where o.staff_id=sp.id and o.permission_name=requested_permission and o.enabled)
      or (sp.access_mode='ROLE_PLUS' and exists(
        select 1 from permissions p where p.role=sp.role and p.permission_name=requested_permission and p.enabled
      ))
    )
  )
$$;
revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;

create or replace function public.my_effective_permissions()
returns table(permission_name text) language sql stable security definer set search_path=public as $$
  select distinct value from (
    select o.permission_name value from staff_permission_overrides o join staff_profiles sp on sp.id=o.staff_id
      where o.staff_id=auth.uid() and o.enabled and sp.is_active
    union all
    select p.permission_name from permissions p join staff_profiles sp on sp.role=p.role
      where sp.id=auth.uid() and sp.is_active and sp.access_mode='ROLE_PLUS' and p.enabled
  ) effective
$$;
grant execute on function public.my_effective_permissions() to authenticated;

-- Custom access must be authoritative for HR decisions too. The shared permission
-- function still requires an active staff account.
create or replace function public.hr_decide_leave(leave_uuid uuid,decision text,decision_note text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission('hr.approve') then raise exception 'HR leave approval permission required'; end if;
  if decision not in('APPROVED','REJECTED') then raise exception 'Invalid decision'; end if;
  update hr_leave_requests set status=decision,approved_by=auth.uid(),decision_note=hr_decide_leave.decision_note
  where id=leave_uuid and status='PENDING';
  if not found then raise exception 'Pending leave request not found'; end if;
end$$;
