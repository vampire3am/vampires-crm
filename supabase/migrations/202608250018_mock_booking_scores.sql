alter table public.mock_test_results add column if not exists booking_id uuid references public.mock_test_bookings(id) on delete set null;
create unique index if not exists mock_test_results_booking_unique on public.mock_test_results(booking_id) where booking_id is not null;

create or replace function public.create_mock_result(payload jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare sid uuid;rid uuid;code text;ctype text:=coalesce(payload->>'candidate_type','INTERNAL');booking_uuid uuid:=nullif(payload->>'booking_id','')::uuid;slot_uuid uuid:=nullif(payload->>'slot_id','')::uuid;booking_record record;ext_name text:=payload->>'external_candidate_name';ext_phone text:=payload->>'external_phone';ext_email text:=payload->>'external_email';
begin
 if not public.has_permission('mocks.manage') then raise exception 'Insufficient permission'; end if;
 if booking_uuid is not null then
   select * into booking_record from mock_test_bookings where id=booking_uuid;
   if booking_record.id is null then raise exception 'Scheduled candidate registration not found'; end if;
   if exists(select 1 from mock_test_results where booking_id=booking_uuid) then raise exception 'A score already exists for this scheduled candidate. Use Update score.'; end if;
   sid:=booking_record.class_student_id;ctype:=booking_record.candidate_type;slot_uuid:=booking_record.slot_id;ext_name:=booking_record.external_candidate_name;ext_phone:=booking_record.external_phone;ext_email:=booking_record.external_email;
 else
   if ctype='INTERNAL' then select id into sid from class_students where student_code=payload->>'student_code'; if sid is null then raise exception 'Class student not found'; end if;
   elsif nullif(trim(payload->>'external_candidate_name'),'') is null then raise exception 'External candidate name is required'; end if;
 end if;
 code:='MOCK-'||to_char(now(),'YYYY')||'-'||lpad(nextval('mock_test_number_seq')::text,5,'0');
 insert into mock_test_results(test_code,class_student_id,slot_id,booking_id,candidate_type,external_candidate_name,external_phone,external_email,test_type,test_date,venue,examiner,listening,reading,writing,speaking,overall_score,status,examiner_feedback,target_achieved,created_by)
 values(code,sid,slot_uuid,booking_uuid,ctype,
 case when ctype='EXTERNAL' then ext_name end,case when ctype='EXTERNAL' then ext_phone end,case when ctype='EXTERNAL' then ext_email end,
 payload->>'test_type',(payload->>'test_date')::date,payload->>'venue',payload->>'examiner',nullif(payload->>'listening','')::numeric,nullif(payload->>'reading','')::numeric,nullif(payload->>'writing','')::numeric,nullif(payload->>'speaking','')::numeric,payload->>'overall_score',payload->>'status',payload->>'examiner_feedback',coalesce((payload->>'target_achieved')::boolean,false),auth.uid()) returning id into rid;
 return rid;
end$$;

create or replace function public.update_mock_result(result_uuid uuid,payload jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.has_permission('mocks.manage') then raise exception 'Insufficient permission'; end if;
 update mock_test_results set
   booking_id=coalesce(nullif(payload->>'booking_id','')::uuid,booking_id),slot_id=coalesce(nullif(payload->>'slot_id','')::uuid,slot_id),
   test_type=payload->>'test_type',test_date=(payload->>'test_date')::date,venue=payload->>'venue',examiner=payload->>'examiner',listening=nullif(payload->>'listening','')::numeric,reading=nullif(payload->>'reading','')::numeric,writing=nullif(payload->>'writing','')::numeric,speaking=nullif(payload->>'speaking','')::numeric,overall_score=payload->>'overall_score',status=payload->>'status',examiner_feedback=payload->>'examiner_feedback',target_achieved=coalesce((payload->>'target_achieved')::boolean,false),external_candidate_name=case when candidate_type='EXTERNAL' then payload->>'external_candidate_name' else external_candidate_name end,external_phone=case when candidate_type='EXTERNAL' then payload->>'external_phone' else external_phone end,external_email=case when candidate_type='EXTERNAL' then payload->>'external_email' else external_email end
 where id=result_uuid;
 if not found then raise exception 'Mock result not found'; end if;
end$$;
