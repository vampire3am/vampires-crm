-- Replace prototype organization and branch placeholders with user-supplied official AECS details.
update public.organizations
set legal_name = 'Abroad Education Consultancy Services Pvt. Ltd.',
    tagline = 'Building global futures, one student at a time.',
    address = 'Adwait Marga, Purano Buspark, Bagbazar, Kathmandu, Nepal',
    registration_no = null,
    pan_vat = null,
    phone = null,
    email = null,
    updated_at = now();

update public.branches
set name = 'AECS Bagbazar Main Office',
    address = 'Adwait Marga, Purano Buspark, Bagbazar, Kathmandu, Nepal'
where branch_code = 'BRANCH-KTM-01'
   or name ilike '%Kathmandu%'
   or name ilike '%Main Hub%';

update public.staff_profiles
set branch = 'AECS Bagbazar Main Office'
where branch in ('Kathmandu Central Hub', 'Kathmandu Central', 'Kathmandu Main Hub');

alter table public.staff_profiles
  alter column branch set default 'AECS Bagbazar Main Office';
