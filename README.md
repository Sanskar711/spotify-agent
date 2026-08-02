# Spotify AI Agent

A conversational music assistant. Log in with Spotify, chat with an LLM agent that can
search, recommend, queue tracks and build playlists, and identify songs playing around
you from your microphone.

```
Browser ──> frontend (React + Vite)
                │  Authorization: Bearer <session JWT>
                ▼
          backend (Express) ──> Supabase (Postgres: users, settings, chat)
                │             └─> AudD (song recognition)
                ├─> Spotify Web API (OAuth + search + queue + playlists)
                └─> LLM provider (Gemini / Groq / Claude / OpenAI — the user's own key)
```

- **[`backend/`](backend/README.md)** — Express API, OAuth, ReAct agent loop, Spotify tools.
- **[`frontend/`](frontend/README.md)** — React SPA: chat UI, settings, mic capture.
- **[`DEPLOYMENT.md`](DEPLOYMENT.md)** — deploying to Render + Vercel.

## How auth works

1. `GET /auth/login` returns a Spotify authorize URL carrying a signed, 10-minute `state` JWT.
2. Spotify redirects to `GET /auth/callback`, which exchanges the code, reads the profile,
   and upserts a row in `users` (keyed on `spotify_id`).
3. The backend issues a 30-day **session JWT** and redirects to `<frontend>/app?session=…`.
   The SPA stores it in `localStorage` and sends it as `Authorization: Bearer`.
4. Spotify access/refresh tokens are encrypted (AES-256-GCM) at rest and auto-refreshed
   by `requireAuth` before each request.

## Who can log in with Spotify

A new Spotify app starts in **Development mode**, where only explicitly allowlisted
accounts can authorize — everyone else is rejected after they enter their password/OTP.

- **Allowed:** the app owner, plus up to **25** users added by name + Spotify account
  email under [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) →
  your app → **Settings** → **User Management**.
- **To add someone:** enter their full name and the email on their Spotify account
  (it must match exactly), then save. They can log in immediately — no redeploy needed.
- **To open it to everyone:** in the dashboard, request **Extended Quota Mode**. Approval
  is manual by Spotify and takes a few weeks; the app needs a public privacy policy and a
  description of how it uses the data.

Scopes requested (see `backend/lib/spotify.js`): `user-read-private`, `user-read-email`,
`user-read-playback-state`, `user-modify-playback-state`, `playlist-modify-public`,
`playlist-modify-private`. Changing this list forces existing users to re-consent.

## Bring your own key (BYOK)

After the first Spotify login the app blocks the chat box until an AI model is connected.
`GET /settings` reports `configured` (has the user ever completed the step) and `needs_key`
(no personal key **and** no server-side fallback key for the chosen provider). The frontend
shows a non-dismissable setup modal while either is true.

Keys are stored per user, encrypted with `ENCRYPTION_KEY`. Free options: **Gemini**
(aistudio.google.com) and **Groq** (console.groq.com). Setting `GEMINI_API_KEY` /
`GROQ_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` on the server makes that provider
usable without a personal key, and the setup step becomes skippable.

## Local setup

Requires **Node 22+**.

```bash
# 1. Database
#    Create a project at supabase.com, then run backend/db/schema.sql in the SQL editor.

# 2. Backend
cd backend
npm install
cp .env.example .env      # fill in the values below
npm start                 # http://localhost:8000

# 3. Frontend
cd ../frontend
npm install
echo "VITE_BACKEND_URL=http://localhost:8000" > .env.local
npm run dev               # http://localhost:5173
```

Backend `.env`:

| Variable | Notes |
| --- | --- |
| `FRONTEND_URL` | Comma-separated CORS allowlist. The **first** entry is used for OAuth redirects. |
| `CLIENT_ID` / `CLIENT_SECRET` | From the Spotify dashboard. |
| `REDIRECT_URI` | Must match a Redirect URI registered in the dashboard **exactly**. Spotify requires `127.0.0.1` rather than `localhost` for loopback. |
| `JWT_SECRET` / `ENCRYPTION_KEY` | Any long random strings — `openssl rand -hex 32`. Rotating `ENCRYPTION_KEY` invalidates every stored token and API key. |
| `SUPABASE_URL` | The **bare** project URL, e.g. `https://abc.supabase.co` — not the `/rest/v1/` endpoint. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role / `sb_secret_…` key. Server only. |
| `AUDD_API_TOKEN` | For microphone song recognition. |
| `DEBUG_AUTH_ERRORS` | Set to `true` to surface the underlying OAuth failure on the login screen. |

On boot the backend prints `[boot] Supabase reachable ✓` or the exact failure reason, and
`GET /health` returns `503` with the same detail when the database is unreachable.

## Troubleshooting login

`"Spotify login failed"` on the login screen means the OAuth callback threw. The redirect
carries a step-specific code, and the server log names the stage:

| Code | Meaning |
| --- | --- |
| `auth_failed_token_exchange` | Spotify rejected the code — usually `REDIRECT_URI` differs from the registered one, or bad client credentials. |
| `auth_failed_profile` | Token worked but `/v1/me` failed. |
| `auth_failed_db` | Spotify succeeded; Supabase did not. Check `SUPABASE_URL` (no `/rest/v1` suffix), the service role key, and that the project is running and has the schema applied. |
| `state_mismatch` | The signed state expired (>10 min) or `JWT_SECRET` changed mid-flow. |
| `spotify_access_denied` | The user declined consent. |
| other `spotify_*` | Spotify refused — most often the account is not on the Development-mode allowlist. |

Set `DEBUG_AUTH_ERRORS=true` to print the underlying message under the error on the login page.

## Troubleshooting song recognition

AudD answers **HTTP 200 for everything**, including failures — the outcome is only in the
body, so a `200 OK` response object tells you nothing:

| Body | Meaning |
| --- | --- |
| `{"status":"success","result":{…}}` | Matched. |
| `{"status":"success","result":null}` | Genuinely no match — clip too short, quiet, or noisy. |
| `{"status":"error","error":{"error_code":900,…}}` | `AUDD_API_TOKEN` is wrong, or the account has no active trial/subscription. |
| `{"status":"error","error":{"error_code":901,…}}` | Request limit reached. |

Codes 900/901 are account problems, so the API returns `503` with a message saying the key
is at fault rather than blaming the recording. Check the token at
[dashboard.audd.io](https://dashboard.audd.io); trials expire and the key then fails while
still looking well-formed.

Verify a token without touching the app:

```bash
curl -s -X POST https://api.audd.io/ \
  -d api_token=$AUDD_API_TOKEN -d url=https://audd.tech/example.mp3
```

## Notes and limits

- Queueing and playback control need an **active** Spotify device and a **Premium** account.
- AudD needs a reasonably clear ~8s clip; the browser captures `audio/webm`.
- Free Render instances sleep when idle, so the first request after a pause is slow.
