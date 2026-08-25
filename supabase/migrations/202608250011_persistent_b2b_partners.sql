create table if not exists public.b2b_partners(
  id text primary key,
  code text not null unique,
  name text not null,
  partner_type text not null,
  country text not null,
  country_code text not null default '',
  city text not null default '',
  photo_url text not null default '',
  contact_person text not null,
  contact_email text not null,
  contact_phone text not null,
  status text not null,
  commission_terms text not null default '',
  agreement_status text not null,
  agreement_expiry date,
  assigned_staff text not null default '',
  next_follow_up date,
  referred_students_count integer not null default 0,
  total_payout_claimed text not null default 'NPR 0',
  notes text not null default '',
  created_by uuid references public.staff_profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.b2b_partners enable row level security;
drop policy if exists b2b_partners_read on public.b2b_partners;
drop policy if exists b2b_partners_create on public.b2b_partners;
drop policy if exists b2b_partners_update on public.b2b_partners;
drop policy if exists b2b_partners_delete on public.b2b_partners;
create policy b2b_partners_read on public.b2b_partners for select to authenticated using(public.is_active_staff());
create policy b2b_partners_create on public.b2b_partners for insert to authenticated with check(public.is_active_staff());
create policy b2b_partners_update on public.b2b_partners for update to authenticated using(public.is_active_staff()) with check(public.is_active_staff());
create policy b2b_partners_delete on public.b2b_partners for delete to authenticated using(public.is_manager());

create or replace function public.touch_b2b_partner() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end$$;
drop trigger if exists b2b_partner_touch on public.b2b_partners;
create trigger b2b_partner_touch before update on public.b2b_partners for each row execute function public.touch_b2b_partner();
