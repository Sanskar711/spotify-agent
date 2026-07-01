import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn("[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — DB calls will fail.");
}

// Service-role client — server side only. Never expose this key to the browser.
export const supabase = createClient(url || "http://localhost", key || "anon", {
  auth: { persistSession: false, autoRefreshToken: false },
});
