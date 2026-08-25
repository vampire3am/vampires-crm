create or replace function public.notify_case_task_assignment() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.staff_notifications(staff_id,type,title,body,action_url,metadata) values(new.assigned_to,'TASK_ASSIGNED','New task assigned',new.title||' · Due '||to_char(new.due_at at time zone 'Asia/Kathmandu','DD Mon, HH12:MI AM'),'/applications',jsonb_build_object('task_id',new.id,'priority',new.priority));return new;end$$;
drop trigger if exists case_task_assignment_notification on public.case_tasks;
create trigger case_task_assignment_notification after insert on public.case_tasks for each row execute function public.notify_case_task_assignment();

create or replace function public.notify_lead_follow_up() returns trigger language plpgsql security definer set search_path=public as $$
declare lead_name text; begin select full_name into lead_name from public.leads where id=new.lead_id;insert into public.staff_notifications(staff_id,type,title,body,action_url,metadata) values(new.assigned_to,'REMINDER','Follow-up reminder: '||coalesce(lead_name,'Lead'),new.note||' · Due '||to_char(new.due_at at time zone 'Asia/Kathmandu','DD Mon, HH12:MI AM'),'/leads',jsonb_build_object('follow_up_id',new.id,'lead_id',new.lead_id));return new;end$$;
drop trigger if exists lead_follow_up_notification on public.lead_follow_ups;
create trigger lead_follow_up_notification after insert on public.lead_follow_ups for each row execute function public.notify_lead_follow_up();

create or replace function public.notify_leave_decision() returns trigger language plpgsql security definer set search_path=public as $$
declare sid uuid; begin if old.status is distinct from new.status and new.status in ('APPROVED','REJECTED') then select staff_profile_id into sid from public.hr_employees where id=new.employee_id;if sid is not null then insert into public.staff_notifications(staff_id,type,title,body,action_url,metadata) values(sid,'LEAVE_'||new.status,'Leave request '||lower(new.status),new.leave_type||' from '||to_char(new.from_date,'DD Mon')||' to '||to_char(new.to_date,'DD Mon YYYY'),'/dashboard',jsonb_build_object('leave_id',new.id));end if;end if;return new;end$$;
drop trigger if exists leave_decision_notification on public.hr_leave_requests;
create trigger leave_decision_notification after update on public.hr_leave_requests for each row execute function public.notify_leave_decision();

create or replace function public.notify_document_review() returns trigger language plpgsql security definer set search_path=public as $$
begin if old.status is distinct from new.status and new.status in ('APPROVED','REJECTED','ACTION_REQUIRED','EXPIRED') then insert into public.staff_notifications(staff_id,type,title,body,action_url,metadata) values(new.uploaded_by,'DOCUMENT_'||new.status,'Document status updated',new.document_name||' is now '||replace(initcap(new.status::text),'_',' '),'/documents',jsonb_build_object('document_id',new.id));end if;return new;end$$;
drop trigger if exists document_review_notification on public.documents;
create trigger document_review_notification after update on public.documents for each row execute function public.notify_document_review();
