// Shazam-like audio recognition via AudD (https://audd.io).
// Accepts a short audio clip buffer, returns the matched track (with Spotify link when available).

export async function recognizeAudio(buffer, filename = "clip.webm") {
  const token = process.env.AUDD_API_TOKEN;
  if (!token) throw new Error("AUDD_API_TOKEN is not set");

  const form = new FormData();
  form.append("api_token", token);
  form.append("return", "spotify,apple_music");
  form.append("file", new Blob([buffer]), filename);

  const res = await fetch("https://api.audd.io/", { method: "POST", body: form });
  if (!res.ok) throw new Error(`AudD error ${res.status}: ${await res.text()}`);
  const data = await res.json();

  if (data.status !== "success" || !data.result) {
    return { found: false };
  }
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
