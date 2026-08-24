alter table public.academic_information alter column current_status drop not null;
alter table public.study_preferences add column if not exists preferred_intake_year smallint check(preferred_intake_year between 2026 and 2035);
alter table public.study_preferences add column if not exists budget_range text check(budget_range in ('Below 10 Lakhs','10-20 Lakhs','20-30 Lakhs','30+ Lakhs'));

create or replace function public.submit_public_registration(payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare sid uuid; code text; year_text text:=to_char(timezone('Asia/Kathmandu',now()),'YYYY'); fp text:=md5(lower(coalesce(payload->>'email',''))||regexp_replace(coalesce(payload->>'whatsapp',''),'\D','','g')); prior public_submission_limits%rowtype;
begin
 if coalesce(payload->>'website','')<>'' then raise exception 'Submission rejected'; end if;
 if coalesce((payload->>'consent')::boolean,false)=false then raise exception 'Consent is required'; end if;
 if length(trim(coalesce(payload->>'full_name',''))) not between 2 and 150 then raise exception 'Enter a valid full name'; end if;
 if coalesce(payload->>'gender','') not in ('Male','Female','Other','Prefer not to say') then raise exception 'Select a gender'; end if;
 if coalesce(payload->>'dob','')='' or (payload->>'dob')::date>current_date then raise exception 'Enter a valid date of birth'; end if;
 if coalesce(payload->>'email','') !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'Enter a valid email'; end if;
 if length(regexp_replace(coalesce(payload->>'whatsapp',''),'\D','','g')) not between 7 and 15 then raise exception 'Enter a valid WhatsApp number'; end if;
 if coalesce(payload->>'highest_qualification','') not in ('+2/Diploma','Bachelors','Masters') then raise exception 'Select the highest qualification'; end if;
 if length(trim(coalesce(payload->>'latest_result',''))) < 1 then raise exception 'Enter the latest GPA or percentage'; end if;
 if coalesce(payload->>'preferred_country','') not in ('Australia','UK','USA','New Zealand','Canada','Germany','Finland','Malta','Cyprus','Sweden','Belgium','Hungary','Netherlands','Ireland','Japan','South Korea') then raise exception 'Select a preferred country'; end if;
 if length(trim(coalesce(payload->>'preferred_course',''))) < 2 then raise exception 'Enter the preferred course'; end if;
 if coalesce(payload->>'preferred_intake','') not in ('Jan/Feb/Mar','Apr/May','June/July/August','Sep/Oct','Nov/Dec') then raise exception 'Select a preferred intake'; end if;
 if coalesce(payload->>'preferred_intake_year','') not in ('2026','2027','2028') then raise exception 'Select an intake year'; end if;
 if coalesce(payload->>'budget_range','') not in ('Below 10 Lakhs','10-20 Lakhs','20-30 Lakhs','30+ Lakhs') then raise exception 'Select an estimated budget'; end if;
 if coalesce(payload->>'test_taken','') not in ('true','false') then raise exception 'Answer the English test question'; end if;
 if (payload->>'test_taken')::boolean and (coalesce(payload->>'test_type','') not in ('IELTS','PTE','Duolingo','TOEFL','GRE','SAT') or length(trim(coalesce(payload->>'score','')))<1) then raise exception 'Enter the English test type and score'; end if;
 if coalesce(payload->>'has_passport','') not in ('true','false') then raise exception 'Answer the passport question'; end if;
 select * into prior from public_submission_limits where fingerprint=fp;
 if prior.last_submitted_at>now()-interval '24 hours' and prior.attempts>=3 then raise exception 'Too many submissions. Please contact AECS.'; end if;
 if exists(select 1 from students where lower(email::text)=lower(payload->>'email') or regexp_replace(whatsapp,'\D','','g')=regexp_replace(payload->>'whatsapp','\D','','g')) then raise exception 'A registration with this email or WhatsApp number already exists'; end if;
 code:='AECS-'||year_text||'-'||lpad(nextval('student_number_seq')::text,5,'0');
 insert into students(student_code,full_name,gender,dob,whatsapp,email,current_address,created_by,registration_source) values(code,trim(payload->>'full_name'),payload->>'gender',(payload->>'dob')::date,payload->>'whatsapp',lower(payload->>'email'),nullif(trim(payload->>'current_address'),''),null,'PUBLIC') returning id into sid;
 insert into academic_information(student_id,highest_qualification,current_status,latest_result,study_gap,employment_status) values(sid,payload->>'highest_qualification',null,payload->>'latest_result',nullif(trim(payload->>'study_gap'),''),nullif(trim(payload->>'employment_status'),''));
 insert into study_preferences(student_id,preferred_country,second_country,preferred_intake,preferred_intake_year,preferred_course,budget,budget_range) values(sid,payload->>'preferred_country',nullif(trim(payload->>'second_country'),''),payload->>'preferred_intake',(payload->>'preferred_intake_year')::smallint,payload->>'preferred_course',null,payload->>'budget_range');
 insert into english_tests(student_id,test_taken,test_type,score) values(sid,(payload->>'test_taken')::boolean,case when (payload->>'test_taken')::boolean then payload->>'test_type' else null end,case when (payload->>'test_taken')::boolean then payload->>'score' else null end);
 insert into passport_information(student_id,has_passport) values(sid,(payload->>'has_passport')::boolean);
 insert into additional_information(student_id,lead_source,message) values(sid,'Public Registration',nullif(trim(payload->>'message'),''));
 insert into public_submission_limits(fingerprint,last_submitted_at,attempts) values(fp,now(),1) on conflict(fingerprint) do update set last_submitted_at=now(),attempts=case when public_submission_limits.last_submitted_at<now()-interval '24 hours' then 1 else public_submission_limits.attempts+1 end;
 return jsonb_build_object('student_code',code,'status','NEW_LEAD');
end $$;
revoke all on function public.submit_public_registration(jsonb) from public;
grant execute on function public.submit_public_registration(jsonb) to anon,authenticated;
