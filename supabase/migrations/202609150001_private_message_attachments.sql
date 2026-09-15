-- Private message files. Only the uploader or a participant in the message
-- carrying the attachment path can request a signed download URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crm-message-attachments', 'crm-message-attachments', false, 20971520,
  array['application/pdf','image/jpeg','image/png','image/webp','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists crm_message_files_upload on storage.objects;
create policy crm_message_files_upload on storage.objects for insert to authenticated
with check (bucket_id = 'crm-message-attachments'
  and public.has_permission('communications.use')
  and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists crm_message_files_read on storage.objects;
create policy crm_message_files_read on storage.objects for select to authenticated
using (bucket_id = 'crm-message-attachments' and public.has_permission('communications.use')
  and ((storage.foldername(name))[1] = auth.uid()::text or exists (
    select 1 from public.communication_messages message
    where message.deleted_at is null
      and message.attachments @> jsonb_build_array(jsonb_build_object('path', name))
      and (message.recipient_id = auth.uid() or exists (
        select 1 from public.communication_channel_members member
        where member.channel_id = message.channel_id and member.staff_id = auth.uid()
      ))
  )));

drop policy if exists crm_message_files_cleanup on storage.objects;
create policy crm_message_files_cleanup on storage.objects for delete to authenticated
using (bucket_id = 'crm-message-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text);

-- The ADMIN restrictive storage guard must also allow normal staff messaging.
drop policy if exists admin_supervision_no_storage_insert on storage.objects;
create policy admin_supervision_no_storage_insert on storage.objects as restrictive for insert to authenticated
with check (public.current_staff_role() is distinct from 'ADMIN'::public.staff_role
  or (bucket_id = 'hr-staff-documents' and public.has_permission('hr.documents.manage'))
  or (bucket_id = 'crm-message-attachments' and public.has_permission('communications.use')));
