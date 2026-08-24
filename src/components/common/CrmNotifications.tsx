import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type CrmNoticeTone = "success" | "error" | "info";
type CrmNotice = { id: string; tone: CrmNoticeTone; title: string; message?: string };
const EVENT = "aecs:notice";

export const notify = (tone: CrmNoticeTone, title: string, message?: string) =>
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id: crypto.randomUUID(), tone, title, message } }));
export const notifySuccess = (title: string, message?: string) => notify("success", title, message);
export const notifyError = (title: string, message?: string) => notify("error", title, message);
export const notifyInfo = (title: string, message?: string) => notify("info", title, message);

export function CrmNotificationCenter() {
  const [notices, setNotices] = useState<CrmNotice[]>([]);
  useEffect(() => {
    const receive = (event: Event) => {
      const notice = (event as CustomEvent<CrmNotice>).detail;
      setNotices(current => [...current.slice(-3), notice]);
      window.setTimeout(() => setNotices(current => current.filter(item => item.id !== notice.id)), notice.tone === "error" ? 6500 : 4200);
    };
    window.addEventListener(EVENT, receive);
    return () => window.removeEventListener(EVENT, receive);
  }, []);
  return <aside className="crm-notification-center" aria-live="polite" aria-label="CRM notifications">
    {notices.map(notice => {
      const Icon = notice.tone === "success" ? CheckCircle2 : notice.tone === "error" ? AlertCircle : Info;
      return <article key={notice.id} className={`crm-notice is-${notice.tone}`}>
        <span className="crm-notice-icon"><Icon size={19}/></span>
        <div><strong>{notice.title}</strong>{notice.message && <p>{notice.message}</p>}</div>
        <button type="button" aria-label="Dismiss notification" onClick={() => setNotices(current => current.filter(item => item.id !== notice.id))}><X size={15}/></button>
      </article>;
    })}
  </aside>;
}
