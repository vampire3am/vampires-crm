-- Phase 1: least-privilege permissions for core identity and student records.
insert into public.permissions (role, permission_name, enabled)
values
  ('ADMIN', 'students.view', true),
  ('ADMIN', 'students.create', true),
  ('ADMIN', 'students.edit', true),
  ('ADMIN', 'students.delete', true),
  ('DIRECTOR', 'students.view', true),
  ('DIRECTOR', 'students.create', true),
  ('DIRECTOR', 'students.edit', true),
  ('DIRECTOR', 'students.delete', true),
  ('SENIOR_COUNSELLOR', 'students.view', true),
  ('SENIOR_COUNSELLOR', 'students.create', true),
  ('SENIOR_COUNSELLOR', 'students.edit', true),
  ('COUNSELLOR', 'students.view', true),
  ('COUNSELLOR', 'students.create', true),
  ('COUNSELLOR', 'students.edit', true),
  ('VISA_OFFICER', 'students.view', true),
  ('VISA_OFFICER', 'students.edit', true),
  ('FRONT_DESK', 'students.view', true),
  ('FRONT_DESK', 'students.create', true),
  ('FRONT_DESK', 'students.edit', true),
  ('FACULTY', 'students.view', true),
  ('ACCOUNTANT', 'students.view', true),
  ('MARKETING', 'students.view', true)
on conflict (role, permission_name)
do update set enabled = excluded.enabled;

drop policy if exists active_staff_read_students on public.students;
drop policy if exists students_staff_update on public.students;
drop policy if exists students_manager_delete on public.students;

create policy permitted_staff_read_students
on public.students for select to authenticated
using (public.has_permission('students.view'));

create policy permitted_staff_update_students
on public.students for update to authenticated
using (public.has_permission('students.edit'))
with check (public.has_permission('students.edit'));

create policy permitted_staff_delete_students
on public.students for delete to authenticated
using (public.has_permission('students.delete'));

-- Student creation remains exclusively inside register_student(), which validates
-- duplicates and stamps the authenticated actor. Direct table inserts stay denied.
create or replace function public.register_student(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  code text;
  actor uuid := auth.uid();
  year_text text := to_char(timezone('Asia/Kathmandu', now()), 'YYYY');
begin
  if not public.has_permission('students.create') then
    raise exception 'Insufficient permission to register students';
  end if;
  if exists (
    select 1 from students
    where lower(email::text) = lower(payload->>'email')
       or regexp_replace(whatsapp, '\D', '', 'g') = regexp_replace(payload->>'whatsapp', '\D', '', 'g')
  ) then
    raise exception 'A student with this email or WhatsApp number already exists';
  end if;

  code := 'AECS-' || year_text || '-' || lpad(nextval('student_number_seq')::text, 5, '0');
  insert into students(student_code, full_name, gender, dob, whatsapp, email, current_address, created_by)
  values(code, payload->>'full_name', payload->>'gender', (payload->>'dob')::date, payload->>'whatsapp', payload->>'email', nullif(payload->>'current_address', ''), actor)
  returning id into sid;

  insert into academic_information(student_id, highest_qualification, current_status, latest_result, study_gap, employment_status)
  values(sid, payload->>'highest_qualification', payload->>'current_status', payload->>'latest_result', payload->>'study_gap', payload->>'employment_status');
  insert into study_preferences(student_id, preferred_country, second_country, preferred_intake, preferred_course, budget)
  values(sid, payload->>'preferred_country', nullif(payload->>'second_country', ''), payload->>'preferred_intake', payload->>'preferred_course', nullif(payload->>'budget', '')::numeric);
  insert into english_tests(student_id, test_taken, test_type, score)
  values(sid, (payload->>'test_taken')::boolean, case when (payload->>'test_taken')::boolean then payload->>'test_type' end, case when (payload->>'test_taken')::boolean then payload->>'score' end);
  insert into passport_information(student_id, has_passport)
  values(sid, (payload->>'has_passport')::boolean);
  insert into additional_information(student_id, lead_source, message)
  values(sid, payload->>'lead_source', nullif(payload->>'message', ''));
  insert into activity_logs(student_id, action, created_by)
  values(sid, 'STUDENT_CREATED', actor);

  return jsonb_build_object('id', sid, 'student_code', code, 'status', 'NEW_LEAD');
end;
$$;

revoke all on function public.register_student(jsonb) from public;
grant execute on function public.register_student(jsonb) to authenticated;
