-- Conversation-scoped message reads and sender-visible read receipts.
drop policy if exists communication_message_reads_own on public.communication_message_reads;
create policy communication_message_reads_participants on public.communication_message_reads
for select to authenticated using(
  staff_id=auth.uid() or exists(
    select 1 from public.communication_messages m
    where m.id=message_id and m.sender_id=auth.uid()
  )
);

create or replace function public.mark_conversation_messages_read(other_staff_uuid uuid default null,channel_uuid uuid default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if (other_staff_uuid is null) = (channel_uuid is null) then
    raise exception 'Choose exactly one conversation';
  end if;
  insert into communication_message_reads(message_id,staff_id,read_at)
  select m.id,auth.uid(),now() from communication_messages m
  where m.deleted_at is null and m.sender_id<>auth.uid()
    and (
      (other_staff_uuid is not null and m.sender_id=other_staff_uuid and m.recipient_id=auth.uid())
      or
      (channel_uuid is not null and m.channel_id=channel_uuid and exists(
        select 1 from communication_channel_members cm where cm.channel_id=channel_uuid and cm.staff_id=auth.uid()
      ))
    )
  on conflict(message_id,staff_id) do nothing;
end$$;
grant execute on function public.mark_conversation_messages_read(uuid,uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.communication_message_reads;
exception when duplicate_object then null;
end $$;
