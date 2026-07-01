import jwt from "jsonwebtoken";
import { supabase } from "../lib/supabase.js";
import { refreshAccessToken } from "../lib/spotify.js";
import { encrypt, decrypt } from "../lib/crypto.js";

export function signSession(userId) {
  return jwt.sign({ uid: userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

// Short-lived signed OAuth state (stateless CSRF protection).
export function signState() {
  return jwt.sign({ n: Math.random().toString(36).slice(2) }, process.env.JWT_SECRET, {
    expiresIn: "10m",
  });
}
export function verifyState(state) {
  try {
    jwt.verify(state, process.env.JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

// Ensures a valid (non-expired) Spotify access token, refreshing + persisting if needed.
async function ensureSpotifyToken(user) {
  const now = Date.now();
  const expMs = user.spotify_token_expires_at
    ? new Date(user.spotify_token_expires_at).getTime()
    : 0;

  if (expMs - 60_000 > now && user.spotify_access_token) {
    return decrypt(user.spotify_access_token);
  }

  const refresh = decrypt(user.spotify_refresh_token);
  const refreshed = await refreshAccessToken(refresh);
  const expiresAt = new Date(now + refreshed.expires_in * 1000).toISOString();

  const update = {
    spotify_access_token: encrypt(refreshed.access_token),
    spotify_token_expires_at: expiresAt,
  };
  if (refreshed.refresh_token) update.spotify_refresh_token = encrypt(refreshed.refresh_token);
  await supabase.from("users").update(update).eq("id", user.id);

  return refreshed.access_token;
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No session token" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", payload.uid)
    .single();
  if (error || !user) return res.status(401).json({ error: "User not found" });

  try {
    req.spotifyToken = await ensureSpotifyToken(user);
  } catch (e) {
    return res.status(401).json({ error: "Spotify session expired — please log in again." });
  }
  req.user = user;
  next();
}
