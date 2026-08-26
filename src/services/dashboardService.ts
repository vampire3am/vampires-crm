import { supabase } from "../lib/supabase";

export interface DashboardTrendPoint { day: string; leads: number; applications: number }
export interface DashboardDestination { name: string; value: number; color: string }
export interface DashboardAppointment { id: string; time: string; studentName: string; target: string; counsellor: string; status: string }
export interface DashboardActivity { id: string; type: "visa" | "offer" | "invoice" | "student"; title: string; desc: string; time: string; user: string }
export interface DashboardOperationalData {
  trend: DashboardTrendPoint[];
  destinations: DashboardDestination[];
  appointments: DashboardAppointment[];
  activities: DashboardActivity[];
}

type RelatedName = { full_name?: string } | Array<{ full_name?: string }> | null;
type RelatedLead = { full_name?: string; target_country?: string } | Array<{ full_name?: string; target_country?: string }> | null;

const DAY_MS = 86_400_000;
const COLORS = ["#F97316", "#0EA5E9", "#10B981", "#8B5CF6", "#F59E0B", "#64748B"];
const countryLabels: Record<string, string> = { uk: "United Kingdom", usa: "United States", uae: "United Arab Emirates" };

const relation = <T>(value: T | T[] | null | undefined): T | undefined => Array.isArray(value) ? value[0] : value ?? undefined;
const dayKey = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const pretty = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const relativeTime = (value: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(value).toLocaleDateString("en-NP", { month: "short", day: "numeric", timeZone: "Asia/Kathmandu" });
};
const activityType = (action: string, module = ""): DashboardActivity["type"] => {
  const value = `${action} ${module}`.toUpperCase();
  if (value.includes("VISA")) return "visa";
  if (value.includes("APPLICATION") || value.includes("OFFER")) return "offer";
  if (value.includes("INVOICE") || value.includes("RECEIPT") || value.includes("FINANCE") || value.includes("PAYMENT")) return "invoice";
  return "student";
};

async function loadTrend(): Promise<DashboardTrendPoint[]> {
  const today = new Date(`${dayKey(new Date())}T00:00:00+05:45`);
  const start = new Date(today.getTime() - 29 * DAY_MS);
  const [leadResult, applicationResult] = await Promise.all([
    supabase.from("leads").select("created_at").gte("created_at", start.toISOString()),
    supabase.from("university_applications").select("created_at").gte("created_at", start.toISOString()),
  ]);
  if (leadResult.error) throw leadResult.error;
  if (applicationResult.error) throw applicationResult.error;
  const leadCounts = new Map<string, number>();
  const applicationCounts = new Map<string, number>();
  leadResult.data?.forEach(row => leadCounts.set(dayKey(row.created_at), (leadCounts.get(dayKey(row.created_at)) ?? 0) + 1));
  applicationResult.data?.forEach(row => applicationCounts.set(dayKey(row.created_at), (applicationCounts.get(dayKey(row.created_at)) ?? 0) + 1));
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    const key = dayKey(date);
    return {
      day: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kathmandu" }),
      leads: leadCounts.get(key) ?? 0,
      applications: applicationCounts.get(key) ?? 0,
    };
  });
}

async function loadDestinations(): Promise<DashboardDestination[]> {
  const [studentResult, leadResult] = await Promise.all([
    supabase.from("study_preferences").select("preferred_country"),
    supabase.from("leads").select("target_country").not("stage", "in", "(CONVERTED,LOST)"),
  ]);
  if (studentResult.error) throw studentResult.error;
  if (leadResult.error) throw leadResult.error;
  const counts = new Map<string, number>();
  const add = (country?: string | null) => {
    const raw = country?.trim();
    if (!raw) return;
    const label = countryLabels[raw.toLowerCase()] ?? raw;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  };
  studentResult.data?.forEach(row => add(row.preferred_country));
  leadResult.data?.forEach(row => add(row.target_country));
  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count], index) => ({
    name,
    value: total ? Math.round((count / total) * 100) : 0,
    color: COLORS[index % COLORS.length],
  }));
}

async function loadAppointments(): Promise<DashboardAppointment[]> {
  const today = dayKey(new Date());
  const start = new Date(`${today}T00:00:00+05:45`);
  const end = new Date(start.getTime() + DAY_MS);
  const { data, error } = await supabase.from("lead_follow_ups")
    .select("id,due_at,note,completed_at,leads(full_name,target_country),staff_profiles!lead_follow_ups_assigned_to_fkey(full_name)")
    .is("completed_at", null).gte("due_at", start.toISOString()).lt("due_at", end.toISOString()).order("due_at").limit(8);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ id: string; due_at: string; note: string; leads: RelatedLead; staff_profiles: RelatedName }>).map(row => {
    const lead = relation(row.leads);
    return {
      id: row.id,
      time: new Date(row.due_at).toLocaleTimeString("en-NP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" }),
      studentName: lead?.full_name ?? "Lead follow-up",
      target: lead?.target_country || row.note || "Counselling follow-up",
      counsellor: relation(row.staff_profiles)?.full_name ?? "Unassigned",
      status: "Scheduled",
    };
  });
}

async function loadActivities(): Promise<DashboardActivity[]> {
  const [studentResult, auditResult, leadResult] = await Promise.allSettled([
    supabase.from("activity_logs").select("id,action,metadata,created_at,students(full_name),staff_profiles!activity_logs_created_by_fkey(full_name)").order("created_at", { ascending: false }).limit(8),
    supabase.from("audit_logs").select("id,action,module,metadata,created_at,staff_profiles!audit_logs_user_id_fkey(full_name)").order("created_at", { ascending: false }).limit(8),
    supabase.from("lead_activities").select("id,activity_type,body,created_at,leads(full_name),staff_profiles!lead_activities_created_by_fkey(full_name)").order("created_at", { ascending: false }).limit(8),
  ]);
  const activities: Array<DashboardActivity & { createdAt: string }> = [];
  if (studentResult.status === "fulfilled" && !studentResult.value.error) {
    type Row = { id: number; action: string; metadata: Record<string, unknown>; created_at: string; students: RelatedName; staff_profiles: RelatedName };
    ((studentResult.value.data ?? []) as unknown as Row[]).forEach(row => activities.push({ id: `student-${row.id}`, type: activityType(row.action), title: pretty(row.action), desc: relation(row.students)?.full_name ?? "Student record updated", time: relativeTime(row.created_at), user: relation(row.staff_profiles)?.full_name ?? "CRM Staff", createdAt: row.created_at }));
  }
  if (auditResult.status === "fulfilled" && !auditResult.value.error) {
    type Row = { id: number; action: string; module: string; metadata: Record<string, unknown>; created_at: string; staff_profiles: RelatedName };
    ((auditResult.value.data ?? []) as unknown as Row[]).forEach(row => activities.push({ id: `audit-${row.id}`, type: activityType(row.action, row.module), title: pretty(row.action), desc: `${pretty(row.module)} record updated`, time: relativeTime(row.created_at), user: relation(row.staff_profiles)?.full_name ?? "CRM Staff", createdAt: row.created_at }));
  }
  if (leadResult.status === "fulfilled" && !leadResult.value.error) {
    type Row = { id: number; activity_type: string; body: string | null; created_at: string; leads: RelatedName; staff_profiles: RelatedName };
    ((leadResult.value.data ?? []) as unknown as Row[]).forEach(row => activities.push({ id: `lead-${row.id}`, type: "student", title: pretty(row.activity_type), desc: row.body || relation(row.leads)?.full_name || "Lead activity recorded", time: relativeTime(row.created_at), user: relation(row.staff_profiles)?.full_name ?? "CRM Staff", createdAt: row.created_at }));
  }
  return activities.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10).map(item => ({
    id: item.id,
    type: item.type,
    title: item.title,
    desc: item.desc,
    time: item.time,
    user: item.user,
  }));
}

export const DashboardService = {
  async getOperationalData(): Promise<DashboardOperationalData> {
    const results = await Promise.allSettled([loadTrend(), loadDestinations(), loadAppointments(), loadActivities()]);
    return {
      trend: results[0].status === "fulfilled" ? results[0].value : [],
      destinations: results[1].status === "fulfilled" ? results[1].value : [],
      appointments: results[2].status === "fulfilled" ? results[2].value : [],
      activities: results[3].status === "fulfilled" ? results[3].value : [],
    };
  },
};
