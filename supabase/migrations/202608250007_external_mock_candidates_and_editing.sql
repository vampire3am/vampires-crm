alter table public.mock_test_results alter column class_student_id drop not null;
alter table public.mock_test_results add column if not exists candidate_type text not null default 'INTERNAL' check(candidate_type in('INTERNAL','EXTERNAL'));
alter table public.mock_test_results add column if not exists external_candidate_name text;
alter table public.mock_test_results add column if not exists external_phone text;
alter table public.mock_test_results add column if not exists external_email text;

alter table public.mock_test_bookings alter column class_student_id drop not null;
alter table public.mock_test_bookings add column if not exists candidate_type text not null default 'INTERNAL' check(candidate_type in('INTERNAL','EXTERNAL'));
alter table public.mock_test_bookings add column if not exists external_candidate_name text;
alter table public.mock_test_bookings add column if not exists external_phone text;
alter table public.mock_test_bookings add column if not exists external_email text;

create or replace function public.create_mock_result(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid;rid uuid;code text;ctype text:=coalesce(payload->>'candidate_type','INTERNAL');
begin
 if not public.has_permission('mocks.manage') then raise exception 'Insufficient permission'; end if;
 if ctype='INTERNAL' then select id into sid from class_students where student_code=payload->>'student_code'; if sid is null then raise exception 'Class student not found'; end if;
 elsif nullif(trim(payload->>'external_candidate_name'),'') is null then raise exception 'External candidate name is required'; end if;
 code:='MOCK-'||to_char(now(),'YYYY')||'-'||lpad(nextval('mock_test_number_seq')::text,5,'0');
 insert into mock_test_results(test_code,class_student_id,candidate_type,external_candidate_name,external_phone,external_email,test_type,test_date,venue,examiner,listening,reading,writing,speaking,overall_score,status,examiner_feedback,target_achieved,created_by)
 values(code,sid,ctype,case when ctype='EXTERNAL' then payload->>'external_candidate_name' end,case when ctype='EXTERNAL' then payload->>'external_phone' end,case when ctype='EXTERNAL' then payload->>'external_email' end,payload->>'test_type',(payload->>'test_date')::date,payload->>'venue',payload->>'examiner',nullif(payload->>'listening','')::numeric,nullif(payload->>'reading','')::numeric,nullif(payload->>'writing','')::numeric,nullif(payload->>'speaking','')::numeric,payload->>'overall_score',payload->>'status',payload->>'examiner_feedback',coalesce((payload->>'target_achieved')::boolean,false),auth.uid()) returning id into rid;
 return rid;
end$$;

create or replace function public.update_mock_result(result_uuid uuid,payload jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_permission('mocks.manage') then raise exception 'Insufficient permission'; end if;
 update mock_test_results set test_type=payload->>'test_type',test_date=(payload->>'test_date')::date,venue=payload->>'venue',examiner=payload->>'examiner',listening=nullif(payload->>'listening','')::numeric,reading=nullif(payload->>'reading','')::numeric,writing=nullif(payload->>'writing','')::numeric,speaking=nullif(payload->>'speaking','')::numeric,overall_score=payload->>'overall_score',status=payload->>'status',examiner_feedback=payload->>'examiner_feedback',target_achieved=coalesce((payload->>'target_achieved')::boolean,false),external_candidate_name=case when candidate_type='EXTERNAL' then payload->>'external_candidate_name' else external_candidate_name end,external_phone=case when candidate_type='EXTERNAL' then payload->>'external_phone' else external_phone end,external_email=case when candidate_type='EXTERNAL' then payload->>'external_email' else external_email end where id=result_uuid;
 if not found then raise exception 'Mock result not found'; end if;
end$$;

create or replace function public.book_mock_candidate_v2(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid;capacity integer;occupied integer;ctype text:=coalesce(payload->>'candidate_type','INTERNAL');sid uuid;slot_uuid uuid:=(payload->>'slot_id')::uuid;
begin
 if not public.has_permission('mocks.manage') then raise exception 'Insufficient permission'; end if;
 select total_seats into capacity from mock_test_slots where id=slot_uuid for update; if capacity is null then raise exception 'Mock slot not found'; end if;
 select count(*) into occupied from mock_test_bookings where slot_id=slot_uuid; if occupied>=capacity then raise exception 'This mock-test slot is full'; end if;
 if ctype='INTERNAL' then sid:=(payload->>'class_student_id')::uuid; if sid is null then raise exception 'Select an internal student'; end if; if exists(select 1 from mock_test_bookings where slot_id=slot_uuid and class_student_id=sid) then raise exception 'Candidate is already booked'; end if;
 elsif nullif(trim(payload->>'external_candidate_name'),'') is null then raise exception 'External candidate name is required'; end if;
 insert into mock_test_bookings(slot_id,class_student_id,candidate_type,external_candidate_name,external_phone,external_email,booked_by) values(slot_uuid,sid,ctype,case when ctype='EXTERNAL' then payload->>'external_candidate_name' end,case when ctype='EXTERNAL' then payload->>'external_phone' end,case when ctype='EXTERNAL' then payload->>'external_email' end,auth.uid()) returning id into rid;
 if occupied+1>=capacity then update mock_test_slots set status='FULL' where id=slot_uuid; end if;
 return rid;
end$$;
grant execute on function public.update_mock_result(uuid,jsonb) to authenticated;
grant execute on function public.book_mock_candidate_v2(jsonb) to authenticated;
