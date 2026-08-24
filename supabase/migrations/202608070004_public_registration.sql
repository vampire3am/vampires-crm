alter table public.students alter column created_by drop not null;
alter table public.students add column if not exists registration_source text not null default 'STAFF' check(registration_source in ('STAFF','PUBLIC'));

create table public.public_submission_limits(fingerprint text primary key,last_submitted_at timestamptz not null default now(),attempts integer not null default 1);
alter table public.public_submission_limits enable row level security;

create or replace function public.submit_public_registration(payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare sid uuid; code text; year_text text:=to_char(timezone('Asia/Kathmandu',now()),'YYYY'); fp text:=md5(lower(coalesce(payload->>'email',''))||regexp_replace(coalesce(payload->>'whatsapp',''),'\D','','g')); prior public_submission_limits%rowtype;
begin
 if coalesce(payload->>'website','')<>'' then raise exception 'Submission rejected'; end if;
 if coalesce((payload->>'consent')::boolean,false)=false then raise exception 'Consent is required'; end if;
 if length(trim(coalesce(payload->>'full_name',''))) not between 2 and 150 then raise exception 'Enter a valid full name'; end if;
 if coalesce(payload->>'email','') !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'Enter a valid email'; end if;
 if length(regexp_replace(coalesce(payload->>'whatsapp',''),'\D','','g')) not between 7 and 15 then raise exception 'Enter a valid WhatsApp number'; end if;
 select * into prior from public_submission_limits where fingerprint=fp;
 if prior.last_submitted_at>now()-interval '24 hours' and prior.attempts>=3 then raise exception 'Too many submissions. Please contact AECS.'; end if;
 if exists(select 1 from students where lower(email::text)=lower(payload->>'email') or regexp_replace(whatsapp,'\D','','g')=regexp_replace(payload->>'whatsapp','\D','','g')) then raise exception 'A registration with this email or WhatsApp number already exists'; end if;
 code:='AECS-'||year_text||'-'||lpad(nextval('student_number_seq')::text,5,'0');
 insert into students(student_code,full_name,gender,dob,whatsapp,email,current_address,created_by,registration_source) values(code,trim(payload->>'full_name'),payload->>'gender',(payload->>'dob')::date,payload->>'whatsapp',lower(payload->>'email'),nullif(payload->>'current_address',''),null,'PUBLIC') returning id into sid;
 insert into academic_information(student_id,highest_qualification,current_status,latest_result,study_gap,employment_status) values(sid,payload->>'highest_qualification',payload->>'current_status',payload->>'latest_result',payload->>'study_gap',payload->>'employment_status');
 insert into study_preferences(student_id,preferred_country,second_country,preferred_intake,preferred_course,budget) values(sid,payload->>'preferred_country',nullif(payload->>'second_country',''),payload->>'preferred_intake',payload->>'preferred_course',nullif(payload->>'budget','')::numeric);
 insert into english_tests(student_id,test_taken,test_type,score) values(sid,(payload->>'test_taken')::boolean,case when (payload->>'test_taken')::boolean then payload->>'test_type' else null end,case when (payload->>'test_taken')::boolean then payload->>'score' else null end);
 insert into passport_information(student_id,has_passport) values(sid,(payload->>'has_passport')::boolean);
 insert into additional_information(student_id,lead_source,message) values(sid,'Public Registration',nullif(payload->>'message',''));
 insert into public_submission_limits(fingerprint,last_submitted_at,attempts) values(fp,now(),1) on conflict(fingerprint) do update set last_submitted_at=now(),attempts=case when public_submission_limits.last_submitted_at<now()-interval '24 hours' then 1 else public_submission_limits.attempts+1 end;
 return jsonb_build_object('student_code',code,'status','NEW_LEAD');
end $$;
revoke all on function public.submit_public_registration(jsonb) from public;
grant execute on function public.submit_public_registration(jsonb) to anon,authenticated;
