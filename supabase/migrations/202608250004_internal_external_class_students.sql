-- Link an internal CRM student to one reusable class profile while keeping
-- external class learners independent.
create unique index if not exists class_students_linked_student_unique
on public.class_students(linked_student_id)
where linked_student_id is not null;

create or replace function public.create_class_student(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  sid uuid;
  bid uuid;
  eid uuid;
  linked_id uuid := nullif(payload->>'linked_student_id','')::uuid;
  code text;
  crm_student public.students;
begin
  if not public.has_permission('classes.manage') then raise exception 'Insufficient permission'; end if;
  select id into bid from public.test_prep_batches where batch_code=payload->>'batch_code';
  if bid is null then raise exception 'Batch not found'; end if;

  if linked_id is not null then
    select * into crm_student from public.students where id=linked_id;
    if crm_student.id is null then raise exception 'The selected internal student no longer exists'; end if;
    select id,student_code into sid,code from public.class_students where linked_student_id=linked_id;
    if sid is null then
      code := crm_student.student_code;
      insert into public.class_students(student_code,linked_student_id,full_name,phone,alt_phone,email,gender,education_level,guardian_name,guardian_phone,address,record_status,notes,created_by)
      values(code,linked_id,crm_student.full_name,crm_student.whatsapp,nullif(payload->>'alt_phone',''),crm_student.email,crm_student.gender,payload->>'education_level',nullif(payload->>'guardian_name',''),nullif(payload->>'guardian_phone',''),crm_student.current_address,payload->>'record_status',payload->>'notes',auth.uid())
      returning id into sid;
    end if;
  else
    code := 'CLS-'||to_char(timezone('Asia/Kathmandu',now()),'YYYY')||'-'||lpad(nextval('class_student_number_seq')::text,4,'0');
    insert into public.class_students(student_code,full_name,phone,alt_phone,email,gender,education_level,guardian_name,guardian_phone,address,record_status,notes,created_by)
    values(code,trim(payload->>'full_name'),trim(payload->>'phone'),nullif(payload->>'alt_phone',''),nullif(payload->>'email',''),payload->>'gender',payload->>'education_level',nullif(payload->>'guardian_name',''),nullif(payload->>'guardian_phone',''),payload->>'address',payload->>'record_status',payload->>'notes',auth.uid())
    returning id into sid;
  end if;

  if exists(select 1 from public.batch_enrollments where batch_id=bid and class_student_id=sid) then
    raise exception 'This student is already enrolled in the selected batch';
  end if;
  insert into public.batch_enrollments(batch_id,class_student_id,mode,expected_completion,status,notes)
  values(bid,sid,payload->>'mode',nullif(payload->>'expected_completion','')::date,payload->>'class_status',payload->>'enrolment_notes')
  returning id into eid;
  return jsonb_build_object('id',sid,'student_code',code,'enrolment_id',eid,'linked_student_id',linked_id);
end
$$;

revoke all on function public.create_class_student(jsonb) from public;
grant execute on function public.create_class_student(jsonb) to authenticated;
