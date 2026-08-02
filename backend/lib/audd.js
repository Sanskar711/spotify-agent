// Shazam-like audio recognition via AudD (https://audd.io).
// Accepts a short audio clip buffer, returns the matched track (with Spotify link when available).

// Account-level failures (bad/inactive token, quota exhausted) rather than a bad clip.
const ACCOUNT_ERROR_CODES = new Set([900, 901]);

export async function recognizeAudio(buffer, filename = "clip.webm", mimeType = "audio/webm") {
  const token = process.env.AUDD_API_TOKEN;
  if (!token) {
    const err = new Error("AUDD_API_TOKEN is not set");
    err.configIssue = true;
    throw err;
  }

  const form = new FormData();
  form.append("api_token", token);
  form.append("return", "spotify,apple_music");
  form.append("file", new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch("https://api.audd.io/", { method: "POST", body: form });
  if (!res.ok) throw new Error(`AudD error ${res.status}: ${await res.text()}`);
  const data = await res.json();

  // AudD answers HTTP 200 for everything — failures only show up in the body, so an
  // expired token would otherwise be indistinguishable from "no match found".
  if (data.status === "error") {
    const code = data.error?.error_code;
    const err = new Error(`AudD error ${code}: ${data.error?.error_message || "unknown error"}`);
    err.code = code;
    err.configIssue = ACCOUNT_ERROR_CODES.has(code);
    throw err;
  }

  if (!data.result) return { found: false };

  const r = data.result;
  return {
    found: true,
    title: r.title,
    artist: r.artist,
    album: r.album,
    releaseDate: r.release_date,
    spotifyId: r.spotify?.id || null,
    spotifyUrl: r.spotify?.external_urls?.spotify || null,
    appleUrl: r.apple_music?.url || null,
  };
}
