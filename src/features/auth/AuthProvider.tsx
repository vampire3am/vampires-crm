import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { recoverStaffRead, signInError, staffAccessError, withAuthTimeout } from "./authErrors";
import { readMfaState, verifyMfaFactor, type MfaFactor } from "./mfaService";

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
  todos: boolean;
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
  todos: false,
};

const ALL_PERMISSIONS = Object.keys(ROLE_PERMISSION_KEYS) as Array<keyof RolePermissions>;

export const ROLE_PERMISSIONS: Record<StaffRole, RolePermissions> = {
  ADMIN: permissions(["dashboard", "leads", "students", "counselling", "applications", "b2b", "classes", "mocks", "documents", "finance", "reports", "hrms", "settings", "messages", "assignments", "todos"]),
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
  authError: string;
  mfaStatus: "checking" | "not_enrolled" | "required" | "verified";
  mfaFactors: MfaFactor[];
  mfaRequired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  verifyMfa: (code: string, factorId?: string) => Promise<void>;
  refreshMfa: () => Promise<void>;
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
  const [authError, setAuthError] = useState("");
  const [mfaStatus, setMfaStatus] = useState<AuthContextValue["mfaStatus"]>("checking");
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const activeUserId = useRef<string | null>(null);
  const sessionUserId = session?.user.id;

  const refreshMfa = useCallback(async () => {
    const userId = activeUserId.current;
    if (!userId) {
      setMfaFactors([]);
      setMfaStatus("checking");
      return;
    }
    const state = await readMfaState();
    if (activeUserId.current !== userId) return;
    setMfaFactors(state.factors);
    setMfaStatus(state.requiresChallenge ? "required" : state.factors.length ? "verified" : "not_enrolled");
    if (state.requiresChallenge) setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let mounted = true;
    let receivedAuthEvent = false;
    void withAuthTimeout(supabase.auth.getSession(), "Restoring your session timed out. Please reload and try again.").then(({ data, error }) => {
      if (!mounted || receivedAuthEvent) return;
      if (error) throw error;
      activeUserId.current = data.session?.user.id ?? null;
      setSession(data.session);
      setLoading(Boolean(data.session));
    }).catch(() => {
      if (!mounted || receivedAuthEvent) return;
      setAuthError("Unable to restore your session. Please reload and try again.");
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      receivedAuthEvent = true;
      const nextUserId = nextSession?.user.id ?? null;
      const identityChanged = activeUserId.current !== nextUserId;
      activeUserId.current = nextUserId;
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setEffectivePermissions([]);
        setMfaFactors([]);
        setMfaStatus("checking");
        setLoading(false);
      } else if (identityChanged) {
        setProfile(null);
        setEffectivePermissions([]);
        setAuthError("");
        setMfaFactors([]);
        setMfaStatus("checking");
        // Only a real account change should block the workspace. Supabase can
        // emit SIGNED_IN/TOKEN_REFRESHED again when a background tab regains
        // focus; treating those events as a fresh login caused a full-page
        // "Connecting securely" refresh every time the user returned.
        setLoading(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionUserId || !isSupabaseConfigured) return;
    let mounted = true;
    void readMfaState().then(state => {
      if (!mounted || activeUserId.current !== sessionUserId) return;
      setMfaFactors(state.factors);
      setMfaStatus(state.requiresChallenge ? "required" : state.factors.length ? "verified" : "not_enrolled");
      if (state.requiresChallenge) setLoading(false);
    }).catch((error: unknown) => {
      if (!mounted || activeUserId.current !== sessionUserId) return;
      setAuthError(error instanceof Error ? error.message : "Unable to verify two-factor authentication.");
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [sessionUserId]);

  useEffect(() => {
    if (!sessionUserId || !isSupabaseConfigured || mfaStatus === "checking" || mfaStatus === "required") return;

    let mounted = true;
    const isCurrent = () => mounted && activeUserId.current === sessionUserId;
    const refresh = async () => {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) throw new Error("Your session could not be renewed. Choose Use another account and sign in again.");
      if (data.session.user.id !== sessionUserId) throw new Error("Account changed while renewing your session.");
    };
    void recoverStaffRead(() => supabase
      .from("staff_profiles")
      .select("*")
      .eq("id", sessionUserId)
      .maybeSingle(), refresh, isCurrent)
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (error) throw new Error(staffAccessError(error, "profile"));
        if (!data) throw new Error("You signed in, but no staff profile is available for your account. Contact your administrator to link your staff account.");
        if (!data?.is_active) throw new Error("Your staff account is inactive. Contact your administrator to restore access.");
        const { data: effective, error: permissionError } = await recoverStaffRead(
          () => supabase.rpc("my_effective_permissions"), refresh, isCurrent,
        );
        if (!mounted) return;
        if (permissionError) throw new Error(staffAccessError(permissionError, "permissions"));
        setEffectivePermissions((effective ?? []).map((item: { permission_name: string }) => item.permission_name));
        setProfile({ ...data, avatarBg: data.avatar_bg ?? undefined } as StaffProfile);
        setAuthError("");
      }).catch((error: unknown) => {
        if (!mounted) return;
        setProfile(null);
        setEffectivePermissions([]);
        setAuthError(error instanceof Error ? error.message : "Unable to load your staff account. Please retry.");
      }).finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [sessionUserId, mfaStatus]);

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
    () => {
      if (!profile) return NO_PERMISSIONS;
      const resolved = profile.desktop_modules ? permissions(profile.desktop_modules) : { ...(ROLE_PERMISSIONS[profile.role] || NO_PERMISSIONS) };
      if (effectivePermissions.some(permission => /^(hr\.|attendance\.|breaks\.|break_types\.|leave\.|payroll\.|salary\.|performance\.)/.test(permission))) {
        resolved.hrms = true;
      }
      return resolved;
    },
    [profile, effectivePermissions]
  );

  const value = useMemo<AuthContextValue>(() => ({
    session,
    profile,
    permissions: rolePermissions,
    effectivePermissions,
    hasPermission: (permission: string) => effectivePermissions.includes(permission),
    loading,
    authError,
    mfaStatus,
    mfaFactors,
    mfaRequired: mfaStatus === "required",
    signIn: async (email: string, password: string) => {
      if (!isSupabaseConfigured) {
        throw new Error("Authentication is not configured. Add the Supabase URL and publishable key to the environment.");
      }
      setAuthError("");
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw new Error(signInError(error));
      if (!data.session) throw new Error("Sign-in did not return a session. Please try again.");
      // The auth event owns session transitions. Setting loading here again
      // can strand a same-user sign-in after its profile has already loaded.
    },
    verifyMfa: async (code: string, factorId?: string) => {
      const selected = factorId || mfaFactors[0]?.id;
      if (!selected) throw new Error("No verified authenticator is available for this account.");
      await verifyMfaFactor(selected, code);
      await refreshMfa();
    },
    refreshMfa,
    signOut: async () => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) { setAuthError("Unable to sign out. Please retry."); return; }
      }
      setProfile(null);
      setSession(null);
      setEffectivePermissions([]);
      setMfaFactors([]);
      setMfaStatus("checking");
      setAuthError("");
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
  }), [session, profile, rolePermissions, effectivePermissions, loading, authError, mfaStatus, mfaFactors, refreshMfa]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be inside AuthProvider");
  return context;
}
