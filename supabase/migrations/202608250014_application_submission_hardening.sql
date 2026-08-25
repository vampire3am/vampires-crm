-- Keep university applications aligned with the live destination catalogue.
alter table public.university_applications
  drop constraint if exists university_applications_country_check;

alter table public.university_applications
  add constraint university_applications_country_check
  check (char_length(trim(country)) between 2 and 100);

create or replace function public.create_university_application(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  aid uuid;
  selected_stage public.application_stage := 'SUBMITTED';
  actor uuid := auth.uid();
begin
  if actor is null or not public.has_permission('applications.edit') then
    raise exception 'You do not have permission to submit university applications';
  end if;

  select id into sid
  from public.students
  where student_code = trim(payload->>'student_code');

  if sid is null then raise exception 'The selected student could not be found'; end if;
  if char_length(trim(coalesce(payload->>'university_name', ''))) < 2 then raise exception 'Select a university'; end if;
  if char_length(trim(coalesce(payload->>'country', ''))) < 2 then raise exception 'Select a destination country'; end if;
  if char_length(trim(coalesce(payload->>'course', ''))) < 2 then raise exception 'Select a degree or course'; end if;
  if char_length(trim(coalesce(payload->>'intake', ''))) < 2 then raise exception 'Select an intake'; end if;

  if nullif(payload->>'stage', '') is not null then
    selected_stage := (payload->>'stage')::public.application_stage;
  end if;

  insert into public.university_applications(
    student_id, university_name, country, course_name, intake, stage,
    tuition_fee, scholarship, deadline, officer_id, notes
  ) values (
    sid,
    trim(payload->>'university_name'),
    trim(payload->>'country'),
    trim(payload->>'course'),
    trim(payload->>'intake'),
    selected_stage,
    nullif(trim(payload->>'tuition_fee'), ''),
    nullif(trim(payload->>'scholarship'), ''),
    nullif(payload->>'deadline', '')::date,
    actor,
    nullif(trim(payload->>'notes'), '')
  ) returning id into aid;

  insert into public.application_events(application_id,event_type,to_stage,notes,created_by)
  values(aid,'APPLICATION_CREATED',selected_stage,'Application created',actor);

  return aid;
end;
$$;

revoke all on function public.create_university_application(jsonb) from public;
grant execute on function public.create_university_application(jsonb) to authenticated;
