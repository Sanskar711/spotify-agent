import { createClient } from "@supabase/supabase-js";

// supabase-js appends "/rest/v1/..." itself, so SUPABASE_URL must be the bare
// project URL. Pasting the REST endpoint from the dashboard instead is a common
// slip and produces a silent 404 on every query — normalise it here.
export function normalizeSupabaseUrl(raw) {
  if (!raw) return null;
  return String(raw)
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "")
    .replace(/\/+$/, "");
}

const rawUrl = process.env.SUPABASE_URL;
const url = normalizeSupabaseUrl(rawUrl);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — every DB call will fail."
  );
} else if (url !== String(rawUrl).trim().replace(/\/+$/, "")) {
  console.warn(
    `[supabase] SUPABASE_URL normalised to ${url} — drop the "/rest/v1" suffix in your env file.`
  );
}

// Service-role client — server side only. Never expose this key to the browser.
export const supabase = createClient(url || "http://localhost", key || "anon", {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Boot-time reachability probe. A dead/paused project or a bad URL otherwise only
// shows up as a generic "login failed" halfway through the OAuth callback.
export async function checkDatabase() {
  if (!url || !key) {
    return { ok: false, reason: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set" };
  }
  const { error } = await supabase.from("users").select("id", { head: true, count: "exact" });
  if (error) return { ok: false, reason: error.message || String(error) };
  return { ok: true };
}
