begin;

-- An assignee must always be able to deliver the work assigned to them. Module
-- access controls whether the workspace is visible; ownership controls whether
-- this particular report may be submitted.
create or replace function public.submit_staff_assignment(assignment_uuid uuid,report_text text,evidence jsonb default'[]'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare assignment_record record;
begin
  if public.current_staff_role()='ADMIN' then raise exception 'Administrators supervise assignments and cannot submit staff work'; end if;
  if char_length(trim(coalesce(report_text,'')))<20 then raise exception 'Completion report must contain at least 20 characters'; end if;
  if jsonb_typeof(coalesce(evidence,'[]'::jsonb))<>'array' then raise exception 'Evidence must be a list'; end if;
  update staff_assignments
     set completion_report=trim(report_text), evidence_links=coalesce(evidence,'[]'::jsonb),
         progress=100, status='SUBMITTED', submitted_at=now(), reviewer_notes=null
   where id=assignment_uuid and assigned_to=auth.uid()
     and status in('ASSIGNED','IN_PROGRESS','REVISION_REQUIRED')
  returning * into assignment_record;
  if assignment_record.id is null then raise exception 'Only the assigned staff member can submit this active assignment'; end if;
  insert into staff_notifications(staff_id,type,title,body,action_url,metadata)
  values(assignment_record.assigned_by,'TASK_SUBMITTED','Assignment submitted: '||assignment_record.title,
    'Completion report is ready for review.','/assignments',jsonb_build_object('assignment_id',assignment_record.id));
  insert into audit_logs(user_id,action,module,metadata)
  values(auth.uid(),'STAFF_ASSIGNMENT_SUBMITTED','assignments',jsonb_build_object('assignment_id',assignment_record.id));
end $$;

create table if not exists public.staff_voice_calls(
  id text primary key,
  caller_id uuid not null references public.staff_profiles(id) on delete cascade,
  recipient_id uuid not null references public.staff_profiles(id) on delete cascade,
  caller_snapshot jsonb not null default '{}'::jsonb,
  recipient_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'RINGING' check(status in('RINGING','CONNECTED','ENDED','DECLINED','BUSY')),
  offer jsonb not null,
  answer jsonb,
  candidates jsonb not null default '[]'::jsonb check(jsonb_typeof(candidates)='array'),
  started_at bigint not null,
  answered_at bigint,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint staff_voice_calls_distinct_people check(caller_id<>recipient_id)
);
create index if not exists staff_voice_calls_participants_idx on public.staff_voice_calls(status,created_at desc);
alter table public.staff_voice_calls enable row level security;
drop policy if exists staff_voice_calls_read_participant on public.staff_voice_calls;
create policy staff_voice_calls_read_participant on public.staff_voice_calls for select to authenticated
using(auth.uid() in(caller_id,recipient_id));
drop policy if exists staff_voice_calls_start on public.staff_voice_calls;
create policy staff_voice_calls_start on public.staff_voice_calls for insert to authenticated
with check(auth.uid()=caller_id and public.is_active_staff());
drop policy if exists staff_voice_calls_update_participant on public.staff_voice_calls;
create policy staff_voice_calls_update_participant on public.staff_voice_calls for update to authenticated
using(auth.uid() in(caller_id,recipient_id)) with check(auth.uid() in(caller_id,recipient_id));

create or replace function public.add_staff_voice_call_candidate(call_id text,target_staff_id uuid,candidate_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  update staff_voice_calls
     set candidates=candidates||jsonb_build_array(jsonb_build_object('candidate',candidate_payload,'senderId',auth.uid(),'targetId',target_staff_id))
   where id=call_id and auth.uid() in(caller_id,recipient_id) and target_staff_id in(caller_id,recipient_id)
     and target_staff_id<>auth.uid() and status in('RINGING','CONNECTED');
  if not found then raise exception 'Voice call is no longer active'; end if;
end $$;
revoke all on function public.add_staff_voice_call_candidate(text,uuid,jsonb) from public;
grant execute on function public.add_staff_voice_call_candidate(text,uuid,jsonb) to authenticated;

-- Old call rows are operational signals, not permanent employee records.
delete from public.staff_voice_calls where created_at<now()-interval '1 day';

commit;
