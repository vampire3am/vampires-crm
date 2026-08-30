begin;

-- ADMIN remains an oversight role across the operational CRM, but the owner
-- explicitly authorizes staff access administration, internal communications,
-- HRMS, assignments and finance/accounting entry.
insert into public.permissions(role,permission_name,enabled)
select 'ADMIN'::public.staff_role,permission_name,true
from unnest(array[
  'rbac.manage','communications.use','communications.manage',
  'finance.view','finance.create','finance.approve'
]::text[]) permission_name
on conflict(role,permission_name) do update set enabled=true;

update public.staff_profiles
set desktop_modules=(
  select array_agg(distinct module_name order by module_name)
  from unnest(coalesce(desktop_modules,'{}'::text[])||array['messages','finance','settings']) module_name
)
where role='ADMIN';

create or replace function public.prevent_admin_operational_mutation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if public.current_staff_role()='ADMIN' then
    if tg_table_name like 'hr\_%' escape '\' and public.has_permission('hr.manage')
      or tg_table_name like 'communication\_%' escape '\' and public.has_permission('communications.use')
      or tg_table_name like 'finance\_%' escape '\' and public.has_permission('finance.create') then
      if tg_op='DELETE' then return old; end if;
      return new;
    end if;
    raise exception 'ADMIN can modify authorized HRMS, messaging, finance and staff-access records only';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

alter table public.finance_journals
  add column if not exists journal_date date not null default current_date,
  add column if not exists voucher_type text not null default 'GENERAL',
  add column if not exists currency text not null default 'NPR',
  add column if not exists department text;

alter table public.finance_journal_lines
  add column if not exists line_no smallint,
  add column if not exists particulars text;

create or replace function public.post_manual_journal(payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  journal_id uuid;
  voucher_no_value text;
  line jsonb;
  line_index integer:=0;
  debit_total numeric:=0;
  credit_total numeric:=0;
  debit_value numeric;
  credit_value numeric;
  account_value text;
  voucher_type_value text:=upper(coalesce(nullif(payload->>'voucher_type',''),'GENERAL'));
  narration_value text:=trim(coalesce(payload->>'narration',''));
begin
  if not public.has_permission('finance.create') then raise exception 'Insufficient finance permission'; end if;
  if voucher_type_value not in ('GENERAL','PAYMENT','RECEIPT','CONTRA','ADJUSTMENT') then raise exception 'Invalid voucher type'; end if;
  if narration_value='' then raise exception 'Journal narration is required'; end if;
  if jsonb_typeof(payload->'lines')<>'array' or jsonb_array_length(payload->'lines')<2 then raise exception 'At least two journal lines are required'; end if;

  for line in select value from jsonb_array_elements(payload->'lines')
  loop
    account_value:=trim(coalesce(line->>'account_code',''));
    debit_value:=coalesce(nullif(line->>'debit','')::numeric,0);
    credit_value:=coalesce(nullif(line->>'credit','')::numeric,0);
    if account_value !~ '^[1-8][0-9]{3}$' then raise exception 'Select a valid posting account from the COA'; end if;
    if debit_value<0 or credit_value<0 or (debit_value>0 and credit_value>0) or (debit_value=0 and credit_value=0) then
      raise exception 'Each journal line must contain either a debit or a credit';
    end if;
    debit_total:=debit_total+debit_value;
    credit_total:=credit_total+credit_value;
  end loop;
  if debit_total<=0 or round(debit_total,2)<>round(credit_total,2) then raise exception 'Journal is not balanced'; end if;

  voucher_no_value:='JV-'||to_char(now(),'YYYY')||'-'||lpad(nextval('finance_voucher_seq')::text,6,'0');
  insert into public.finance_journals(voucher_no,journal_date,voucher_type,currency,department,reference_no,description,status,prepared_by,posted_at)
  values(voucher_no_value,coalesce(nullif(payload->>'journal_date','')::date,current_date),voucher_type_value,
    coalesce(nullif(payload->>'currency',''),'NPR'),nullif(trim(payload->>'department'),''),
    nullif(trim(payload->>'reference_no'),''),narration_value,'DRAFT',auth.uid(),now())
  returning id into journal_id;

  for line in select value from jsonb_array_elements(payload->'lines')
  loop
    line_index:=line_index+1;
    insert into public.finance_journal_lines(journal_id,line_no,account_code,particulars,debit,credit)
    values(journal_id,line_index,line->>'account_code',coalesce(nullif(trim(line->>'particulars'),''),narration_value),
      coalesce(nullif(line->>'debit','')::numeric,0),coalesce(nullif(line->>'credit','')::numeric,0));
  end loop;
  update public.finance_journals set status='POSTED' where id=journal_id;
  insert into public.audit_logs(user_id,action,module,record_id,metadata)
  values(auth.uid(),'MANUAL_JOURNAL_POSTED','finance',journal_id,jsonb_build_object('voucher_no',voucher_no_value,'debit',debit_total,'credit',credit_total));
  return jsonb_build_object('id',journal_id,'voucher_no',voucher_no_value);
end
$$;

grant execute on function public.post_manual_journal(jsonb) to authenticated;

-- Invoice creation now records the receivable and revenue in full, followed by
-- a separate receipt entry when money is collected. This keeps unpaid balances,
-- the general ledger and every financial statement in agreement.
create or replace function public.issue_student_invoice(payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare sid uuid;iid uuid;rid uuid;jid uuid;ino text;rno text;vno text;asset text;total numeric;received numeric;
begin
  if not public.has_permission('finance.create')then raise exception'Insufficient permission';end if;
  select id into sid from students where student_code=payload->>'student_code';
  if sid is null then raise exception'Select a registered CRM student';end if;
  total:=(payload->>'subtotal')::numeric-(payload->>'discount')::numeric;
  received:=(payload->>'amount_received')::numeric;
  if total<=0 then raise exception'Invoice total must be greater than zero';end if;
  if received<0 or received>total then raise exception'Receipt cannot exceed invoice total';end if;
  ino:='INV-'||to_char(now(),'YYYY')||'-'||lpad(nextval('finance_invoice_seq')::text,6,'0');
  insert into finance_invoices(invoice_no,student_id,course,service_category,income_account_code,subtotal,discount,status,created_by)
  values(ino,sid,payload->>'course',payload->>'service_category',payload->>'income_account_code',(payload->>'subtotal')::numeric,(payload->>'discount')::numeric,
    case when received=total then'PAID'when received>0 then'PARTIAL'else'PENDING'end,auth.uid()) returning id into iid;

  vno:='JV-'||to_char(now(),'YYYY')||'-'||lpad(nextval('finance_voucher_seq')::text,6,'0');
  insert into finance_journals(voucher_no,journal_date,voucher_type,currency,department,reference_no,description,status,prepared_by,approved_by,posted_at)
  values(vno,current_date,'GENERAL','NPR','Student Services',ino,'Student service invoice accrued','DRAFT',auth.uid(),auth.uid(),now()) returning id into jid;
  insert into finance_journal_lines(journal_id,line_no,account_code,particulars,debit) values(jid,1,'1131','Student fee receivable',total);
  insert into finance_journal_lines(journal_id,line_no,account_code,particulars,credit) values(jid,2,payload->>'income_account_code','Student service income',total);
  update finance_journals set status='POSTED' where id=jid;

  if received>0 then
    asset:=case when payload->>'payment_method'ilike'%eSewa%'then'1125' when payload->>'payment_method'ilike'%Khalti%'then'1126'
      when payload->>'payment_method'ilike any(array['%Bank%','%ConnectIPS%'])then'1121' else'1111'end;
    rno:='REC-'||to_char(now(),'YYYY')||'-'||lpad(nextval('finance_receipt_seq')::text,6,'0');
    insert into finance_receipts(receipt_no,invoice_id,amount,payment_method,asset_account_code,received_by)
    values(rno,iid,received,payload->>'payment_method',asset,auth.uid())returning id into rid;
    vno:='JV-'||to_char(now(),'YYYY')||'-'||lpad(nextval('finance_voucher_seq')::text,6,'0');
    insert into finance_journals(voucher_no,journal_date,voucher_type,currency,department,reference_no,description,status,prepared_by,approved_by,posted_at)
    values(vno,current_date,'RECEIPT','NPR','Student Services',rno,'Student fee receipt','DRAFT',auth.uid(),auth.uid(),now())returning id into jid;
    insert into finance_journal_lines(journal_id,line_no,account_code,particulars,debit)values(jid,1,asset,'Payment received',received);
    insert into finance_journal_lines(journal_id,line_no,account_code,particulars,credit)values(jid,2,'1131','Student receivable settled',received);
    update finance_journals set status='POSTED'where id=jid;
  end if;
  return jsonb_build_object('id',iid,'invoice_no',ino,'receipt_no',rno);
end
$$;

insert into public.audit_logs(user_id,action,module,metadata)
values(null,'ADMIN_FINANCE_MESSAGES_ENABLED','security',jsonb_build_object('role','ADMIN','journal_entry','COA_DRIVEN'));

commit;
