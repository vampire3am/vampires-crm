-- Professional payroll workspace: auditable reminders tied to a BS payroll
-- month. Payroll runs themselves remain controlled by the existing maker,
-- checker and payment transition functions.

create table if not exists public.hr_payroll_reminders (
  id uuid primary key default gen_random_uuid(),
  payroll_month text not null check (payroll_month ~ '^[0-9]{4}-[0-9]{2}$'),
  title text not null check (length(trim(title)) between 3 and 160),
  due_date date not null,
  status text not null default 'PENDING' check (status in ('PENDING','COMPLETED','CANCELLED')),
  created_by uuid not null references public.staff_profiles(id),
  completed_by uuid references public.staff_profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_payroll_reminders_month_idx
  on public.hr_payroll_reminders(payroll_month,due_date);

alter table public.hr_payroll_reminders enable row level security;

drop policy if exists hr_payroll_reminders_read on public.hr_payroll_reminders;
create policy hr_payroll_reminders_read on public.hr_payroll_reminders
for select to authenticated using(
  public.has_permission('payroll.view') or
  public.has_permission('payroll.prepare') or
  public.has_permission('payroll.manage')
);

create or replace function public.hr_save_payroll_reminder(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare reminder_uuid uuid;
begin
  if not(public.has_permission('payroll.prepare') or public.has_permission('payroll.manage')) then
    raise exception 'Payroll preparation permission required';
  end if;
  insert into hr_payroll_reminders(payroll_month,title,due_date,created_by)
  values(payload->>'payroll_month',trim(payload->>'title'),(payload->>'due_date')::date,auth.uid())
  returning id into reminder_uuid;
  insert into audit_logs(user_id,action,module,metadata)
  values(auth.uid(),'PAYROLL_REMINDER_CREATED','hrms',jsonb_build_object('reminder_id',reminder_uuid,'payroll_month',payload->>'payroll_month'));
  return reminder_uuid;
end $$;

create or replace function public.hr_update_payroll_reminder(reminder_uuid uuid,next_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not(public.has_permission('payroll.prepare') or public.has_permission('payroll.manage')) then
    raise exception 'Payroll preparation permission required';
  end if;
  if next_status not in('COMPLETED','CANCELLED') then raise exception 'Invalid reminder status'; end if;
  update hr_payroll_reminders set status=next_status,
    completed_by=case when next_status='COMPLETED' then auth.uid() else null end,
    completed_at=case when next_status='COMPLETED' then now() else null end,
    updated_at=now()
  where id=reminder_uuid and status='PENDING';
  if not found then raise exception 'Pending payroll reminder not found'; end if;
  insert into audit_logs(user_id,action,module,metadata)
  values(auth.uid(),'PAYROLL_REMINDER_'||next_status,'hrms',jsonb_build_object('reminder_id',reminder_uuid));
end $$;

revoke all on function public.hr_save_payroll_reminder(jsonb) from public;
revoke all on function public.hr_update_payroll_reminder(uuid,text) from public;
grant execute on function public.hr_save_payroll_reminder(jsonb) to authenticated;
grant execute on function public.hr_update_payroll_reminder(uuid,text) to authenticated;

