-- Persist the Abroad destination catalogue in the shared CRM database.
create table if not exists public.study_destination_catalog (
  code text primary key check (char_length(code) = 2),
  name text not null unique,
  currency text not null,
  dial_code text not null,
  region text not null,
  universities_count integer not null default 0 check (universities_count >= 0),
  courses_count integer not null default 0 check (courses_count >= 0),
  active_processing integer not null default 0 check (active_processing >= 0),
  visas_approved integer not null default 0 check (visas_approved >= 0),
  visa_success_rate text not null default '0%',
  avg_tuition text not null default '',
  avg_living_cost text not null default '',
  pswv_work_rights text not null default '',
  accepted_english_tests text[] not null default '{}',
  popular_intakes text[] not null default '{}',
  intake_cycles text[] not null default '{}',
  key_highlights text not null default '',
  created_by uuid references public.staff_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_destination_catalog enable row level security;
drop policy if exists study_destination_catalog_read on public.study_destination_catalog;
drop policy if exists study_destination_catalog_manage on public.study_destination_catalog;
create policy study_destination_catalog_read on public.study_destination_catalog
  for select to authenticated using (public.has_permission('counselling.view'));
create policy study_destination_catalog_manage on public.study_destination_catalog
  for all to authenticated using (public.has_permission('counselling.edit'))
  with check (public.has_permission('counselling.edit'));

create or replace function public.save_study_destination(payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission('counselling.edit') then raise exception 'Insufficient permission'; end if;
  insert into study_destination_catalog (
    code,name,currency,dial_code,region,universities_count,courses_count,active_processing,
    visas_approved,visa_success_rate,avg_tuition,avg_living_cost,pswv_work_rights,
    accepted_english_tests,popular_intakes,intake_cycles,key_highlights,created_by,updated_at
  ) values (
    upper(payload->>'code'),payload->>'name',payload->>'currency',payload->>'dial_code',payload->>'region',
    coalesce((payload->>'universities_count')::integer,0),coalesce((payload->>'courses_count')::integer,0),
    coalesce((payload->>'active_processing')::integer,0),coalesce((payload->>'visas_approved')::integer,0),
    coalesce(payload->>'visa_success_rate','0%'),coalesce(payload->>'avg_tuition',''),
    coalesce(payload->>'avg_living_cost',''),coalesce(payload->>'pswv_work_rights',''),
    coalesce(array(select jsonb_array_elements_text(payload->'accepted_english_tests')),'{}'),
    coalesce(array(select jsonb_array_elements_text(payload->'popular_intakes')),'{}'),
    coalesce(array(select jsonb_array_elements_text(payload->'intake_cycles')),'{}'),
    coalesce(payload->>'key_highlights',''),auth.uid(),now()
  ) on conflict (code) do update set
    name=excluded.name,currency=excluded.currency,dial_code=excluded.dial_code,region=excluded.region,
    universities_count=excluded.universities_count,courses_count=excluded.courses_count,
    active_processing=excluded.active_processing,visas_approved=excluded.visas_approved,
    visa_success_rate=excluded.visa_success_rate,avg_tuition=excluded.avg_tuition,
    avg_living_cost=excluded.avg_living_cost,pswv_work_rights=excluded.pswv_work_rights,
    accepted_english_tests=excluded.accepted_english_tests,popular_intakes=excluded.popular_intakes,
    intake_cycles=excluded.intake_cycles,key_highlights=excluded.key_highlights,updated_at=now();
end $$;

create or replace function public.delete_study_destination(destination_code text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission('counselling.edit') then raise exception 'Insufficient permission'; end if;
  delete from study_destination_catalog where code=upper(destination_code);
end $$;

revoke all on function public.save_study_destination(jsonb), public.delete_study_destination(text) from public;
grant execute on function public.save_study_destination(jsonb), public.delete_study_destination(text) to authenticated;
