-- Audit every generated/exported report without exposing audit_logs to direct writes.
create or replace function public.log_report_activity(
  report_key text,
  activity text,
  activity_filters jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('reports.view') then
    raise exception 'Report permission required';
  end if;
  if activity not in ('VIEW','EXPORT_CSV','EXPORT_XLSX','EXPORT_PDF','SAVE','FAVOURITE','SCHEDULE','SHARE') then
    raise exception 'Unsupported report activity';
  end if;
  insert into public.audit_logs(user_id,action,module,metadata)
  values(auth.uid(),'REPORT_' || activity,'reports',jsonb_build_object(
    'report_key', report_key,
    'filters', coalesce(activity_filters,'{}'::jsonb)
  ));
end
$$;

revoke all on function public.log_report_activity(text,text,jsonb) from public;
grant execute on function public.log_report_activity(text,text,jsonb) to authenticated;
