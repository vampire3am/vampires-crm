create or replace function public.review_document(
  document_uuid uuid,
  next_status public.document_status,
  review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_staff() then
    raise exception 'Only active staff can review documents';
  end if;
  if next_status not in ('APPROVED','ACTION_REQUIRED','REJECTED','UNDER_REVIEW','EXPIRED') then
    raise exception 'Invalid review status';
  end if;
  update documents
  set status = next_status,
      notes = coalesce(nullif(trim(review_note), ''), notes),
      verified_by = case when next_status = 'APPROVED' then auth.uid() else null end,
      verified_at = case when next_status = 'APPROVED' then now() else null end
  where id = document_uuid;
  if not found then raise exception 'Document not found'; end if;
  insert into document_activity(document_id, action, performed_by)
  values(document_uuid, 'STATUS_' || next_status, auth.uid());
end
$$;

revoke all on function public.review_document(uuid, public.document_status, text) from public;
grant execute on function public.review_document(uuid, public.document_status, text) to authenticated;
