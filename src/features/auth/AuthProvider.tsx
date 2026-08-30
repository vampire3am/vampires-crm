import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

export type StaffRole =
  | "ADMIN"
  | "HR_ADMIN"
  | "DIRECTOR"
  | "SENIOR_COUNSELLOR"
  | "COUNSELLOR"
  | "VISA_OFFICER"
  | "ACCOUNTANT"
  | "FRONT_DESK"
  | "FACULTY"
  | "MARKETING"
  | "IT_ADMIN"
  | "DOCUMENTATION"
  | "FINANCE"
  | "TEST_BOOKING";

export interface RolePermissions {
  dashboard: boolean;
  leads: boolean;
  students: boolean;
  counselling: boolean;
  applications: boolean;
  b2b: boolean;
  classes: boolean;
  mocks: boolean;
  documents: boolean;
  finance: boolean;
  reports: boolean;
  hrms: boolean;
  settings: boolean;
  messages: boolean;
  assignments: boolean;
}

const permissions = (
  enabled: Array<keyof RolePermissions>
): RolePermissions => Object.fromEntries(
  Object.keys(ROLE_PERMISSION_KEYS).map(key => [key, enabled.includes(key as keyof RolePermissions)])
) as unknown as RolePermissions;

const ROLE_PERMISSION_KEYS: RolePermissions = {
  dashboard: false,
  leads: false,
  students: false,
  counselling: false,
  applications: false,
  b2b: false,
  classes: false,
  mocks: false,
  documents: false,
  finance: false,
  reports: false,
  hrms: false,
  settings: false,
  messages: false,
  assignments: false,
};

const ALL_PERMISSIONS = Object.keys(ROLE_PERMISSION_KEYS) as Array<keyof RolePermissions>;

export const ROLE_PERMISSIONS: Record<StaffRole, RolePermissions> = {
  ADMIN: permissions(["dashboard", "leads", "students", "counselling", "applications", "b2b", "classes", "mocks", "documents", "finance", "reports", "hrms", "settings", "messages", "assignments"]),
  HR_ADMIN: permissions(["dashboard", "hrms", "reports", "settings", "documents", "messages", "assignments"]),
  DIRECTOR: permissions(ALL_PERMISSIONS.filter(permission => permission !== "settings")),
  SENIOR_COUNSELLOR: permissions(["dashboard", "leads", "students", "counselling", "applications", "b2b", "documents", "messages", "assignments"]),
  COUNSELLOR: permissions(["dashboard", "leads", "students", "counselling", "applications", "documents", "messages", "assignments"]),
  VISA_OFFICER: permissions(["dashboard", "students", "applications", "documents", "messages", "assignments"]),
  ACCOUNTANT: permissions(["dashboard", "students", "b2b", "finance", "reports", "messages", "assignments"]),
  FRONT_DESK: permissions(["dashboard", "leads", "students", "classes", "mocks", "messages", "assignments"]),
  FACULTY: permissions(["dashboard", "students", "classes", "mocks", "messages", "assignments"]),
  MARKETING: permissions(["dashboard", "leads", "students", "b2b", "reports", "messages", "assignments"]),
  IT_ADMIN: permissions(["dashboard", "documents", "hrms", "settings", "messages", "assignments"]),
  DOCUMENTATION: permissions(["dashboard", "students", "applications", "documents", "messages", "assignments"]),
  FINANCE: permissions(["dashboard", "students", "b2b", "finance", "reports", "messages", "assignments"]),
  TEST_BOOKING: permissions(["dashboard", "students", "classes", "mocks", "messages", "assignments"]),
};

export interface StaffProfile {
  id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  job_title: string;
  is_active: boolean;
  branch: string;
  phone?: string;
  department: string;
  avatarBg?: string;
  desktop_modules?: Array<keyof RolePermissions> | null;
  assigned_responsibilities?: string;
  access_mode?: "ROLE_PLUS" | "EXACT";
  inactivity_minutes?: number;
}

interface AuthContextValue {
  session: Session | null;
  profile: StaffProfile | null;
  permissions: RolePermissions;
  effectivePermissions: string[];
  hasPermission: (permission: string) => boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<StaffProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const NO_PERMISSIONS = permissions([]);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [effectivePermissions, setEffectivePermissions] = useState<string[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let mounted = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error("Unable to restore staff session", error);
      setSession(data.session);
      setLoading(Boolean(data.session));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) { setProfile(null); setEffectivePermissions([]); }
      setLoading(Boolean(nextSession));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !isSupabaseConfigured) return;

    let mounted = true;
    void supabase
      .from("staff_profiles")
      .select("id,full_name,email,role,is_active,job_title,branch,phone,department,avatar_bg")
      .eq("id", session.user.id)
      .single()
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (error || !data?.is_active) {
          setProfile(null);
          await supabase.auth.signOut();
        } else {
          // Access customization was added after the core identity schema. Keep
          // sign-in compatible while that migration is being rolled out.
          const [{ data: access }, { data: effective }] = await Promise.all([
            supabase.from("staff_profiles").select("desktop_modules,assigned_responsibilities,access_mode,inactivity_minutes").eq("id", session.user.id).maybeSingle(),
            supabase.rpc("my_effective_permissions"),
          ]);
          setEffectivePermissions((effective ?? []).map((item: { permission_name: string }) => item.permission_name));
          setProfile({ ...data, ...(access ?? {}), avatarBg: data.avatar_bg ?? undefined } as StaffProfile);
        }
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [session]);

  useEffect(() => {
    if (!profile || !session) return;
    const timeout = Math.max(5, profile.inactivity_minutes ?? 30) * 60_000;
    let timer = window.setTimeout(() => void supabase.auth.signOut(), timeout);
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(() => void supabase.auth.signOut(), timeout); };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll"];
    events.forEach(event => window.addEventListener(event, reset, { passive: true }));
    return () => { window.clearTimeout(timer); events.forEach(event => window.removeEventListener(event, reset)); };
  }, [profile, session]);

  const rolePermissions = useMemo(
    () => profile
      ? (profile.desktop_modules ? permissions(profile.desktop_modules) : (ROLE_PERMISSIONS[profile.role] || NO_PERMISSIONS))
      : NO_PERMISSIONS,
    [profile]
  );

  const value = useMemo<AuthContextValue>(() => ({
    session,
    profile,
    permissions: rolePermissions,
    effectivePermissions,
    hasPermission: (permission: string) => effectivePermissions.includes(permission),
    loading,
    signIn: async (email: string, password: string) => {
      if (!isSupabaseConfigured) {
        throw new Error("Authentication is not configured. Add the Supabase URL and publishable key to the environment.");
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error || !data.session) throw new Error("Invalid staff email or password.");
      setSession(data.session);
      setLoading(true);
    },
    signOut: async () => {
      if (isSupabaseConfigured) await supabase.auth.signOut();
      setProfile(null);
      setSession(null);
      setEffectivePermissions([]);
    },
    updateProfile: async updates => {
      if (!profile) throw new Error("No authenticated staff profile.");
      const payload = {
        ...(updates.full_name !== undefined ? { full_name: updates.full_name } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
        ...(updates.avatarBg !== undefined ? { avatar_bg: updates.avatarBg } : {}),
      };
      const { error } = await supabase.rpc("update_my_staff_profile", { profile_updates: payload });
      if (error) throw error;
      setProfile(current => current ? { ...current, ...updates } : current);
    },
  }), [session, profile, rolePermissions, effectivePermissions, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be inside AuthProvider");
  return context;
}
