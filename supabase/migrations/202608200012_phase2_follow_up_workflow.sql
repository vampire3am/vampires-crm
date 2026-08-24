-- Phase 2 completion: auditable stage changes and operational follow-ups.
create or replace function public.update_lead_stage(lead_uuid uuid, next_stage public.lead_stage)
returns void language plpgsql security definer set search_path=public as $$
declare previous_stage public.lead_stage;
begin
  if not public.has_permission('leads.edit') then raise exception 'Insufficient permission to edit leads'; end if;
  select stage into previous_stage from leads where id=lead_uuid for update;
  if previous_stage is null then raise exception 'Lead not found'; end if;
  update leads set stage=next_stage,last_contact_at=now() where id=lead_uuid;
  insert into lead_activities(lead_id,activity_type,body,metadata,created_by)
  values(lead_uuid,'STAGE_CHANGED','Stage changed from '||previous_stage||' to '||next_stage,
    jsonb_build_object('from',previous_stage,'to',next_stage),auth.uid());
end $$;

create or replace function public.schedule_lead_follow_up(lead_uuid uuid, due_at timestamptz, follow_up_note text)
returns uuid language plpgsql security definer set search_path=public as $$
declare follow_up_id uuid; owner uuid;
begin
  if not public.has_permission('leads.edit') then raise exception 'Insufficient permission to edit leads'; end if;
  if due_at <= now() then raise exception 'Follow-up must be scheduled in the future'; end if;
  if char_length(trim(follow_up_note)) not between 1 and 1000 then raise exception 'Enter a follow-up note'; end if;
  select assigned_counsellor into owner from leads where id=lead_uuid;
  if not found then raise exception 'Lead not found'; end if;
  insert into lead_follow_ups(lead_id,due_at,note,assigned_to,created_by)
  values(lead_uuid,due_at,trim(follow_up_note),coalesce(owner,auth.uid()),auth.uid()) returning id into follow_up_id;
  insert into lead_activities(lead_id,activity_type,body,metadata,created_by)
  values(lead_uuid,'FOLLOW_UP','Follow-up scheduled: '||trim(follow_up_note),jsonb_build_object('follow_up_id',follow_up_id,'due_at',due_at),auth.uid());
  return follow_up_id;
end $$;

create or replace function public.complete_lead_follow_up(follow_up_uuid uuid)
returns void language plpgsql security definer set search_path=public as $$
declare target_lead uuid;
begin
  if not public.has_permission('leads.edit') then raise exception 'Insufficient permission to edit leads'; end if;
  update lead_follow_ups set completed_at=now() where id=follow_up_uuid and completed_at is null returning lead_id into target_lead;
  if target_lead is null then raise exception 'Open follow-up not found'; end if;
  insert into lead_activities(lead_id,activity_type,body,metadata,created_by)
  values(target_lead,'FOLLOW_UP','Follow-up completed',jsonb_build_object('follow_up_id',follow_up_uuid),auth.uid());
end $$;

revoke all on function public.update_lead_stage(uuid,public.lead_stage) from public;
revoke all on function public.schedule_lead_follow_up(uuid,timestamptz,text) from public;
revoke all on function public.complete_lead_follow_up(uuid) from public;
grant execute on function public.update_lead_stage(uuid,public.lead_stage), public.schedule_lead_follow_up(uuid,timestamptz,text), public.complete_lead_follow_up(uuid) to authenticated;
