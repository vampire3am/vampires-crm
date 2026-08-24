import { supabase } from "../lib/supabase";
import type { StaffRole } from "../features/auth/AuthProvider";

export const STAFF_MODULES = [
  ["dashboard", "Dashboard"], ["leads", "Leads"], ["students", "Students"],
  ["counselling", "Abroad & Counselling"], ["applications", "Applications"],
  ["b2b", "B2B Partners"], ["classes", "Classes"], ["mocks", "Mock Tests"],
  ["documents", "Documents"], ["finance", "Finance"], ["reports", "Reports"],
  ["hrms", "HRMS"], ["messages", "Messages"], ["settings", "Administration"],
] as const;

export const STAFF_ROLES: StaffRole[] = [
  "ADMIN", "DIRECTOR", "SENIOR_COUNSELLOR", "COUNSELLOR", "VISA_OFFICER",
  "ACCOUNTANT", "FRONT_DESK", "FACULTY", "MARKETING", "IT_ADMIN",
  "DOCUMENTATION", "FINANCE", "TEST_BOOKING",
];

export type StaffAdminRecord = {
  id: string; full_name: string; email: string; role: StaffRole; job_title: string;
  department: string; branch: string; phone: string | null; is_active: boolean;
  desktop_modules: string[] | null; assigned_responsibilities: string;
};

export type StaffAdminInput = Omit<StaffAdminRecord, "id" | "is_active"> & {
  password?: string; is_active?: boolean;
};

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("invite-staff", { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      const details = await context.clone().json().catch(() => null) as { error?: string } | null;
      if (details?.error) throw new Error(details.error);
    }
    throw new Error(error.message || "Staff operation failed");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const StaffAdminService = {
  async list(): Promise<StaffAdminRecord[]> {
    const { data, error } = await supabase.from("staff_profiles")
      .select("id,full_name,email,role,job_title,department,branch,phone,is_active,desktop_modules,assigned_responsibilities")
      .order("full_name");
    if (error) throw error;
    return (data ?? []) as StaffAdminRecord[];
  },
  create(input: StaffAdminInput) { return invoke({ action: "create", ...input }); },
  update(id: string, input: StaffAdminInput) { return invoke({ action: "update", user_id: id, ...input }); },
  setPassword(id: string, password: string) { return invoke({ action: "set_password", user_id: id, password }); },
};
