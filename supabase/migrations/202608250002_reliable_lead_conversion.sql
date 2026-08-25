-- Make lead conversion available to every active staff role and accept an email
-- completed in the conversion dialog when the original lead has no email.
insert into public.permissions (role, permission_name, enabled)
select role, permission_name, true
from unnest(enum_range(null::public.staff_role)) role
cross join (values ('leads.edit'), ('students.create')) permission(permission_name)
on conflict (role, permission_name) do update set enabled = excluded.enabled;

create or replace function public.convert_lead(lead_uuid uuid, student_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  actor uuid := auth.uid();
  target public.leads;
  student_email text;
begin
  if not public.has_permission('leads.edit') or not public.has_permission('students.create') then
    raise exception 'Your staff account does not have lead-conversion permission';
  end if;
  select * into target from public.leads where id = lead_uuid for update;
  if target.id is null then raise exception 'Lead not found'; end if;
  if target.stage = 'CONVERTED' then raise exception 'This lead has already been converted'; end if;

  student_email := lower(trim(coalesce(nullif(student_payload->>'email', ''), target.email::text, '')));
  if student_email = '' then raise exception 'Enter the student email address before converting this lead'; end if;

  result := public.register_student(student_payload || jsonb_build_object(
    'full_name', target.full_name,
    'email', student_email,
    'whatsapp', target.phone,
    'preferred_country', target.target_country,
    'preferred_course', coalesce(target.target_course, 'Undecided'),
    'preferred_intake', coalesce(target.target_intake, 'Undecided'),
    'lead_source', target.source
  ));
  update public.leads set stage='CONVERTED', converted_student_id=(result->>'id')::uuid, last_contact_at=now() where id=lead_uuid;
  insert into public.lead_activities(lead_id,activity_type,body,metadata,created_by)
  values(lead_uuid,'CONVERTED','Converted to student',jsonb_build_object('student_id',result->>'id','student_code',result->>'student_code'),actor);
  return result;
end
$$;

revoke all on function public.convert_lead(uuid,jsonb) from public;
grant execute on function public.convert_lead(uuid,jsonb) to authenticated;
