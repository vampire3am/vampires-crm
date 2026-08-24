import { supabase } from "../lib/supabase";

// =========================================================================
// AECS EMAIL AUTOMATION & DRIP CAMPAIGN SERVICE
// Enterprise Trigger Rules Engine, Merge Tag Interpolation & Delivery Sync
// =========================================================================

export interface EmailTemplate {
  id: string;
  name: string;
  category: "ONBOARDING" | "COUNSELLING" | "APPLICATION" | "VISA" | "TEST_PREP" | "FINANCE" | "DRIP" | "GREETINGS";
  subject: string;
  preheader: string;
  badge: string;
  headerColor: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  updatedAt: string;
  isSystem?: boolean;
}

export interface AutomationRule {
  id: string;
  name: string;
  triggerEvent:
    | "LEAD_CREATED"
    | "COUNSELLING_SCHEDULED"
    | "DOCS_SUBMITTED"
    | "APPLICATION_SENT"
    | "OFFER_RECEIVED"
    | "VISA_LODGED"
    | "VISA_GRANTED"
    | "MOCK_TEST_EVALUATED"
    | "PAYMENT_RECEIVED"
    | "INACTIVE_LEAD_DAY3"
    | "INACTIVE_LEAD_DAY7";
  templateId: string;
  isActive: boolean;
  delayHours: number;
  destinationFilter?: string; // "ALL" | "Australia" | "UK" | "USA" | "Canada" | "New Zealand" | "Europe"
  description: string;
  totalTriggered: number;
}

export interface EmailLog {
  id: string;
  to: string;
  toName: string;
  subject: string;
  templateId: string;
  automationId?: string | null;
  triggerEvent: string;
  studentId?: string | null;
  status: "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "QUEUED";
  deliveredAt: string;
  openedAt?: string | null;
  clickedAt?: string | null;
  previewSnippet: string;
}

export interface SmtpSettings {
  provider: "smtp" | "sendgrid" | "resend" | "gmail" | "aws_ses";
  senderName: string;
  senderEmail: string;
  replyTo: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass?: string;
  apiKey?: string;
  enableRealSending: boolean;
}

// Default High-Converting AECS Professional Email Templates
export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "tpl-welcome",
    name: "Welcome Pack & Country Guide",
    category: "ONBOARDING",
    badge: "Instant Auto-Responder",
    headerColor: "#F97316",
    subject: "Welcome to AECS Bagbazar, {{student_name}}! Your {{destination_country}} Study Guide",
    preheader: "Official Study Abroad Handbook, Scholarship Checklist & Next Steps",
    bodyHtml: `<p>Dear <strong>{{student_name}}</strong>,</p>
<p>Thank you for registering with <strong>AECS Education Consultancy</strong>, Kathmandu! We are thrilled to guide you on your international education journey to <strong>{{destination_country}}</strong>.</p>
<div style="background:#F1F5F9; border-left:4px solid #F97316; padding:12px 16px; margin:16px 0; border-radius:6px;">
  <strong>📌 Your Profile Summary:</strong><br/>
  • Target Destination: <strong>{{destination_country}}</strong><br/>
  • Preferred Intake: <strong>{{intake_season}}</strong><br/>
  • Dedicated Counsellor: <strong>{{counsellor_name}}</strong><br/>
  • Main Office: Adwait Marga, Purano Buspark, Bagbazar, Kathmandu
</div>
<p>Our senior counseling team is reviewing your academic records to match you with verified university scholarships up to 50% tuition reduction.</p>
<p>Feel free to visit our central office or reply directly to this email to fast-track your document appraisal.</p>`,
    ctaText: "Download {{destination_country}} Guide PDF",
    ctaUrl: "https://aecsnepal.com/",
    updatedAt: "2026-08-20T10:00:00Z",
    isSystem: true,
  },
  {
    id: "tpl-counselling",
    name: "Counselling Appointment Confirmation",
    category: "COUNSELLING",
    badge: "1-on-1 Guidance",
    headerColor: "#4F46E5",
    subject: "Confirmed: 1-on-1 Study Abroad Counselling with {{counsellor_name}}",
    preheader: "Your appointment details and document preparation checklist",
    bodyHtml: `<p>Dear <strong>{{student_name}}</strong>,</p>
<p>Your 1-on-1 study abroad consultation for <strong>{{destination_country}}</strong> is officially confirmed with <strong>{{counsellor_name}}</strong>.</p>
<div style="background:#EEF2FF; border:1px solid #C7D2FE; padding:14px; margin:16px 0; border-radius:8px;">
  <strong>📅 Appointment Overview:</strong><br/>
  • Counsellor: <strong>{{counsellor_name}} (Senior Desk Officer)</strong><br/>
  • Location: <strong>AECS, Adwait Marga, Purano Buspark, Bagbazar / Google Meet</strong><br/>
  • Time: <strong>{{appointment_time}}</strong><br/>
  • Direct Helpline: <strong>+977 9801980003</strong>
</div>
<p><strong>Please have ready:</strong> Academic Transcripts (+2 / Bachelor's), English Test score (if available), and valid Passport copy.</p>`,
    ctaText: "View / Reschedule Appointment",
    ctaUrl: "https://aecsnepal.com/",
    updatedAt: "2026-08-20T10:00:00Z",
    isSystem: true,
  },
  {
    id: "tpl-offer",
    name: "University Offer Letter Received",
    category: "APPLICATION",
    badge: "Admissions Milestone",
    headerColor: "#059669",
    subject: "🎉 Congratulations {{student_name}}! Your University Offer Letter Has Arrived",
    preheader: "Official Letter of Offer issued for {{destination_country}}",
    bodyHtml: `<p>Dear <strong>{{student_name}}</strong>,</p>
<p>We are delighted to inform you that your university application has been <strong>ACCEPTED</strong>! 🎓</p>
<div style="background:#ECFDF5; border-left:4px solid #10B981; padding:14px; margin:16px 0; border-radius:6px;">
  <strong>📄 Offer Summary:</strong><br/>
  • Institution: <strong>{{university_name}}</strong><br/>
  • Target Intake: <strong>{{intake_season}}</strong><br/>
  • Application ID: <strong>{{application_id}}</strong><br/>
  • Acceptance Deadline: <strong>Within 14 Days</strong>
</div>
<p>Our compliance team is preparing your GTE/GS financial documentation and Confirmation of Enrolment (CoE / CAS / I-20) package.</p>`,
    ctaText: "Accept Offer in Portal",
    ctaUrl: "https://aecsnepal.com/",
    updatedAt: "2026-08-20T10:00:00Z",
    isSystem: true,
  },
  {
    id: "tpl-visa-granted",
    name: "Visa Granted & Pre-Departure Notice",
    category: "VISA",
    badge: "High-Priority Success",
    headerColor: "#D97706",
    subject: "🌟 VISA GRANTED! Pre-Departure Checklist for {{destination_country}}",
    preheader: "Your official visa grant notification from Department of Home Affairs",
    bodyHtml: `<p>Dear <strong>{{student_name}}</strong>,</p>
<p>Heartiest congratulations from the entire executive management at <strong>AECS Education Consultancy</strong>! 🎉✈️</p>
<p>Your student visa for <strong>{{destination_country}}</strong> has been <strong>OFFICIALLY GRANTED</strong>.</p>
<div style="background:#FFFBEB; border:1px solid #FDE68A; padding:14px; margin:16px 0; border-radius:8px;">
  <strong>✈️ Pre-Departure Briefing Seminar:</strong><br/>
  • Date: <strong>This Friday @ 2:00 PM</strong><br/>
  • Venue: <strong>AECS Central Conference Hall</strong><br/>
  • Topics: Airport immigration, Forex exchange, SIM card, student accommodation & airport pickup.
</div>
<p>Please bring your passport copy to collect your official Visa Grant Letter and AECS Student Departure Kit.</p>`,
    ctaText: "Download Pre-Departure Pack",
    ctaUrl: "https://aecsnepal.com/",
    updatedAt: "2026-08-20T10:00:00Z",
    isSystem: true,
  },
  {
    id: "tpl-mock-score",
    name: "Mock Test Scorecard & Evaluation",
    category: "TEST_PREP",
    badge: "Scorecard Release",
    headerColor: "#7C3AED",
    subject: "Your Official AECS IELTS/PTE Mock Test Scorecard (Score: {{mock_score}})",
    preheader: "Section-by-section band analysis and masterclass tips",
    bodyHtml: `<p>Dear <strong>{{student_name}}</strong>,</p>
<p>Your diagnostic <strong>{{test_type}}</strong> evaluation from Saturday's simulation has been evaluated by our certified master trainers.</p>
<div style="background:#F5F3FF; border:1px solid #DDD6FE; padding:14px; margin:16px 0; border-radius:8px;">
  <strong>📊 Score Breakdown:</strong><br/>
  • Overall Result: <strong>{{mock_score}}</strong><br/>
  • Listening / Reading: <strong>Band 7.0+</strong><br/>
  • Speaking & Writing: <strong>Detailed feedback available in portal</strong><br/>
  • Trainer Note: <em>"Great task response! Practice speaking coherence to achieve 8.0."</em>
</div>
<p>Book a free 15-minute speaking critique session with our Cambridge-certified instructor.</p>`,
    ctaText: "View Full Scorecard PDF",
    ctaUrl: "https://aecsnepal.com/",
    updatedAt: "2026-08-20T10:00:00Z",
    isSystem: true,
  },
  {
    id: "tpl-receipt",
    name: "Official Payment Receipt",
    category: "FINANCE",
    badge: "Accounts & Billing",
    headerColor: "#0284C7",
    subject: "Official Payment Receipt - AECS Education Consultancy (NPR {{amount_paid}})",
    preheader: "Payment voucher and balance acknowledgment for {{student_name}}",
    bodyHtml: `<p>Dear <strong>{{student_name}}</strong>,</p>
<p>Thank you for your payment. We have successfully recorded your transaction in our central ledger.</p>
<div style="background:#F0F9FF; border:1px solid #BAE6FD; padding:14px; margin:16px 0; border-radius:8px;">
  <strong>🧾 Receipt Details:</strong><br/>
  • Receipt / Voucher No: <strong>{{invoice_no}}</strong><br/>
  • Amount Credited: <strong>NPR {{amount_paid}}</strong><br/>
  • Purpose: <strong>{{payment_purpose}}</strong><br/>
  • Issued By: <strong>AECS Finance & Billing Desk</strong>
</div>
<p>This is a computer-generated tax invoice and requires no physical signature.</p>`,
    ctaText: "Download Tax Invoice",
    ctaUrl: "https://aecsnepal.com/",
    updatedAt: "2026-08-20T10:00:00Z",
    isSystem: true,
  },
  {
    id: "tpl-drip-day3",
    name: "Lead Drip: Scholarship Opportunities",
    category: "DRIP",
    badge: "Automated Nurturing",
    headerColor: "#E11D48",
    subject: "{{student_name}}, unlock up to $10,000 Scholarships for {{destination_country}}",
    preheader: "Upcoming application deadlines for {{intake_season}} intake",
    bodyHtml: `<p>Hi <strong>{{student_name}}</strong>,</p>
<p>Did you know that over <strong>85%</strong> of AECS students qualify for merit-based tuition grants for <strong>{{destination_country}}</strong>?</p>
<p>Applications for the upcoming <strong>{{intake_season}}</strong> intake are filling rapidly. Top universities are closing priority scholarship quotas this month.</p>
<p>Our senior advisors can help you secure waiver letters and fast-track admissions without processing delays.</p>`,
    ctaText: "Claim Free Scholarship Check",
    ctaUrl: "https://aecsnepal.com/",
    updatedAt: "2026-08-20T10:00:00Z",
    isSystem: true,
  },
];

// Default Active Automation Rules
export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: "auto-welcome",
    name: "Instant Welcome Pack on Lead Registration",
    triggerEvent: "LEAD_CREATED",
    templateId: "tpl-welcome",
    isActive: true,
    delayHours: 0,
    destinationFilter: "ALL",
    description: "Sends branded brochure, country guide, and assigned counsellor contact instantly.",
    totalTriggered: 148,
  },
  {
    id: "auto-counselling",
    name: "Counselling Appointment Calendar Confirmation",
    triggerEvent: "COUNSELLING_SCHEDULED",
    templateId: "tpl-counselling",
    isActive: true,
    delayHours: 0,
    destinationFilter: "ALL",
    description: "Sends meeting venue, executive desk room, and document checklist.",
    totalTriggered: 92,
  },
  {
    id: "auto-offer",
    name: "Offer Letter Celebration & Acceptance Guide",
    triggerEvent: "OFFER_RECEIVED",
    templateId: "tpl-offer",
    isActive: true,
    delayHours: 0,
    destinationFilter: "ALL",
    description: "Congratulates student, provides offer acceptance terms and fee deposit steps.",
    totalTriggered: 54,
  },
  {
    id: "auto-visa",
    name: "Visa Grant Notification & Pre-Departure Briefing",
    triggerEvent: "VISA_GRANTED",
    templateId: "tpl-visa-granted",
    isActive: true,
    delayHours: 0,
    destinationFilter: "ALL",
    description: "Alerts student of visa approval and schedules pre-departure orientation at the Bagbazar office.",
    totalTriggered: 39,
  },
  {
    id: "auto-mock",
    name: "IELTS / PTE Mock Test Score Release",
    triggerEvent: "MOCK_TEST_EVALUATED",
    templateId: "tpl-mock-score",
    isActive: true,
    delayHours: 0,
    destinationFilter: "ALL",
    description: "Delivers band score breakdown and personalized speaking/writing feedback.",
    totalTriggered: 87,
  },
  {
    id: "auto-payment",
    name: "Payment Receipt & Ledger Confirmation",
    triggerEvent: "PAYMENT_RECEIVED",
    templateId: "tpl-receipt",
    isActive: true,
    delayHours: 0,
    destinationFilter: "ALL",
    description: "Dispatches official VAT/Tax invoice and balance summary automatically.",
    totalTriggered: 116,
  },
  {
    id: "auto-drip-cold",
    name: "Day-3 Lead Drip: Scholarship Fast-Track",
    triggerEvent: "INACTIVE_LEAD_DAY3",
    templateId: "tpl-drip-day3",
    isActive: true,
    delayHours: 72,
    destinationFilter: "ALL",
    description: "Re-engages inactive inquiries with verified scholarship grants and deadlines.",
    totalTriggered: 63,
  },
];

export class EmailAutomationService {
  // 1. Fetch Templates with Fallback
  static async getTemplates(): Promise<EmailTemplate[]> {
    const { data, error } = await supabase
      .from("email_templates")
      .select("id,name,category,subject,preheader,body_html,updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(row => ({
      id: row.id,
      name: row.name,
      category: row.category as EmailTemplate["category"],
      subject: row.subject,
      preheader: row.preheader ?? "",
      badge: "Custom Template",
      headerColor: "#F97316",
      bodyHtml: row.body_html,
      updatedAt: row.updated_at,
      isSystem: false,
    }));
  }

  // 2. Save Templates
  static async saveTemplates(templates: EmailTemplate[]): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return false;
    const rows = templates.map(template => ({
      id: template.id,
      template_key: `custom_${template.id.replaceAll("-", "_")}`,
      name: template.name,
      category: template.category,
      subject: template.subject,
      preheader: template.preheader,
      body_html: template.bodyHtml,
      is_active: true,
      updated_by: authData.user.id,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("email_templates").upsert(rows, { onConflict: "id" });
    return !error;
  }

  static async deleteTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from("email_templates").delete().eq("id", templateId);
    return error ? { success: false, error: error.message } : { success: true };
  }

  // 3. Fetch Automation Rules
  static async getAutomations(): Promise<AutomationRule[]> {
    const { data, error } = await supabase
      .from("email_automations")
      .select("id,name,trigger_event,template_id,is_active,delay_hours,destination_filter")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(row => ({
      id: row.id,
      name: row.name,
      triggerEvent: row.trigger_event as AutomationRule["triggerEvent"],
      templateId: row.template_id,
      isActive: row.is_active,
      delayHours: row.delay_hours,
      destinationFilter: row.destination_filter ?? "ALL",
      description: "User-configured lifecycle communication rule.",
      totalTriggered: 0,
    }));
  }

  // 4. Save Automation Rules
  static async saveAutomations(automations: AutomationRule[]): Promise<boolean> {
    try {
      const res = await fetch("/api/sync/email/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(automations),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // 5. Fetch Activity Logs
  static async getLogs(): Promise<EmailLog[]> {
    const{data,error}=await supabase.from("email_delivery_logs").select("*").order("queued_at",{ascending:false});if(error)throw error;return(data??[]).map(l=>({id:l.id,to:l.recipient_email,toName:l.recipient_name,subject:l.subject,templateId:l.template_id??"",automationId:l.automation_id,triggerEvent:l.trigger_event,studentId:l.student_id,status:l.status,deliveredAt:l.delivered_at??l.queued_at,openedAt:l.opened_at,clickedAt:l.clicked_at,previewSnippet:l.error_message??"Queued for delivery"}))as EmailLog[];
  }

  // 6. Fetch SMTP Settings
  static async getSettings(): Promise<SmtpSettings> {
    try {
      const res = await fetch("/api/sync/email/settings");
      if (res.ok) {
        const data = await res.json();
        if (data && data.senderEmail) return data;
      }
    } catch {}
    return {
      provider: "smtp",
      senderName: "AECS Global Admissions",
      senderEmail: "",
      replyTo: "",
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpUser: "",
      enableRealSending: false,
    };
  }

  // 7. Save SMTP Settings
  static async saveSettings(settings: SmtpSettings): Promise<boolean> {
    try {
      const res = await fetch("/api/sync/email/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // 7.1 Test SMTP Connection
  static async testSmtpConnection(settings: SmtpSettings): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch("/api/sync/email/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // 8. Variable Interpolator (Replaces {{student_name}}, {{destination_country}}, etc.)
  static interpolate(
    text: string,
    vars: Record<string, string | number | undefined | null>
  ): string {
    let result = text || "";
    Object.keys(vars).forEach(key => {
      const val = vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : "";
      const regex = new RegExp(`{{${key}}}`, "g");
      result = result.replace(regex, val);
    });
    return result;
  }

  // 9. Send Email or Trigger Automation
  static async sendEmail(params: {
    to: string;
    toName?: string;
    templateId?: string;
    subject?: string;
    bodyHtml?: string;
    automationId?: string;
    triggerEvent?: string;
    studentId?: string;
    variables?: Record<string, string | number>;
  }): Promise<{ success: boolean; log?: EmailLog; error?: string }> {
    try {
      let finalSubject = params.subject || "Important Update from AECS Education Consultancy";
      let finalHtml = params.bodyHtml || "";

      // If templateId provided, load and interpolate
      if (params.templateId) {
        const templates = await this.getTemplates();
        const tpl = templates.find(t => t.id === params.templateId);
        if (tpl) {
          const vars = {
            student_name: params.toName || "Student",
            destination_country: "Australia",
            counsellor_name: "Assigned counsellor",
            intake_season: "February 2027",
            application_id: "AECS-2026-8891",
            university_name: "University of Sydney",
            appointment_time: "Tomorrow at 11:30 AM",
            mock_score: "Overall Band 7.5 (L:8.0, R:7.5, W:7.0, S:7.5)",
            test_type: "IELTS Academic",
            invoice_no: `INV-${Date.now().toString().slice(-6)}`,
            amount_paid: "25,000",
            payment_purpose: "Application & University Processing Fee",
            branch_name: "AECS Bagbazar Main Office",
            ...params.variables,
          };
          finalSubject = this.interpolate(tpl.subject, vars);
          finalHtml = this.interpolate(tpl.bodyHtml, vars);
        }
      }

      void finalHtml;
      const{data,error}=await supabase.rpc("queue_email",{payload:{to:params.to,to_name:params.toName||"Student",subject:finalSubject,template_id:params.templateId&&/^[0-9a-f-]{36}$/i.test(params.templateId)?params.templateId:"",automation_id:params.automationId&&/^[0-9a-f-]{36}$/i.test(params.automationId)?params.automationId:"",student_id:params.studentId||"",trigger_event:params.triggerEvent||"Manual Send"}});if(error)throw error;const logs=await this.getLogs();return{success:true,log:logs.find(log=>log.id===data)};
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // 10. Trigger Automation by Event (e.g. On Lead Added, Visa Granted)
  static async triggerEvent(
    eventType: AutomationRule["triggerEvent"],
    context: {
      studentName: string;
      studentEmail: string;
      destinationCountry?: string;
      counsellorName?: string;
      intakeSeason?: string;
      applicationId?: string;
      mockScore?: string;
      amountPaid?: string | number;
      invoiceNo?: string;
      studentId?: string;
    }
  ) {
    try {
      const automations = await this.getAutomations();
      const matched = automations.filter(
        a =>
          a.isActive &&
          a.triggerEvent === eventType &&
          (a.destinationFilter === "ALL" ||
            !context.destinationCountry ||
            a.destinationFilter === context.destinationCountry)
      );

      for (const rule of matched) {
        await this.sendEmail({
          to: context.studentEmail,
          toName: context.studentName,
          templateId: rule.templateId,
          automationId: rule.id,
          triggerEvent: eventType,
          studentId: context.studentId,
          variables: {
            student_name: context.studentName,
            destination_country: context.destinationCountry || "Australia",
            counsellor_name: context.counsellorName || "Assigned counsellor",
            intake_season: context.intakeSeason || "February 2027",
            application_id: context.applicationId || "AECS-KTM-7821",
            mock_score: context.mockScore || "Band 7.5",
            amount_paid: context.amountPaid || "25,000",
            invoice_no: context.invoiceNo || `REC-${Date.now().toString().slice(-5)}`,
          },
        });
      }
    } catch (e) {
      console.warn("Automation trigger failed:", e);
    }
  }
}
