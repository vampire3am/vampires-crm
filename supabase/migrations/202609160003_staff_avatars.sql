alter table public.staff_profiles add column if not exists avatar_url text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('staff-avatars','staff-avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists staff_avatar_upload on storage.objects;
create policy staff_avatar_upload on storage.objects for insert to authenticated
with check(bucket_id='staff-avatars' and (public.has_permission('rbac.manage') or public.has_permission('hr.manage') or (storage.foldername(name))[1]=auth.uid()::text));
drop policy if exists staff_avatar_update on storage.objects;
create policy staff_avatar_update on storage.objects for update to authenticated
using(bucket_id='staff-avatars' and (public.has_permission('rbac.manage') or public.has_permission('hr.manage') or (storage.foldername(name))[1]=auth.uid()::text))
with check(bucket_id='staff-avatars' and (public.has_permission('rbac.manage') or public.has_permission('hr.manage') or (storage.foldername(name))[1]=auth.uid()::text));

create or replace function public.set_staff_avatar(staff_uuid uuid,avatar_url_value text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid()<>staff_uuid and not public.has_permission('rbac.manage') and not public.has_permission('hr.manage') then raise exception 'Profile photo permission required'; end if;
  update public.staff_profiles set avatar_url=nullif(trim(avatar_url_value),'') where id=staff_uuid and is_active;
  if not found then raise exception 'Active staff profile not found'; end if;
end$$;
revoke all on function public.set_staff_avatar(uuid,text) from public;
grant execute on function public.set_staff_avatar(uuid,text) to authenticated;
