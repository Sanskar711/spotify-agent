// Agent tools. Each tool: async (args, ctx) => result
// ctx = { spotifyToken, user }

import { spotifyFetch, simplifyTrack } from "./lib/spotify.js";

async function search(token, q, type, limit = 8) {
  const res = await spotifyFetch(
    token,
    `/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Spotify search failed ${res.status}`);
  return res.json();
}

export const getSongsByArtist = async ({ artist, limit = 5 }, { spotifyToken }) => {
  const data = await search(spotifyToken, artist, "artist", 1);
  const found = data.artists?.items?.[0];
  if (!found) return { error: "Artist not found" };
  const res = await spotifyFetch(spotifyToken, `/artists/${found.id}/top-tracks?market=from_token`);
  const tracks = (await res.json()).tracks || [];
  return { artist: found.name, tracks: tracks.slice(0, limit).map(simplifyTrack) };
};

export const getSongsByGenre = async ({ genre, limit = 8 }, { spotifyToken }) => {
  const data = await search(spotifyToken, `genre:"${genre}"`, "track", limit);
  return { genre, tracks: (data.tracks?.items || []).map(simplifyTrack) };
};

export const getSongsByAlbum = async ({ album, limit = 10 }, { spotifyToken }) => {
  const data = await search(spotifyToken, album, "album", 1);
  const found = data.albums?.items?.[0];
  if (!found) return { error: "Album not found" };
  const res = await spotifyFetch(spotifyToken, `/albums/${found.id}/tracks?limit=${limit}`);
  const items = (await res.json()).items || [];
  return {
    album: found.name,
    tracks: items.map((t) => ({
      id: t.id,
      name: t.name,
      artists: (t.artists || []).map((a) => a.name).join(", "),
      url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
    })),
  };
};

// General keyword / free-text / "lyrics-ish" search.
export const searchTracks = async ({ query, limit = 8 }, { spotifyToken }) => {
  const data = await search(spotifyToken, query, "track", limit);
  return { query, tracks: (data.tracks?.items || []).map(simplifyTrack) };
};

// Better suggestions: Spotify recommendations engine seeded by artists/genres/tracks.
export const getRecommendations = async (
  { seedArtists = [], seedGenres = [], seedTracks = [], limit = 10 },
  { spotifyToken }
) => {
  const artistIds = [];
  for (const name of seedArtists.slice(0, 2)) {
    const d = await search(spotifyToken, name, "artist", 1);
    const id = d.artists?.items?.[0]?.id;
    if (id) artistIds.push(id);
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (artistIds.length) params.set("seed_artists", artistIds.join(","));
  if (seedGenres.length) params.set("seed_genres", seedGenres.slice(0, 3).join(","));
  if (seedTracks.length) params.set("seed_tracks", seedTracks.slice(0, 2).join(","));
  if (!artistIds.length && !seedGenres.length && !seedTracks.length) {
    return { error: "Provide at least one of seedArtists, seedGenres, seedTracks" };
  }
  const res = await spotifyFetch(spotifyToken, `/recommendations?${params.toString()}`);
  if (!res.ok) throw new Error(`Recommendations failed ${res.status}`);
  const tracks = (await res.json()).tracks || [];
  return { tracks: tracks.map(simplifyTrack) };
};

export const addToQueue = async ({ songId }, { spotifyToken }) => {
  let id = songId;
  if (id?.startsWith("spotify:track:")) id = id.split("spotify:track:")[1];
  if (id?.startsWith("http")) id = id.split("/track/")[1]?.split("?")[0] || id;
  const res = await spotifyFetch(
    spotifyToken,
    `/me/player/queue?uri=${encodeURIComponent(`spotify:track:${id}`)}`,
    { method: "POST" }
  );
  if (res.status === 204 || res.status === 200) return { success: true };
  const err = await res.json().catch(() => ({}));
  if (res.status === 404) return { error: "No active Spotify device. Open Spotify and play something first." };
  return { error: err.error?.message || `Failed to queue (${res.status})` };
};

export const createPlaylist = async ({ name, trackIds = [], description = "" }, { spotifyToken, user }) => {
  const create = await spotifyFetch(spotifyToken, `/users/${user.spotify_id}/playlists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, public: false }),
  });
  if (!create.ok) throw new Error(`Playlist create failed ${create.status}`);
  const playlist = await create.json();
  const uris = trackIds
    .map((t) => (t.startsWith("spotify:track:") ? t : `spotify:track:${t}`))
    .slice(0, 100);
  if (uris.length) {
    await spotifyFetch(spotifyToken, `/playlists/${playlist.id}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris }),
    });
  }
  return { success: true, name: playlist.name, url: playlist.external_urls?.spotify, added: uris.length };
};

export const tools = {
  getSongsByArtist,
  getSongsByGenre,
  getSongsByAlbum,
  searchTracks,
  getRecommendations,
  addToQueue,
  createPlaylist,
};
