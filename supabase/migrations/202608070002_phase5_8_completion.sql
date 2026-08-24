create or replace function public.log_student_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.status is distinct from new.status then
    insert into activity_logs(student_id,action,metadata,created_by) values(new.id,'STATUS_CHANGED',jsonb_build_object('from',old.status,'to',new.status),auth.uid());
  elsif row(old.*) is distinct from row(new.*) then
    insert into activity_logs(student_id,action,created_by) values(new.id,'STUDENT_UPDATED',auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists audit_student_change on public.students;
create trigger audit_student_change after update on public.students for each row execute function public.log_student_change();

create or replace function public.log_counselling_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into activity_logs(student_id,action,metadata,created_by) values(new.student_id,'COUNSELLING_NOTE_ADDED',jsonb_build_object('follow_up_date',new.follow_up_date,'assigned_staff',new.assigned_staff),new.created_by);
  return new;
end $$;
drop trigger if exists audit_counselling_insert on public.counselling_records;
create trigger audit_counselling_insert after insert on public.counselling_records for each row execute function public.log_counselling_change();

drop policy if exists counselling_staff_update on public.counselling_records;
create policy counselling_staff_update on public.counselling_records for update using (public.is_active_staff()) with check (public.is_active_staff());

create or replace function public.update_student_record(student_uuid uuid, payload jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_active_staff() then raise exception 'Unauthorized'; end if;
  update students set full_name=payload->>'full_name',gender=payload->>'gender',dob=(payload->>'dob')::date,whatsapp=payload->>'whatsapp',email=payload->>'email',current_address=nullif(payload->>'current_address','') where id=student_uuid;
  update academic_information set highest_qualification=payload->>'highest_qualification',current_status=payload->>'current_status',latest_result=payload->>'latest_result',study_gap=payload->>'study_gap',employment_status=payload->>'employment_status' where student_id=student_uuid;
  update study_preferences set preferred_country=payload->>'preferred_country',second_country=nullif(payload->>'second_country',''),preferred_intake=payload->>'preferred_intake',preferred_course=payload->>'preferred_course',budget=nullif(payload->>'budget','')::numeric where student_id=student_uuid;
  update english_tests set test_taken=(payload->>'test_taken')::boolean,test_type=case when (payload->>'test_taken')::boolean then payload->>'test_type' else null end,score=case when (payload->>'test_taken')::boolean then payload->>'score' else null end where student_id=student_uuid;
  update passport_information set has_passport=(payload->>'has_passport')::boolean where student_id=student_uuid;
  update additional_information set lead_source=payload->>'lead_source',message=nullif(payload->>'message','') where student_id=student_uuid;
end $$;
grant execute on function public.update_student_record(uuid,jsonb) to authenticated;

create or replace function public.dashboard_summary() returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object(
 'total',(select count(*) from students),
 'today',(select count(*) from students where created_at >= date_trunc('day',timezone('Asia/Kathmandu',now())) at time zone 'Asia/Kathmandu'),
 'month',(select count(*) from students where created_at >= date_trunc('month',timezone('Asia/Kathmandu',now())) at time zone 'Asia/Kathmandu'),
 'pending',(select count(*) from students where status='COUNSELLING_PENDING'),
 'trend',(select coalesce(jsonb_agg(x order by x.month_bucket),'[]') from (select date_trunc('month',created_at) as month_bucket,to_char(created_at,'Mon') as name,count(*) as value from students where created_at >= (now() - make_interval(months => 6)) group by date_trunc('month',created_at),to_char(created_at,'Mon')) x),
 'countries',(select coalesce(jsonb_agg(x order by x.value desc),'[]') from (select preferred_country name,count(*) value from study_preferences group by preferred_country limit 6) x),
 'tests',(select coalesce(jsonb_agg(x),'[]') from (select coalesce(test_type,'None') name,count(*) value from english_tests group by 1) x),
 'recent',(select coalesce(jsonb_agg(x),'[]') from (select s.id,s.full_name,s.student_code,s.created_at,p.preferred_country from students s left join study_preferences p on p.student_id=s.id order by s.created_at desc limit 5) x)
) where public.is_active_staff()
$$;
grant execute on function public.dashboard_summary() to authenticated;
