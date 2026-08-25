-- Persist the qualification level selected in the application study-plan flow.
alter table public.university_applications
  add column if not exists study_level text;

alter table public.university_applications
  drop constraint if exists university_applications_study_level_check;

alter table public.university_applications
  add constraint university_applications_study_level_check
  check (study_level is null or char_length(trim(study_level)) between 2 and 100);

create or replace function public.create_university_application(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare sid uuid; aid uuid; selected_stage public.application_stage := 'SUBMITTED'; actor uuid := auth.uid();
begin
  if actor is null or not public.has_permission('applications.edit') then raise exception 'You do not have permission to submit university applications'; end if;
  select id into sid from public.students where student_code = trim(payload->>'student_code');
  if sid is null then raise exception 'The selected student could not be found'; end if;
  if char_length(trim(coalesce(payload->>'university_name',''))) < 2 then raise exception 'Select a university'; end if;
  if char_length(trim(coalesce(payload->>'country',''))) < 2 then raise exception 'Select a destination country'; end if;
  if char_length(trim(coalesce(payload->>'study_level',''))) < 2 then raise exception 'Select a study level'; end if;
  if char_length(trim(coalesce(payload->>'course',''))) < 2 then raise exception 'Select a degree or course'; end if;
  if char_length(trim(coalesce(payload->>'intake',''))) < 2 then raise exception 'Select an intake'; end if;
  if nullif(payload->>'stage','') is not null then selected_stage := (payload->>'stage')::public.application_stage; end if;

  insert into public.university_applications(student_id,university_name,country,study_level,course_name,intake,stage,tuition_fee,scholarship,deadline,officer_id,notes)
  values(sid,trim(payload->>'university_name'),trim(payload->>'country'),trim(payload->>'study_level'),trim(payload->>'course'),trim(payload->>'intake'),selected_stage,nullif(trim(payload->>'tuition_fee'),''),nullif(trim(payload->>'scholarship'),''),nullif(payload->>'deadline','')::date,actor,nullif(trim(payload->>'notes'),''))
  returning id into aid;
  insert into public.application_events(application_id,event_type,to_stage,notes,created_by) values(aid,'APPLICATION_CREATED',selected_stage,'Application created',actor);
  return aid;
end;
$$;

create or replace function public.update_university_application(application_uuid uuid,payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare sid uuid; selected_officer_id uuid; prior_stage public.application_stage; next_stage public.application_stage;
begin
  if not public.has_permission('applications.edit') then raise exception 'Insufficient permission'; end if;
  select stage into prior_stage from public.university_applications where id=application_uuid for update;
  if prior_stage is null then raise exception 'Application not found'; end if;
  select id into sid from public.students where student_code=trim(payload->>'student_code');
  if sid is null then raise exception 'Student code not found'; end if;
  select id into selected_officer_id from public.staff_profiles where lower(full_name)=lower(trim(payload->>'officer')) limit 1;
  next_stage := coalesce(nullif(payload->>'stage','')::public.application_stage,prior_stage);
  update public.university_applications
  set student_id=sid,university_name=trim(payload->>'university_name'),country=trim(payload->>'country'),study_level=nullif(trim(payload->>'study_level'),''),course_name=trim(payload->>'course'),intake=trim(payload->>'intake'),stage=next_stage,deadline=nullif(payload->>'deadline','')::date,tuition_fee=nullif(trim(payload->>'tuition_fee'),''),scholarship=nullif(trim(payload->>'scholarship'),''),officer_id=coalesce(selected_officer_id,officer_id),notes=nullif(trim(payload->>'notes'),'')
  where id=application_uuid;
  insert into public.application_events(application_id,event_type,from_stage,to_stage,notes,created_by) values(application_uuid,'APPLICATION_UPDATED',prior_stage,next_stage,'Application details updated',auth.uid());
end;
$$;

revoke all on function public.create_university_application(jsonb), public.update_university_application(uuid,jsonb) from public;
grant execute on function public.create_university_application(jsonb), public.update_university_application(uuid,jsonb) to authenticated;
