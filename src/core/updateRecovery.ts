const RECOVERY_KEY = "aecs-stale-build-recovery";
const RECOVERY_WINDOW_MS = 60_000;

export function isStaleBuildError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .+ failed|ChunkLoadError/i.test(message);
}

function cacheBustedUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("crm-refresh", Date.now().toString(36));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function forceWorkspaceRefresh() {
  try { window.sessionStorage.removeItem(RECOVERY_KEY); } catch { /* Storage can be unavailable in locked-down browsers. */ }
  window.location.replace(cacheBustedUrl());
}

export function recoverFromStaleBuild(error: unknown) {
  if (!isStaleBuildError(error)) return false;

  const signature = error instanceof Error ? error.message : String(error ?? "stale-build");
  try {
    const previous = JSON.parse(window.sessionStorage.getItem(RECOVERY_KEY) || "null") as { signature?: string; at?: number } | null;
    if (previous?.signature === signature && Date.now() - (previous.at ?? 0) < RECOVERY_WINDOW_MS) return false;
    window.sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ signature, at: Date.now() }));
  } catch {
    // The cache-busting URL still makes recovery work when storage is blocked.
  }

  window.location.replace(cacheBustedUrl());
  return true;
}

export function installStaleBuildRecovery() {
  window.addEventListener("vite:preloadError", event => {
    const preloadEvent = event as Event & { payload?: unknown };
    if (recoverFromStaleBuild(preloadEvent.payload)) event.preventDefault();
  });
}
