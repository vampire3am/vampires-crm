export function signInError(error: { code?: string; status?: number; message?: string }): string {
  if (error.code === "invalid_credentials") return "Invalid staff email or password.";
  if (error.code === "email_not_confirmed") return "Your email is not confirmed. Contact your administrator to activate your account.";
  if (error.status === 429) return "Too many sign-in attempts. Please wait a few minutes and try again.";
  if (error.code === "user_banned") return "Your account is disabled. Contact your administrator.";
  if (error.status === 401 || error.status === 403) return "The authentication service rejected this request. Contact your administrator to check the CRM connection.";
  return "Unable to reach the authentication service. Check your connection and try again.";
}

export function staffAccessError(error: { code?: string; message?: string }, resource: "profile" | "permissions"): string {
  const reference = error.code ? ` (Code: ${error.code})` : "";
  if (error.code === "42P17") return `The staff access policy has a database recursion error. Your administrator must repair the staff access policies.${reference}`;
  if (["42P01", "PGRST205", "PGRST202", "42703"].includes(error.code ?? "")) {
    return `The CRM database is missing a required ${resource} table, field, or function. Your administrator must apply the matching database migrations.${reference}`;
  }
  if (error.code === "42501") return `The database denied access to your staff ${resource}. Your administrator must check the database grants and access policies.${reference}`;
  if (error.code === "PGRST301" || error.code === "PGRST303") {
    if (/issued at future|not yet valid/i.test(error.message ?? "")) return `The database considers your session not yet valid. Its clock may be out of sync with the sign-in service. Retry shortly; if this persists, your administrator must check the hosted authentication service.${reference}`;
    if (/expired/i.test(error.message ?? "")) return `Your session expired and could not be renewed. Choose Use another account and sign in again.${reference}`;
    return `Your session was rejected by the database even after recovery. Choose Use another account and sign in again; if this repeats, your administrator must check the project's JWT configuration.${reference}`;
  }
  return `You signed in, but your staff ${resource} could not be loaded. Please retry or contact your administrator.${reference}`;
}

// Only for the read-only staff bootstrap queries. Never replay mutations.
export async function recoverStaffRead<T extends { error: { code?: string; message?: string } | null }>(
  read: () => PromiseLike<T>,
  refresh: () => Promise<void>,
  isCurrent: () => boolean,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T> {
  const run = () => {
    if (!isCurrent()) throw new Error("Account changed while loading staff access.");
    return withAuthTimeout(read(), "Loading your staff access timed out. Please retry.");
  };
  let result = await run();
  if (!['PGRST301', 'PGRST303'].includes(result.error?.code ?? '')) return result;
  if (/issued at future|not yet valid/i.test(result.error?.message ?? '')) {
    // Keep the existing token: continuously refreshing an issued-in-the-future
    // token can perpetuate a server-clock discrepancy. The hosted services have
    // previously drifted by almost a minute, so tolerate up to 90 seconds while
    // keeping the UI in its protected loading state.
    for (const delay of [1000, 2000, 4000, 8000, 15000, 30000, 30000]) {
      await wait(delay);
      result = await run();
      if (!['PGRST301', 'PGRST303'].includes(result.error?.code ?? '') ||
          !/issued at future|not yet valid/i.test(result.error?.message ?? '')) return result;
    }
    return result;
  }
  if (!isCurrent()) throw new Error("Account changed while loading staff access.");
  await withAuthTimeout(refresh(), "Renewing your session timed out. Please retry.");
  return run();
}

export async function withAuthTimeout<T>(request: PromiseLike<T>, message: string, timeoutMs = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
