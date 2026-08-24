-- ==========================================================================
-- AECS CONSULTANCY CRM — PHASE 3 COMPLETE OPERATIONAL ECOSYSTEM MIGRATION
-- Database Schema for Applications, Test Prep Batches, Invoices & COA
-- ==========================================================================

-- 1. University Applications & Visas Table
create type public.application_stage as enum (
  'DRAFT',
  'SUBMITTED',
  'CONDITIONAL_OFFER',
  'UNCONDITIONAL_OFFER',
  'CAS_ISSUED',
  'VISA_LODGED',
  'VISA_APPROVED',
  'VISA_REJECTED',
  'ENROLLED'
);

create table if not exists public.university_applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  university_name text not null check (char_length(university_name) between 2 and 200),
  country text not null check (country in ('UK','Australia','Canada','USA','Germany','Finland','Japan','Other')),
  course_name text not null,
  intake text not null,
  stage public.application_stage not null default 'SUBMITTED',
  tuition_fee text,
  scholarship text,
  deadline date,
  officer_id uuid references public.staff_profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists uni_apps_student_idx on public.university_applications(student_id);
create index if not exists uni_apps_country_stage_idx on public.university_applications(country, stage);

-- 2. Test Prep & Language Batches Table
create type public.batch_course_type as enum (
  'IELTS_PREP',
  'PTE_ACADEMIC',
  'DUOLINGO_DET',
  'GERMAN_A1',
  'GERMAN_A2',
  'JAPANESE_N5',
  'SAT_PREP'
);

create type public.batch_status as enum ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

create table if not exists public.test_prep_batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null unique,
  course_type public.batch_course_type not null,
  title text not null,
  timing text not null,
  room text not null,
  instructor_name text not null,
  instructor_id uuid references public.staff_profiles(id),
  max_capacity integer not null default 20 check (max_capacity > 0),
  start_date date not null,
  status public.batch_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.batch_enrollments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.test_prep_batches(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  mock_score text,
  attendance_rate numeric(5,2) default 100.0,
  enrolled_at timestamptz not null default now(),
  constraint unique_batch_student unique (batch_id, student_id)
);

-- 3. Student Invoices & Billing Table
create type public.invoice_status as enum ('DRAFT', 'PENDING', 'PAID', 'CANCELLED', 'REFUNDED');

create sequence if not exists public.invoice_number_seq;

create table if not exists public.student_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  student_id uuid not null references public.students(id) on delete cascade,
  account_code text not null default '4112',
  service_description text not null,
  amount_npr numeric(12,2) not null check (amount_npr >= 0),
  payment_method text not null default 'eSewa',
  status public.invoice_status not null default 'PAID',
  issued_by uuid references public.staff_profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_student_idx on public.student_invoices(student_id);
create index if not exists invoices_status_idx on public.student_invoices(status);

-- 4. Chart of Accounts Master Table (454 Accounts)
create table if not exists public.chart_of_accounts (
  code text primary key,
  name text not null,
  type text not null,
  classification text not null,
  parent_code text references public.chart_of_accounts(code),
  normal_balance text not null check (normal_balance in ('Debit', 'Credit')),
  is_posting boolean not null default true,
  description text,
  level integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 5. Row Level Security Policies
alter table public.university_applications enable row level security;
alter table public.test_prep_batches enable row level security;
alter table public.batch_enrollments enable row level security;
alter table public.student_invoices enable row level security;
alter table public.chart_of_accounts enable row level security;

-- Allow active staff to read and manage application records
create policy staff_applications_policy on public.university_applications
  for all using (public.is_active_staff());

create policy staff_batches_policy on public.test_prep_batches
  for all using (public.is_active_staff());

create policy staff_enrollments_policy on public.batch_enrollments
  for all using (public.is_active_staff());

create policy staff_invoices_policy on public.student_invoices
  for all using (public.is_active_staff());

create policy staff_coa_policy on public.chart_of_accounts
  for all using (public.is_active_staff());
