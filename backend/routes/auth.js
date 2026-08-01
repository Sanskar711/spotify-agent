import express from "express";
import { getAuthUrl, exchangeCode, getProfile } from "../lib/spotify.js";
import { supabase } from "../lib/supabase.js";
import { encrypt } from "../lib/crypto.js";
import { signSession, signState, verifyState, requireAuth } from "../middleware/auth.js";

const router = express.Router();

// FRONTEND_URL may hold a comma-separated allowlist for CORS; redirects need one origin.
function frontendBase() {
  return (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");
}

function failRedirect(res, code, detail) {
  const params = new URLSearchParams({ error: code });
  // Opt-in: surfaces the underlying message in the UI instead of a generic string.
  if (detail && process.env.DEBUG_AUTH_ERRORS === "true") {
    params.set("detail", String(detail).slice(0, 300));
  }
  return res.redirect(`${frontendBase()}/login?${params.toString()}`);
}

router.get("/login", (req, res) => {
  const missing = ["CLIENT_ID", "CLIENT_SECRET", "REDIRECT_URI", "JWT_SECRET"].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.error(`[auth] Cannot start OAuth — missing env: ${missing.join(", ")}`);
    return res.status(500).json({ error: `Server misconfigured: missing ${missing.join(", ")}` });
  }
  res.json({ url: getAuthUrl(signState()) });
});

router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;

  // Spotify's own rejections (user denied, app not allowlisted for this account, …).
  if (error) return failRedirect(res, `spotify_${error}`, error);
  if (!state || !verifyState(state)) return failRedirect(res, "state_mismatch");
  if (!code) return failRedirect(res, "no_code");

  // Tracks which stage blew up so the UI can say something actionable.
  let step = "token_exchange";
  try {
    const tok = await exchangeCode(code);

    step = "profile";
    const profile = await getProfile(tok.access_token);

    step = "db";
    const expiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();

    // Account creation / update — one row per Spotify user.
    const { data: user, error: dbErr } = await supabase
      .from("users")
      .upsert(
        {
          spotify_id: profile.id,
          email: profile.email,
          display_name: profile.display_name,
          avatar_url: profile.images?.[0]?.url || null,
          country: profile.country || null,
          product: profile.product || null,
          spotify_access_token: encrypt(tok.access_token),
          spotify_refresh_token: encrypt(tok.refresh_token),
          spotify_token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "spotify_id" }
      )
      .select()
      .single();

    if (dbErr) throw new Error(dbErr.message || JSON.stringify(dbErr));
    if (!user) throw new Error("Upsert returned no row");

    step = "session";
    const session = signSession(user.id);
    res.redirect(`${frontendBase()}/app?session=${session}`);
  } catch (e) {
    const detail = e?.message || String(e);
    console.error(`[auth] OAuth callback failed at step "${step}": ${detail}`);
    if (step === "db") {
      console.error(
        "[auth] Hint: check SUPABASE_URL (bare project URL, no /rest/v1), " +
          "SUPABASE_SERVICE_ROLE_KEY, and that the project is running and has the schema applied."
      );
    }
    failRedirect(res, `auth_failed_${step}`, detail);
  }
});

router.get("/me", requireAuth, (req, res) => {
  const u = req.user;
  res.json({
    id: u.id,
    spotifyId: u.spotify_id,
    email: u.email,
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
    product: u.product,
  });
});

router.post("/logout", requireAuth, (req, res) => {
  // Stateless JWT — client discards the token. (Hook here if you add a denylist.)
  res.json({ ok: true });
});

export default router;
