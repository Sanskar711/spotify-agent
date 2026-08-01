// Agent brain: provider-agnostic ReAct loop driving Spotify tools.

import { tools } from "./tools.js";
import { llmChat, defaultModelFor, envKeyFor } from "./lib/llm.js";
import { supabase } from "./lib/supabase.js";
import { decrypt } from "./lib/crypto.js";

export const SYSTEM_PROMPT = `
You are a friendly, tasteful Spotify music assistant. You help users discover songs
(by artist, genre, album, keyword, or vibe), recognize songs, build queues and playlists.

You operate as a ReAct agent. On EVERY turn output exactly ONE JSON object, nothing else —
no markdown, no code fences, no prose outside the JSON.

Allowed JSON shapes:
- {"type":"plan","message":"<short reasoning about the next tool>"}
- {"type":"tool","name":"<toolName>","args":{ ... }}
- {"type":"output","message":"<final answer to the user>"}

Available tools:
- getSongsByArtist(artist, limit)          -> top tracks for an artist
- getSongsByGenre(genre, limit)            -> tracks in a genre
- getSongsByAlbum(album, limit)            -> tracks from an album
- searchTracks(query, limit)               -> free-text / keyword search
- getRecommendations(seedArtists[], seedGenres[], seedTracks[], limit) -> personalized suggestions (PREFER this for "recommend / similar / vibe" requests)
- addToQueue(songId)                        -> add a track to the active queue (songId is the plain Spotify track id)
- createPlaylist(name, trackIds[], description) -> create a private playlist

Flow: for any request, first emit a {"plan"}, then a {"tool"}, read the observation the
system returns, then either call another tool or emit the final {"output"}.

Rules:
- Use recommendations for taste-based / "songs like X" / "for a rainy night" style asks.
- After showing results, list each as "Title — Artist: <url>" and ask if they want any
  added to their queue or saved to a playlist.
- Keep outputs concise and skimmable. Be warm, not robotic.
- If a tool returns an error, explain it plainly and suggest a fix.
- Never invent track URLs or ids — only use ones returned by tools.
`;

async function getUserLLMConfig(userId) {
  const { data } = await supabase
    .from("user_settings")
    .select("provider, model, api_key_enc")
    .eq("user_id", userId)
    .maybeSingle();

  const provider = data?.provider || process.env.DEFAULT_LLM_PROVIDER || "gemini";
  let apiKey = null;
  try {
    apiKey = data?.api_key_enc ? decrypt(data.api_key_enc) : null;
  } catch {
    apiKey = null;
  }
  if (!apiKey) apiKey = envKeyFor(provider);
  const model = data?.model || defaultModelFor(provider);
  return { provider, model, apiKey };
}

function parseAction(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Best-effort: grab the first {...} block.
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

const MAX_STEPS = 8;

// Runs one user turn end-to-end, returns the assistant's final text.
export async function runChatTurn({ query, history = [], user, spotifyToken }) {
  const { provider, model, apiKey } = await getUserLLMConfig(user.id);
  if (!apiKey) {
    return `I don't have an AI model configured yet. Open Settings and either pick "${provider}" with your own API key, or choose a free provider (Gemini / Groq).`;
  }

  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  messages.push({ role: "user", content: query });

  const ctx = { spotifyToken, user };

  for (let step = 0; step < MAX_STEPS; step++) {
    let text;
    try {
      text = await llmChat({ provider, apiKey, model, system: SYSTEM_PROMPT, messages });
    } catch (e) {
      return `AI model error (${provider}): ${e.message}. Check your API key in Settings.`;
    }

    const action = parseAction(text);
    if (!action) {
      messages.push({ role: "user", content: "Your last reply was not valid JSON. Reply with exactly one JSON object." });
      continue;
    }
    messages.push({ role: "assistant", content: JSON.stringify(action) });

    if (action.type === "output") {
      return action.message;
    }

    if (action.type === "plan") {
      messages.push({ role: "user", content: JSON.stringify({ type: "system", note: "continue" }) });
      continue;
    }

    if (action.type === "tool") {
      const fn = tools[action.name];
      if (!fn) {
        messages.push({ role: "user", content: JSON.stringify({ type: "observation", error: `Unknown tool ${action.name}` }) });
        continue;
      }
      let observation;
      try {
        observation = await fn(action.args || {}, ctx);
      } catch (e) {
        observation = { error: e.message };
      }
      messages.push({
        role: "user",
        content: JSON.stringify({ type: "observation", result: observation }),
      });
      continue;
    }

    // Unknown type — nudge.
    messages.push({ role: "user", content: "Unknown action type. Use plan | tool | output." });
  }

  return "I couldn't complete that in time — try rephrasing or narrowing the request.";
}
