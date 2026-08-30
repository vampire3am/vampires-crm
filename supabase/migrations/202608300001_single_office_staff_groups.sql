begin;

-- AECS currently operates one CRM office. Keep historical branches recoverable,
-- but remove them from active selectors and normalize staff records.
update public.branches set is_active=false where branch_code<>'BRANCH-KTM-01';
insert into public.branches(branch_code,name,address,cost_centre,is_active)
values('BRANCH-KTM-01','AECS Bagbazar Main Office','Purano Buspark, Bagbazar, Kathmandu, Nepal','CC-100-KTM',true)
on conflict(branch_code) do update set name=excluded.name,address=excluded.address,cost_centre=excluded.cost_centre,is_active=true,updated_at=now();
update public.staff_profiles set branch='AECS Bagbazar Main Office' where branch is distinct from 'AECS Bagbazar Main Office';
update public.hr_employees set branch='AECS Bagbazar Main Office',updated_at=now() where branch is distinct from 'AECS Bagbazar Main Office';

create or replace function public.create_staff_group(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  channel_uuid uuid;
  group_name text:=trim(payload->>'name');
  group_description text:=trim(coalesce(payload->>'description',''));
  member_uuid uuid;
begin
  if not public.has_permission('communications.use') then raise exception 'Messaging permission required'; end if;
  if char_length(group_name)<2 or char_length(group_name)>80 then raise exception 'Group name must contain 2 to 80 characters'; end if;
  if char_length(group_description)>300 then raise exception 'Group description is too long'; end if;
  insert into communication_channels(channel_key,name,description,category,is_private,created_by)
  values('staff-group-'||substr(replace(gen_random_uuid()::text,'-',''),1,18),group_name,nullif(group_description,''),'DEPARTMENT',true,auth.uid())
  returning id into channel_uuid;
  insert into communication_channel_members(channel_id,staff_id) values(channel_uuid,auth.uid()) on conflict do nothing;
  for member_uuid in
    select selected.member_id::uuid
    from jsonb_array_elements_text(coalesce(payload->'member_ids','[]'::jsonb)) as selected(member_id)
  loop
    if exists(select 1 from staff_profiles where id=member_uuid and is_active) then
      insert into communication_channel_members(channel_id,staff_id) values(channel_uuid,member_uuid) on conflict do nothing;
      if member_uuid<>auth.uid() then
        insert into staff_notifications(staff_id,type,title,body,action_url,metadata)
        values(member_uuid,'MESSAGE','Added to staff group',group_name,'/messages',jsonb_build_object('channel_id',channel_uuid));
      end if;
    end if;
  end loop;
  insert into audit_logs(user_id,action,module,metadata)
  values(auth.uid(),'STAFF_GROUP_CREATED','communications',jsonb_build_object('channel_id',channel_uuid,'name',group_name));
  return channel_uuid;
end $$;
revoke all on function public.create_staff_group(jsonb) from public;
grant execute on function public.create_staff_group(jsonb) to authenticated;

commit;
