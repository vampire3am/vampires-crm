create table if not exists public.communication_message_reads(
  message_id uuid not null references public.communication_messages(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(message_id,staff_id)
);
alter table public.communication_message_reads enable row level security;
drop policy if exists communication_message_reads_own on public.communication_message_reads;
create policy communication_message_reads_own on public.communication_message_reads for select to authenticated using(staff_id=auth.uid());

create or replace function public.get_unread_message_count() returns bigint language sql stable security definer set search_path=public as $$
 select count(*) from communication_messages m
 where m.deleted_at is null and m.sender_id<>auth.uid()
 and (m.recipient_id=auth.uid() or exists(select 1 from communication_channel_members cm where cm.channel_id=m.channel_id and cm.staff_id=auth.uid()))
 and not exists(select 1 from communication_message_reads r where r.message_id=m.id and r.staff_id=auth.uid())
$$;

create or replace function public.mark_all_messages_read() returns void language sql security definer set search_path=public as $$
 insert into communication_message_reads(message_id,staff_id)
 select m.id,auth.uid() from communication_messages m
 where m.deleted_at is null and m.sender_id<>auth.uid()
 and (m.recipient_id=auth.uid() or exists(select 1 from communication_channel_members cm where cm.channel_id=m.channel_id and cm.staff_id=auth.uid()))
 on conflict(message_id,staff_id) do update set read_at=excluded.read_at
$$;
grant execute on function public.get_unread_message_count() to authenticated;
grant execute on function public.mark_all_messages_read() to authenticated;
