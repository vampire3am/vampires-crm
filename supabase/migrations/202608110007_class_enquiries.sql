create sequence if not exists public.class_enquiry_number_seq;

create table if not exists public.class_enquiries (
  id uuid primary key default gen_random_uuid(),
  enquiry_code text not null unique,
  full_name text not null check (char_length(trim(full_name)) between 2 and 150),
  whatsapp text not null,
  email text not null,
  class_type text not null check (class_type in ('IELTS','PTE','DET','GERMAN_LANGUAGE')),
  class_mode text not null check (class_mode in ('PHYSICAL','ONLINE','HYBRID')),
  current_level text not null check (current_level in ('BASIC','INTERMEDIATE','ADVANCED','A1','A2','B1')),
  needs_counselling boolean not null default false,
  preferred_country text,
  message text,
  consented_at timestamptz not null default now(),
  status text not null default 'NEW_ENQUIRY' check (status in ('NEW_ENQUIRY','CONTACTED','TRIAL_SCHEDULED','ENROLLED','CLOSED')),
  assigned_staff uuid references public.staff_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_level_matches_type check (
    (class_type='GERMAN_LANGUAGE' and current_level in ('A1','A2','B1')) or
    (class_type in ('IELTS','PTE','DET') and current_level in ('BASIC','INTERMEDIATE','ADVANCED'))
  ),
  constraint counselling_country_required check (
    (needs_counselling and preferred_country is not null) or
    (not needs_counselling and preferred_country is null)
  )
);

create index if not exists class_enquiries_created_idx on public.class_enquiries(created_at desc);
create index if not exists class_enquiries_status_idx on public.class_enquiries(status);
create index if not exists class_enquiries_type_idx on public.class_enquiries(class_type);

create table if not exists public.class_enquiry_submission_limits (
  fingerprint text primary key,
  last_submitted_at timestamptz not null default now(),
  attempts integer not null default 1
);

alter table public.class_enquiries enable row level security;
alter table public.class_enquiry_submission_limits enable row level security;

drop policy if exists class_enquiries_staff_read on public.class_enquiries;
create policy class_enquiries_staff_read on public.class_enquiries for select to authenticated using (public.is_active_staff());
drop policy if exists class_enquiries_staff_update on public.class_enquiries;
create policy class_enquiries_staff_update on public.class_enquiries for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
drop policy if exists class_enquiries_manager_delete on public.class_enquiries;
create policy class_enquiries_manager_delete on public.class_enquiries for delete to authenticated using (public.is_manager());

drop trigger if exists touch_class_enquiries on public.class_enquiries;
create trigger touch_class_enquiries before update on public.class_enquiries for each row execute function public.touch_updated_at();

grant select,update on public.class_enquiries to authenticated;
grant delete on public.class_enquiries to authenticated;

create or replace function public.submit_class_enquiry(payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  eid uuid;
  code text;
  year_text text:=to_char(timezone('Asia/Kathmandu',now()),'YYYY');
  clean_phone text:=regexp_replace(coalesce(payload->>'whatsapp',''),'\D','','g');
  clean_email text:=lower(trim(coalesce(payload->>'email','')));
  fp text:=md5('class:'||lower(trim(coalesce(payload->>'email','')))||regexp_replace(coalesce(payload->>'whatsapp',''),'\D','','g'));
  prior public.class_enquiry_submission_limits%rowtype;
  wants_counselling boolean:=coalesce((payload->>'needs_counselling')::boolean,false);
begin
  if coalesce(payload->>'website','')<>'' then raise exception 'Submission rejected'; end if;
  if coalesce((payload->>'consent')::boolean,false)=false then raise exception 'Consent is required'; end if;
  if length(trim(coalesce(payload->>'full_name',''))) not between 2 and 150 then raise exception 'Enter a valid full name'; end if;
  if length(clean_phone)<>10 then raise exception 'Enter a 10-digit WhatsApp number'; end if;
  if clean_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'Enter a valid email'; end if;
  if coalesce(payload->>'class_type','') not in ('IELTS','PTE','DET','GERMAN_LANGUAGE') then raise exception 'Select a class'; end if;
  if coalesce(payload->>'class_mode','') not in ('PHYSICAL','ONLINE','HYBRID') then raise exception 'Select a class mode'; end if;
  if payload->>'class_type'='GERMAN_LANGUAGE' and coalesce(payload->>'current_level','') not in ('A1','A2','B1') then raise exception 'Select a German level'; end if;
  if payload->>'class_type' in ('IELTS','PTE','DET') and coalesce(payload->>'current_level','') not in ('BASIC','INTERMEDIATE','ADVANCED') then raise exception 'Select a preparation level'; end if;
  if wants_counselling and coalesce(payload->>'preferred_country','') not in ('Australia','UK','USA','New Zealand','Canada','Germany','Finland','Malta','Cyprus','Sweden','Belgium','Hungary','Netherlands','Ireland','Japan','South Korea') then raise exception 'Select a counselling country'; end if;
  select * into prior from public.class_enquiry_submission_limits where fingerprint=fp;
  if prior.last_submitted_at>now()-interval '24 hours' and prior.attempts>=3 then raise exception 'Too many submissions. Please contact AECS.'; end if;
  if exists(select 1 from public.class_enquiries where (lower(email)=clean_email or regexp_replace(whatsapp,'\D','','g')=clean_phone) and class_type=payload->>'class_type' and created_at>now()-interval '24 hours') then raise exception 'A recent enquiry for this class already exists. Our team will contact you soon.'; end if;
  code:='CLASS-'||year_text||'-'||lpad(nextval('public.class_enquiry_number_seq')::text,5,'0');
  insert into public.class_enquiries(enquiry_code,full_name,whatsapp,email,class_type,class_mode,current_level,needs_counselling,preferred_country,message)
  values(code,trim(payload->>'full_name'),clean_phone,clean_email,payload->>'class_type',payload->>'class_mode',payload->>'current_level',wants_counselling,case when wants_counselling then payload->>'preferred_country' else null end,nullif(trim(payload->>'message'),'')) returning id into eid;
  insert into public.class_enquiry_submission_limits(fingerprint,last_submitted_at,attempts) values(fp,now(),1)
  on conflict(fingerprint) do update set last_submitted_at=now(),attempts=case when public.class_enquiry_submission_limits.last_submitted_at<now()-interval '24 hours' then 1 else public.class_enquiry_submission_limits.attempts+1 end;
  return jsonb_build_object('id',eid,'enquiry_code',code,'status','NEW_ENQUIRY');
end $$;

revoke all on function public.submit_class_enquiry(jsonb) from public;
grant execute on function public.submit_class_enquiry(jsonb) to anon,authenticated;
