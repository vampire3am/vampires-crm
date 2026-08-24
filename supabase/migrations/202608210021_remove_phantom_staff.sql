begin;

-- Remove communications involving profiles that have no matching Supabase
-- Authentication account. The authenticated administrator is preserved.
delete from public.communication_reactions r
where not exists (select 1 from auth.users u where u.id = r.staff_id)
   or exists (
     select 1
     from public.communication_messages m
     where m.id = r.message_id
       and (
         not exists (select 1 from auth.users u where u.id = m.sender_id)
         or (
           m.recipient_id is not null
           and not exists (select 1 from auth.users u where u.id = m.recipient_id)
         )
       )
   );

delete from public.staff_notifications n
where not exists (select 1 from auth.users u where u.id = n.staff_id);

delete from public.communication_channel_members cm
where not exists (select 1 from auth.users u where u.id = cm.staff_id);

delete from public.communication_messages m
where not exists (select 1 from auth.users u where u.id = m.sender_id)
   or (
     m.recipient_id is not null
     and not exists (select 1 from auth.users u where u.id = m.recipient_id)
   );

-- Some legacy CRM records may still reference these profiles. Marking them
-- inactive removes them from every staff selector without breaking those
-- historical foreign-key references.
update public.staff_profiles p
set is_active = false,
    updated_at = now()
where not exists (select 1 from auth.users u where u.id = p.id);

commit;
