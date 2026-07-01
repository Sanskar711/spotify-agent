import express from "express";
import { getAuthUrl, exchangeCode, getProfile } from "../lib/spotify.js";
import { supabase } from "../lib/supabase.js";
import { encrypt } from "../lib/crypto.js";
import { signSession, signState, verifyState, requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/login", (req, res) => {
  res.json({ url: getAuthUrl(signState()) });
});

router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const frontend = process.env.FRONTEND_URL;

  if (error) return res.redirect(`${frontend}/login?error=${encodeURIComponent(error)}`);
  if (!state || !verifyState(state)) return res.redirect(`${frontend}/login?error=state_mismatch`);
  if (!code) return res.redirect(`${frontend}/login?error=no_code`);

  try {
    const tok = await exchangeCode(code);
    const profile = await getProfile(tok.access_token);
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

    if (dbErr) throw dbErr;

    const session = signSession(user.id);
    res.redirect(`${frontend}/app?session=${session}`);
  } catch (e) {
    console.error("OAuth callback error:", e);
    res.redirect(`${frontend}/login?error=auth_failed`);
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
