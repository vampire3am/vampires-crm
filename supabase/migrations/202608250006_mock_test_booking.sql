create table if not exists public.mock_test_bookings(
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.mock_test_slots(id) on delete cascade,
  class_student_id uuid not null references public.class_students(id) on delete cascade,
  booked_by uuid not null references public.staff_profiles(id),
  booked_at timestamptz not null default now(),
  unique(slot_id,class_student_id)
);

alter table public.mock_test_bookings enable row level security;
drop policy if exists mock_test_bookings_read on public.mock_test_bookings;
create policy mock_test_bookings_read on public.mock_test_bookings for select to authenticated
using(public.has_permission('classes.view'));

create or replace function public.book_mock_candidate(slot_uuid uuid,class_student_uuid uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  booking_id uuid;
  capacity integer;
  occupied integer;
  slot_status text;
begin
  if not public.has_permission('mocks.manage') then raise exception 'Insufficient permission'; end if;
  select total_seats,status into capacity,slot_status from public.mock_test_slots where id=slot_uuid for update;
  if capacity is null then raise exception 'Mock-test slot not found'; end if;
  if slot_status<>'OPEN' then raise exception 'This mock-test slot is not open'; end if;
  if not exists(select 1 from public.class_students where id=class_student_uuid) then raise exception 'Class student not found'; end if;
  select count(*) into occupied from public.mock_test_bookings where slot_id=slot_uuid;
  if occupied>=capacity then raise exception 'This mock-test slot is full'; end if;
  insert into public.mock_test_bookings(slot_id,class_student_id,booked_by)
  values(slot_uuid,class_student_uuid,auth.uid()) returning id into booking_id;
  if occupied+1>=capacity then update public.mock_test_slots set status='FULL' where id=slot_uuid; end if;
  return booking_id;
exception when unique_violation then
  raise exception 'This candidate is already booked in the selected slot';
end
$$;

revoke all on function public.book_mock_candidate(uuid,uuid) from public;
grant execute on function public.book_mock_candidate(uuid,uuid) to authenticated;
