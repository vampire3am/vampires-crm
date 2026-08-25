import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type CrmNoticeTone = "success" | "error" | "info";
type CrmNotice = { id: string; tone: CrmNoticeTone; title: string; message?: string };
const EVENT = "aecs:notice";

export const notify = (tone: CrmNoticeTone, title: string, message?: string) => {
  if (tone === "success") (window as Window & { __aecsLastSuccessAt?: number }).__aecsLastSuccessAt = Date.now();
  return window.dispatchEvent(new CustomEvent(EVENT, { detail: { id: crypto.randomUUID(), tone, title, message } }));
};
export const notifySuccess = (title: string, message?: string) => notify("success", title, message);
export const notifyError = (title: string, message?: string) => notify("error", title, message);
export const notifyInfo = (title: string, message?: string) => notify("info", title, message);

export function CrmNotificationCenter() {
  const [notices, setNotices] = useState<CrmNotice[]>([]);
  const [errorNotice, setErrorNotice] = useState<CrmNotice | null>(null);
  useEffect(() => {
    const receive = (event: Event) => {
      const notice = (event as CustomEvent<CrmNotice>).detail;
      if (notice.tone === "error") {
        setErrorNotice(notice);
        return;
      }
      setNotices(current => [...current.slice(-3), notice]);
      window.setTimeout(() => setNotices(current => current.filter(item => item.id !== notice.id)), 4200);
    };
    window.addEventListener(EVENT, receive);
    return () => window.removeEventListener(EVENT, receive);
  }, []);

  useEffect(() => {
    const errorSelector = ".phase2-alert-error,.alert-banner.error,.form-error,.dashboard-error-banner,.student-document-error,.case-task-alert,[data-crm-error]";
    const successSelector = ".classes-success,.b2b-interaction-success,.staff-success,[data-crm-success]";
    const selector = `${errorSelector},${successSelector}`;
    const relay = (root: ParentNode) => {
      const candidates = root instanceof Element && root.matches(selector)
        ? [root]
        : Array.from(root.querySelectorAll?.(selector) ?? []);
      for (const element of candidates) {
        if (!(element instanceof HTMLElement) || element.dataset.crmRelayed || element.closest(".crm-error-popup-backdrop")) continue;
        const message = element.textContent?.replace(/\s+/g, " ").trim();
        if (!message) continue;
        element.dataset.crmRelayed = "true";
        if (element.matches(successSelector)) {
          (window as Window & { __aecsLastSuccessAt?: number }).__aecsLastSuccessAt = Date.now();
          const notice = { id: crypto.randomUUID(), tone: "success" as const, title: message };
          setNotices(current => [...current.slice(-3), notice]);
          window.setTimeout(() => setNotices(current => current.filter(item => item.id !== notice.id)), 4200);
        } else {
          setErrorNotice({ id: crypto.randomUUID(), tone: "error", title: "Unable to complete action", message });
        }
      }
    };
    relay(document.body);
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof Element) relay(node);
    })));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <><aside className="crm-notification-center" aria-live="polite" aria-label="CRM notifications">
    {notices.map(notice => {
      const Icon = notice.tone === "success" ? CheckCircle2 : Info;
      return <article key={notice.id} className={`crm-notice is-${notice.tone}`}>
        <span className="crm-notice-icon"><Icon size={19}/></span>
        <div><strong>{notice.title}</strong>{notice.message && <p>{notice.message}</p>}</div>
        <button type="button" aria-label="Dismiss notification" onClick={() => setNotices(current => current.filter(item => item.id !== notice.id))}><X size={15}/></button>
      </article>;
    })}
  </aside>{errorNotice && <div className="crm-error-popup-backdrop" role="presentation" onClick={() => setErrorNotice(null)}>
    <section className="crm-error-popup" role="alertdialog" aria-modal="true" aria-labelledby="crm-error-popup-title" onClick={event => event.stopPropagation()}>
      <button type="button" className="crm-error-popup-close" aria-label="Close error" onClick={() => setErrorNotice(null)}><X size={17}/></button>
      <span className="crm-error-popup-icon"><AlertCircle size={23}/></span>
      <small>Action not completed</small>
      <h3 id="crm-error-popup-title">{errorNotice.title}</h3>
      {errorNotice.message && <p>{errorNotice.message}</p>}
      <button type="button" className="btn-primary crm-error-popup-action" onClick={() => setErrorNotice(null)}>Okay</button>
    </section>
  </div>}</>;
}
