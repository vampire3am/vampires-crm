create extension if not exists citext;

create type public.staff_role as enum ('ADMIN','DIRECTOR','FRONT_DESK','COUNSELLOR','DOCUMENTATION','FINANCE','TEST_BOOKING');
create type public.student_status as enum ('NEW_LEAD','COUNSELLING_PENDING','COUNSELLING_COMPLETED','APPLICATION_STARTED','APPLICATION_SUBMITTED','COMPLETED');

create table public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email citext not null unique,
  role public.staff_role not null default 'FRONT_DESK',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.student_number_seq;
create table public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text not null unique,
  full_name text not null check (char_length(full_name) between 2 and 150),
  gender text not null check (gender in ('Male','Female','Other','Prefer not to say')),
  dob date not null check (dob <= current_date),
  whatsapp text not null,
  email citext not null,
  current_address text,
  status public.student_status not null default 'NEW_LEAD',
  assigned_counsellor uuid references public.staff_profiles(id),
  created_by uuid not null references public.staff_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index students_name_idx on public.students using gin (to_tsvector('simple', full_name));
create index students_email_idx on public.students(email);
create index students_whatsapp_idx on public.students(whatsapp);
create index students_status_created_idx on public.students(status, created_at desc);

create table public.academic_information (
  id uuid primary key default gen_random_uuid(), student_id uuid not null unique references public.students(id) on delete cascade,
  highest_qualification text not null, current_status text not null, latest_result text, study_gap text, employment_status text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.study_preferences (
  id uuid primary key default gen_random_uuid(), student_id uuid not null unique references public.students(id) on delete cascade,
  preferred_country text not null, second_country text, preferred_intake text not null, preferred_course text not null,
  budget numeric(14,2), budget_currency text not null default 'NPR', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index study_preferences_country_idx on public.study_preferences(preferred_country);
create table public.english_tests (
  id uuid primary key default gen_random_uuid(), student_id uuid not null unique references public.students(id) on delete cascade,
  test_taken boolean not null default false, test_type text, score text,
  constraint english_test_details check ((not test_taken and test_type is null and score is null) or (test_taken and test_type in ('IELTS','PTE','Duolingo','TOEFL','GRE','SAT') and score is not null)),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.passport_information (
  id uuid primary key default gen_random_uuid(), student_id uuid not null unique references public.students(id) on delete cascade,
  has_passport boolean not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.additional_information (
  id uuid primary key default gen_random_uuid(), student_id uuid not null unique references public.students(id) on delete cascade,
  lead_source text not null, message text check (char_length(message) <= 2000), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.activity_logs (
  id bigint generated always as identity primary key, student_id uuid not null references public.students(id) on delete cascade,
  action text not null, metadata jsonb not null default '{}'::jsonb, created_by uuid not null references public.staff_profiles(id), created_at timestamptz not null default now()
);
create index activity_logs_student_created_idx on public.activity_logs(student_id, created_at desc);
create table public.counselling_records (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  assigned_staff uuid not null references public.staff_profiles(id), notes text not null, follow_up_date date,
  created_by uuid not null references public.staff_profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index counselling_follow_up_idx on public.counselling_records(follow_up_date);

create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['staff_profiles','students','academic_information','study_preferences','english_tests','passport_information','additional_information','counselling_records'] loop execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t); end loop; end $$;

create function public.is_active_staff() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from staff_profiles where id=auth.uid() and is_active) $$;
create function public.is_manager() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from staff_profiles where id=auth.uid() and is_active and role in ('ADMIN','DIRECTOR')) $$;

create or replace function public.register_student(payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare sid uuid; code text; actor uuid := auth.uid(); year_text text := to_char(timezone('Asia/Kathmandu', now()), 'YYYY');
begin
  if not public.is_active_staff() then raise exception 'Unauthorized'; end if;
  if exists(select 1 from students where lower(email::text)=lower(payload->>'email') or regexp_replace(whatsapp,'\D','','g')=regexp_replace(payload->>'whatsapp','\D','','g')) then raise exception 'A student with this email or WhatsApp number already exists'; end if;
  code := 'AECS-'||year_text||'-'||lpad(nextval('student_number_seq')::text,5,'0');
  insert into students(student_code,full_name,gender,dob,whatsapp,email,current_address,created_by) values(code,payload->>'full_name',payload->>'gender',(payload->>'dob')::date,payload->>'whatsapp',payload->>'email',nullif(payload->>'current_address',''),actor) returning id into sid;
  insert into academic_information(student_id,highest_qualification,current_status,latest_result,study_gap,employment_status) values(sid,payload->>'highest_qualification',payload->>'current_status',payload->>'latest_result',payload->>'study_gap',payload->>'employment_status');
  insert into study_preferences(student_id,preferred_country,second_country,preferred_intake,preferred_course,budget) values(sid,payload->>'preferred_country',nullif(payload->>'second_country',''),payload->>'preferred_intake',payload->>'preferred_course',nullif(payload->>'budget','')::numeric);
  insert into english_tests(student_id,test_taken,test_type,score) values(sid,(payload->>'test_taken')::boolean,case when (payload->>'test_taken')::boolean then payload->>'test_type' else null end,case when (payload->>'test_taken')::boolean then payload->>'score' else null end);
  insert into passport_information(student_id,has_passport) values(sid,(payload->>'has_passport')::boolean);
  insert into additional_information(student_id,lead_source,message) values(sid,payload->>'lead_source',nullif(payload->>'message',''));
  insert into activity_logs(student_id,action,created_by) values(sid,'STUDENT_CREATED',actor);
  return jsonb_build_object('id',sid,'student_code',code,'status','NEW_LEAD');
end $$;

alter table public.staff_profiles enable row level security; alter table public.students enable row level security;
alter table public.academic_information enable row level security; alter table public.study_preferences enable row level security;
alter table public.english_tests enable row level security; alter table public.passport_information enable row level security;
alter table public.additional_information enable row level security; alter table public.activity_logs enable row level security; alter table public.counselling_records enable row level security;
create policy staff_self_read on public.staff_profiles for select using (id=auth.uid() or public.is_active_staff());
create policy staff_manager_write on public.staff_profiles for all using (public.is_manager()) with check (public.is_manager());
do $$ declare t text; begin foreach t in array array['students','academic_information','study_preferences','english_tests','passport_information','additional_information','activity_logs','counselling_records'] loop execute format('create policy active_staff_read_%I on public.%I for select using (public.is_active_staff())',t,t); end loop; end $$;
create policy students_staff_update on public.students for update using (public.is_active_staff()) with check (public.is_active_staff());
create policy students_manager_delete on public.students for delete using (public.is_manager());
create policy counselling_staff_write on public.counselling_records for insert with check (public.is_active_staff() and created_by=auth.uid());
grant execute on function public.register_student(jsonb) to authenticated;
