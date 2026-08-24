create or replace function public.update_student_record(student_uuid uuid, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_staff() then raise exception 'Unauthorized'; end if;

  update students set
    full_name = payload->>'full_name', gender = payload->>'gender',
    dob = nullif(payload->>'dob','')::date, whatsapp = payload->>'whatsapp',
    email = payload->>'email', current_address = nullif(payload->>'current_address','')
  where id = student_uuid;

  insert into academic_information(student_id,highest_qualification,current_status,latest_result,study_gap,employment_status)
  values(student_uuid,payload->>'highest_qualification',payload->>'current_status',payload->>'latest_result',payload->>'study_gap',payload->>'employment_status')
  on conflict (student_id) do update set highest_qualification=excluded.highest_qualification,current_status=excluded.current_status,latest_result=excluded.latest_result,study_gap=excluded.study_gap,employment_status=excluded.employment_status;

  insert into study_preferences(student_id,preferred_country,second_country,preferred_intake,preferred_course,budget)
  values(student_uuid,payload->>'preferred_country',nullif(payload->>'second_country',''),payload->>'preferred_intake',payload->>'preferred_course',nullif(payload->>'budget','')::numeric)
  on conflict (student_id) do update set preferred_country=excluded.preferred_country,second_country=excluded.second_country,preferred_intake=excluded.preferred_intake,preferred_course=excluded.preferred_course,budget=excluded.budget;

  insert into english_tests(student_id,test_taken,test_type,score)
  values(student_uuid,coalesce((payload->>'test_taken')::boolean,false),case when coalesce((payload->>'test_taken')::boolean,false) then nullif(payload->>'test_type','') end,case when coalesce((payload->>'test_taken')::boolean,false) then nullif(payload->>'score','') end)
  on conflict (student_id) do update set test_taken=excluded.test_taken,test_type=excluded.test_type,score=excluded.score;

  insert into passport_information(student_id,has_passport)
  values(student_uuid,coalesce((payload->>'has_passport')::boolean,false))
  on conflict (student_id) do update set has_passport=excluded.has_passport;

  insert into additional_information(student_id,lead_source,message)
  values(student_uuid,payload->>'lead_source',nullif(payload->>'message',''))
  on conflict (student_id) do update set lead_source=excluded.lead_source,message=excluded.message;

  insert into activity_logs(student_id,action,metadata,created_by)
  values(student_uuid,'STUDENT_PROFILE_UPDATED',jsonb_build_object('test_taken',coalesce((payload->>'test_taken')::boolean,false),'test_type',payload->>'test_type','score',payload->>'score'),auth.uid());
end
$$;

revoke all on function public.update_student_record(uuid,jsonb) from public;
grant execute on function public.update_student_record(uuid,jsonb) to authenticated;
