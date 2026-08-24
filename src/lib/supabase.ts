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
export const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
