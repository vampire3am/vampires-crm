-- Make lead creation consistent for every active staff profile with leads.create.
-- The RPC remains the only supported insert path and never bypasses RBAC.
create or replace function public.create_lead(payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  actor uuid := auth.uid();
  lead_id uuid;
  code text;
  duplicate_code text;
  counsellor_id uuid := nullif(trim(coalesce(payload->>'assigned_counsellor','')),'')::uuid;
begin
  if actor is null then raise exception 'Authentication is required to create a lead'; end if;
  if not exists(select 1 from public.staff_profiles where id=actor and is_active) then
    raise exception 'Active staff profile required';
  end if;
  if not public.has_permission('leads.create') then
    raise exception 'Create leads permission required';
  end if;
  if char_length(trim(coalesce(payload->>'full_name',''))) not between 2 and 150 then
    raise exception 'Enter a valid full name';
  end if;
  if char_length(regexp_replace(coalesce(payload->>'phone',''),'\D','','g')) not between 7 and 15 then
    raise exception 'Enter a valid mobile or WhatsApp number';
  end if;
  if counsellor_id is not null and not exists(select 1 from public.staff_profiles where id=counsellor_id and is_active) then
    raise exception 'The selected counsellor is not an active staff member';
  end if;

  select lead_code into duplicate_code from public.leads
  where stage not in ('CONVERTED','LOST') and (
    (nullif(trim(payload->>'email'),'') is not null and lower(email::text)=lower(trim(payload->>'email')))
    or normalized_phone=regexp_replace(coalesce(payload->>'phone',''),'\D','','g')
  ) limit 1;
  if duplicate_code is not null then
    raise exception 'Duplicate active lead: %',duplicate_code using errcode='23505';
  end if;

  code := 'LEAD-'||to_char(timezone('Asia/Kathmandu',now()),'YYYY')||'-'||lpad(nextval('public.lead_number_seq')::text,5,'0');
  insert into public.leads(lead_code,full_name,email,phone,source,target_country,target_course,target_intake,budget_estimate,assigned_counsellor,stage,priority,created_by)
  values(code,trim(payload->>'full_name'),nullif(lower(trim(payload->>'email')),''),trim(payload->>'phone'),trim(payload->>'source'),trim(payload->>'target_country'),nullif(trim(payload->>'target_course'),''),nullif(trim(payload->>'target_intake'),''),nullif(trim(payload->>'budget_estimate'),''),counsellor_id,coalesce((payload->>'stage')::public.lead_stage,'NEW_INQUIRY'),coalesce((payload->>'priority')::public.lead_priority,'MEDIUM'),actor)
  returning id into lead_id;
  insert into public.lead_activities(lead_id,activity_type,body,created_by)
  values(lead_id,'CREATED','Lead captured',actor);
  return jsonb_build_object('id',lead_id,'lead_code',code);
end $$;

revoke all on function public.create_lead(jsonb) from public;
grant execute on function public.create_lead(jsonb) to authenticated;
