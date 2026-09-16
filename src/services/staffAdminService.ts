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
  "ADMIN", "HR_ADMIN", "DIRECTOR", "SENIOR_COUNSELLOR", "COUNSELLOR", "VISA_OFFICER",
  "ACCOUNTANT", "FRONT_DESK", "FACULTY", "MARKETING", "IT_ADMIN",
  "DOCUMENTATION", "FINANCE", "TEST_BOOKING",
];

export type StaffAdminRecord = {
  id: string; full_name: string; email: string; role: StaffRole; job_title: string;
  department: string; branch: string; phone: string | null; is_active: boolean;
  desktop_modules: string[] | null; assigned_responsibilities: string;
  access_mode: "ROLE_PLUS" | "EXACT"; inactivity_minutes: number;
  permission_overrides: string[];
  avatar_url?: string | null;
};

export type StaffAdminInput = Omit<StaffAdminRecord, "id" | "is_active"> & {
  password?: string; is_active?: boolean;
};

async function invoke(body: Record<string, unknown>) {
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) throw new Error("Unable to verify your administrator session. Sign in again.");
  let accessToken = sessionResult.data.session?.access_token;
  if (!accessToken) throw new Error("Your administrator session has expired. Sign in again.");

  const call = (token: string) => supabase.functions.invoke("invite-staff", {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  let { data, error } = await call(accessToken);
  let details: { error?: string } | null = null;
  if (error) {
    const context = (error as { context?: Response }).context;
    details = context
      ? await context.clone().json().catch(() => null) as { error?: string } | null
      : null;

    // A restored browser tab can briefly hold an expired JWT. Refresh once and
    // replay the protected request with the new token instead of showing a
    // misleading generic Unauthorized dialog.
    if (details?.error === "Unauthorized" || context?.status === 401) {
      const refreshed = await supabase.auth.refreshSession();
      accessToken = refreshed.data.session?.access_token;
      if (!refreshed.error && accessToken) {
        ({ data, error } = await call(accessToken));
        if (error) {
          const retryContext = (error as { context?: Response }).context;
          details = retryContext
            ? await retryContext.clone().json().catch(() => null) as { error?: string } | null
            : null;
        }
      }
    }
  }

  if (error) {
    if (details?.error === "Unauthorized") throw new Error("Your administrator session has expired. Sign in again.");
    if (details?.error) throw new Error(details.error);
    throw new Error(error.message || "Staff operation failed");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const StaffAdminService = {
  async list(): Promise<StaffAdminRecord[]> {
    const { data, error } = await supabase.from("staff_profiles")
      .select("id,full_name,email,role,job_title,department,branch,phone,is_active,desktop_modules,assigned_responsibilities,access_mode,inactivity_minutes,avatar_url")
      .order("full_name");
    if (error) throw error;
    const ids = (data ?? []).map(member => member.id);
    const { data: overrides, error: overrideError } = ids.length
      ? await supabase.from("staff_permission_overrides").select("staff_id,permission_name,enabled").in("staff_id", ids)
      : { data: [], error: null };
    if (overrideError) throw overrideError;
    return (data ?? []).map(member => ({
      ...member,
      permission_overrides: (overrides ?? []).filter(item => item.staff_id === member.id && item.enabled).map(item => item.permission_name),
    })) as StaffAdminRecord[];
  },
  async rolePermissions(role: StaffRole): Promise<string[]> {
    const { data, error } = await supabase.from("permissions").select("permission_name").eq("role", role).eq("enabled", true);
    if (error) throw error;
    return (data ?? []).map(item => item.permission_name);
  },
  create(input: StaffAdminInput) { return invoke({ action: "create", ...input }) as Promise<{ok: boolean; user_id: string; employee_id: string}>; },
  update(id: string, input: StaffAdminInput) { return invoke({ action: "update", user_id: id, ...input }); },
  async employeeId(staffProfileId: string) { const { data, error } = await supabase.from("hr_employees").select("id").eq("staff_profile_id", staffProfileId).maybeSingle(); if (error) throw error; return data?.id as string | undefined; },
  async uploadAvatar(staffProfileId:string,file:File){if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Choose a JPG, PNG, or WEBP profile picture.");if(file.size>5*1024*1024)throw new Error("Profile pictures must be 5 MB or smaller.");const extension=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";const path=`${staffProfileId}/profile.${extension}`;const{error:uploadError}=await supabase.storage.from("staff-avatars").upload(path,file,{contentType:file.type,upsert:true,cacheControl:"3600"});if(uploadError)throw new Error(uploadError.message);const{data}=supabase.storage.from("staff-avatars").getPublicUrl(path);const avatarUrl=`${data.publicUrl}?v=${Date.now()}`;const{error}=await supabase.rpc("set_staff_avatar",{staff_uuid:staffProfileId,avatar_url_value:avatarUrl});if(error)throw new Error(error.message);return avatarUrl},
  setPassword(id: string, password: string) { return invoke({ action: "set_password", user_id: id, password }); },
};
