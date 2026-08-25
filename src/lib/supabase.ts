import { createClient } from "@supabase/supabase-js";

// The publishable key is intentionally safe for browser use. Keeping the AECS
// project as the production fallback prevents a Vercel build from silently
// shipping a disconnected login page when its build-time env is missing.
const productionUrl = "https://igzrcgicslcgbowzrtzz.supabase.co";
const productionPublishableKey = "sb_publishable_lPKVBwVDgvO_uf8nlSSUsA_FqOAC1Yg";

const url = (import.meta.env.VITE_SUPABASE_URL || productionUrl) as string;
const key = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  productionPublishableKey
) as string;
export const isSupabaseConfigured = Boolean(url && key);

const mutationRpc = /^(create|update|delete|register|review|mark|send|toggle|add|schedule|complete|convert|clock|invite|upload|remove|save|assign|approve|reject|record|submit|cancel|restore|archive|set)_/i;
const humanize = (value: string) => value.replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());

const crmFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (!response.ok || typeof window === "undefined") return response;
  const requestUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const parsed = new URL(requestUrl, window.location.origin);
  const rpcName = parsed.pathname.match(/\/rest\/v1\/rpc\/([^/?]+)/)?.[1] ?? "";
  const tableName = parsed.pathname.match(/\/rest\/v1\/([^/?]+)/)?.[1] ?? "";
  const isTableMutation = Boolean(tableName && tableName !== "rpc" && method !== "GET" && method !== "HEAD");
  // Read-state synchronization is an automatic background operation, not a
  // user-facing completed task. Never generate success toasts for it.
  const isRpcMutation = Boolean(rpcName && rpcName !== "mark_all_messages_read" && mutationRpc.test(rpcName));
  const isStorageMutation = /\/storage\/v1\/object\/(?!sign\/)/.test(parsed.pathname) && ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const isFunctionMutation = /\/functions\/v1\//.test(parsed.pathname) && method === "POST";
  if (!(isTableMutation || isRpcMutation || isStorageMutation || isFunctionMutation)) return response;

  const completedAt = Date.now();
  const action = rpcName
    ? humanize(rpcName)
    : isStorageMutation
      ? method === "DELETE" ? "File Removed" : "File Uploaded"
      : isFunctionMutation
        ? "Request Completed"
        : `${method === "DELETE" ? "Deleted" : method === "POST" ? "Created" : "Updated"} ${humanize(tableName)}`;
  window.setTimeout(() => {
    const state = window as Window & { __aecsLastSuccessAt?: number };
    if ((state.__aecsLastSuccessAt ?? 0) > completedAt) return;
    state.__aecsLastSuccessAt = Date.now();
    window.dispatchEvent(new CustomEvent("aecs:notice", { detail: { id: crypto.randomUUID(), tone: "success", title: `${action} successfully` } }));
  }, 900);
  return response;
};

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { fetch: crmFetch },
});
