# Backend — Spotify AI Agent API

Express (ESM) API handling Spotify OAuth, the ReAct agent loop, song recognition, and
per-user settings. Requires **Node 22+** (the Supabase client needs a modern WebSocket).

See the [root README](../README.md) for architecture, the env var reference, who is allowed
to log in with Spotify, and login troubleshooting.

## Run

```bash
npm install
cp .env.example .env    # fill it in
npm start               # http://localhost:8000
```

On boot the server reports missing env vars and probes the database:

```
Server running on port 8000
[boot] Supabase reachable ✓
```

If it prints `[boot] Supabase UNREACHABLE — <reason>`, fix that before trying to log in —
an unreachable database otherwise surfaces to users as a generic "Spotify login failed" at
the very end of the OAuth round-trip.

## Layout

| Path | Purpose |
| --- | --- |
| `server.js` | App wiring, CORS allowlist, `/health`, boot preflight. |
| `agent.js` | ReAct loop: resolves the user's LLM config, drives tools, returns the reply. |
| `tools.js` | Spotify tools exposed to the agent. |
| `routes/auth.js` | `/auth/login`, `/auth/callback`, `/auth/me`, `/auth/logout`. |
| `routes/chat.js` | Chat turn endpoint + persisted history. |
| `routes/settings.js` | Provider/model/API-key CRUD; drives the BYOK gate. |
| `routes/recognize.js` | Multipart audio upload → AudD match. |
| `middleware/auth.js` | Session JWT verification + Spotify token refresh. |
| `lib/spotify.js` | OAuth + Web API wrappers. |
| `lib/llm.js` | Provider registry and a single `llmChat()` entry point. |
| `lib/supabase.js` | Service-role client, URL normalisation, `checkDatabase()`. |
| `lib/crypto.js` | AES-256-GCM encrypt/decrypt for tokens and API keys. |
| `lib/audd.js` | AudD recognition client. |
| `db/schema.sql` | Postgres schema — run it in the Supabase SQL editor. |

## Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | — | `200` with `{ok:true}`, or `503` plus the DB failure reason. |
| `GET` | `/auth/login` | — | `{ url }` to send the browser to Spotify. |
| `GET` | `/auth/callback` | — | Spotify's redirect target; redirects to the frontend with a session JWT, or with a step-specific `?error=`. |
| `GET` | `/auth/me` | Bearer | Current user's profile. |
| `POST` | `/auth/logout` | Bearer | No-op for the stateless JWT; the client discards it. |
| `GET` | `/settings/providers` | — | Selectable LLM providers. |
| `GET` | `/settings` | Bearer | `{provider, model, has_key, configured, server_fallback, needs_key}`. |
| `PUT` | `/settings` | Bearer | Save provider/model/API key. Returns `400 key_required` when the provider has neither a stored key nor a server fallback. |
| `GET` | `/chat/history` | Bearer | Last 200 messages. |
| `DELETE` | `/chat/history` | Bearer | Clear history. |
| `POST` | `/chat` | Bearer | `{query}` → `{response}`. |
| `POST` | `/recognize` | Bearer | Multipart field `audio` (≤10 MB) → matched track. |

## Agent tools

`getSongsByArtist`, `getSongsByGenre`, `getSongsByAlbum`, `searchTracks`,
`getRecommendations`, `addToQueue`, `createPlaylist`.

The agent emits exactly one JSON object per step (`plan` → `tool` → `output`), capped at 8
steps per turn. `addToQueue` needs an active Spotify device and a Premium account.

## LLM providers

Configured in `lib/llm.js`: `gemini`, `groq`, `claude`, `openai`. A user's own key
(encrypted in `user_settings`) wins; otherwise the matching server env key is used. If
neither exists, the agent replies asking the user to open Settings.

Only one key is stored per user, so it belongs to the provider it was saved under —
switching providers without supplying a new key clears it.

## Security notes

- The service-role key bypasses RLS and must never reach the browser. Tables have RLS
  enabled with no public policies, so all access goes through this API.
- Spotify tokens and user API keys are encrypted at rest with `ENCRYPTION_KEY`. Rotating
  that value invalidates every stored secret.
- OAuth CSRF protection uses a signed 10-minute `state` JWT rather than server-side state.
- `DEBUG_AUTH_ERRORS=true` echoes internal error messages to the login page — handy while
  setting things up, best left off in production.
