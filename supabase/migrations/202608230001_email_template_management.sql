begin;

drop policy if exists email_admin_templates_insert on public.email_templates;
drop policy if exists email_admin_templates_update on public.email_templates;
drop policy if exists email_admin_templates_delete on public.email_templates;

create policy email_admin_templates_insert
on public.email_templates for insert to authenticated
with check (public.has_permission('email.manage') and updated_by = auth.uid());

create policy email_admin_templates_update
on public.email_templates for update to authenticated
using (public.has_permission('email.manage'))
with check (public.has_permission('email.manage') and updated_by = auth.uid());

create policy email_admin_templates_delete
on public.email_templates for delete to authenticated
using (public.has_permission('email.manage'));

commit;
