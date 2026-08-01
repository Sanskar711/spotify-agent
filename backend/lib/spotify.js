// Spotify OAuth (Authorization Code flow, confidential client) + thin API wrappers.

const ACCOUNTS = "https://accounts.spotify.com";
const API = "https://api.spotify.com/v1";

export const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-modify-public",
  "playlist-modify-private",
].join(" ");

export function getAuthUrl(state) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.CLIENT_ID,
    scope: SPOTIFY_SCOPES,
    redirect_uri: process.env.REDIRECT_URI,
    state,
  });
  return `${ACCOUNTS}/authorize?${params.toString()}`;
}

async function tokenRequest(body) {
  const auth =
    "Basic " +
    Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: auth,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Spotify token error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export function exchangeCode(code) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.REDIRECT_URI,
    })
  );
}

export function refreshAccessToken(refreshToken) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
}

export async function getProfile(accessToken) {
  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    // 403 here is how Spotify reports "app is in Development mode and this account
    // isn't on the allowlist" — consent and the token exchange both succeed first.
    const err = new Error(`Spotify profile error ${res.status}: ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Generic authenticated call against the Spotify Web API.
export async function spotifyFetch(accessToken, path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(opts.headers || {}),
    },
  });
  return res;
}

// Compact track shape passed back to the LLM (keeps context small + reliable).
export function simplifyTrack(t) {
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    artists: (t.artists || []).map((a) => a.name).join(", "),
    album: t.album?.name,
    url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
  };
}
