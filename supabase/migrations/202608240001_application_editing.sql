-- Allow authorized admissions staff to edit a complete university application.
create or replace function public.update_university_application(
  application_uuid uuid,
  payload jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  selected_officer_id uuid;
  prior_stage public.application_stage;
  next_stage public.application_stage;
begin
  if not public.has_permission('applications.edit') then
    raise exception 'Insufficient permission';
  end if;

  select stage into prior_stage
  from public.university_applications
  where id = application_uuid
  for update;

  if prior_stage is null then
    raise exception 'Application not found';
  end if;

  select id into sid
  from public.students
  where student_code = trim(payload->>'student_code');

  if sid is null then
    raise exception 'Student code not found';
  end if;

  select id into selected_officer_id
  from public.staff_profiles
  where lower(full_name) = lower(trim(payload->>'officer'))
  limit 1;

  next_stage := coalesce(nullif(payload->>'stage', '')::public.application_stage, prior_stage);

  update public.university_applications
  set student_id = sid,
      university_name = trim(payload->>'university_name'),
      country = payload->>'country',
      course_name = trim(payload->>'course'),
      intake = payload->>'intake',
      stage = next_stage,
      deadline = nullif(payload->>'deadline', '')::date,
      tuition_fee = nullif(trim(payload->>'tuition_fee'), ''),
      scholarship = nullif(trim(payload->>'scholarship'), ''),
      officer_id = coalesce(selected_officer_id, officer_id),
      notes = nullif(trim(payload->>'notes'), '')
  where id = application_uuid;

  insert into public.application_events(application_id,event_type,from_stage,to_stage,notes,created_by)
  values(application_uuid,'APPLICATION_UPDATED',prior_stage,next_stage,'Application details updated',auth.uid());
end;
$$;

revoke all on function public.update_university_application(uuid,jsonb) from public;
grant execute on function public.update_university_application(uuid,jsonb) to authenticated;
