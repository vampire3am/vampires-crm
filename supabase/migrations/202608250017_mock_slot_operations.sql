alter table public.mock_test_slots drop constraint if exists mock_test_slots_status_check;
alter table public.mock_test_slots add constraint mock_test_slots_status_check
check(status in('OPEN','FULL','COMPLETED','CANCELLED','POSTPONED'));

create or replace function public.update_mock_slot_status(slot_uuid uuid,new_status text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission('mocks.manage') then raise exception 'Insufficient permission'; end if;
  if new_status not in('OPEN','FULL','COMPLETED','CANCELLED','POSTPONED') then raise exception 'Invalid mock-test status'; end if;
  update mock_test_slots set status=new_status where id=slot_uuid;
  if not found then raise exception 'Mock-test slot not found'; end if;
end$$;

create or replace function public.book_mock_candidate_v2(payload jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare rid uuid;capacity integer;occupied integer;ctype text:=coalesce(payload->>'candidate_type','INTERNAL');sid uuid;slot_uuid uuid:=(payload->>'slot_id')::uuid;slot_status text;
begin
 if not public.has_permission('mocks.manage') then raise exception 'Insufficient permission'; end if;
 select total_seats,status into capacity,slot_status from mock_test_slots where id=slot_uuid for update;
 if capacity is null then raise exception 'Mock slot not found'; end if;
 if slot_status<>'OPEN' then raise exception 'Only open mock-test slots accept registrations'; end if;
 select count(*) into occupied from mock_test_bookings where slot_id=slot_uuid;
 if occupied>=capacity then raise exception 'This mock-test slot is full'; end if;
 if ctype='INTERNAL' then sid:=(payload->>'class_student_id')::uuid; if sid is null then raise exception 'Select an internal student'; end if; if exists(select 1 from mock_test_bookings where slot_id=slot_uuid and class_student_id=sid) then raise exception 'Candidate is already booked'; end if;
 elsif nullif(trim(payload->>'external_candidate_name'),'') is null then raise exception 'External candidate name is required'; end if;
 insert into mock_test_bookings(slot_id,class_student_id,candidate_type,external_candidate_name,external_phone,external_email,booked_by)
 values(slot_uuid,sid,ctype,case when ctype='EXTERNAL' then payload->>'external_candidate_name' end,case when ctype='EXTERNAL' then payload->>'external_phone' end,case when ctype='EXTERNAL' then payload->>'external_email' end,auth.uid()) returning id into rid;
 if occupied+1>=capacity then update mock_test_slots set status='FULL' where id=slot_uuid; end if;
 return rid;
end$$;

revoke all on function public.update_mock_slot_status(uuid,text) from public;
grant execute on function public.update_mock_slot_status(uuid,text) to authenticated;
