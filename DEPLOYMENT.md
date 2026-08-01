# Deployment Guide — Spotify AI Agent

Architecture:

```
Browser ──> Vercel (React/Vite frontend)
                │  Authorization: Bearer <session JWT>
                ▼
          Render (Express API) ──> Supabase (Postgres: users, settings, chat)
                │                └─> AudD (song recognition)
                ├─> Spotify Web API (OAuth + search + queue + playlists)
                └─> LLM provider (Gemini / Groq / Claude / OpenAI — user's key)
```

Auth model: user logs in with Spotify → backend creates/updates a `users` row →
issues a 30-day **session JWT** the frontend stores in `localStorage`. Spotify
access/refresh tokens live encrypted (AES-256-GCM) in Postgres and are auto-refreshed.

---

## 1. Supabase (database)

1. Create a project at https://supabase.com.
2. SQL Editor → paste & run [`backend/db/schema.sql`](backend/db/schema.sql).
3. Settings → API → copy **Project URL** and the **service_role** key
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Keep service_role secret — backend only.
   `SUPABASE_URL` must be the bare project URL (`https://xxxx.supabase.co`) — **not** the
   `/rest/v1/` REST endpoint, which the client appends itself.
4. Verify: start the backend and look for `[boot] Supabase reachable ✓`, or hit `/health`.
   A paused or deleted project shows up here as `fetch failed`.

## 2. Spotify app

1. https://developer.spotify.com/dashboard → Create app → copy Client ID/Secret.
2. Add Redirect URI (must match `REDIRECT_URI` exactly):
   - Local: `http://localhost:8000/auth/callback`
   - Prod:  `https://<your-render-service>.onrender.com/auth/callback`
3. A new app is in **Development mode**: only the owner plus up to **25** accounts added
   under Settings → **User Management** (full name + the exact email on their Spotify
   account) can authorize. Everyone else is rejected right after entering their password/OTP.
   Adding a user takes effect immediately — no redeploy. To remove the limit, request
   **Extended Quota Mode** in the dashboard (manual review by Spotify, takes weeks, needs a
   public privacy policy).

## 3. AudD (recognition)

Sign up at https://audd.io → copy API token → `AUDD_API_TOKEN`.

## 4. LLM keys (optional server fallback)

Users add their own key in-app (Settings). Set server keys only if you want a
default when a user has none. Free options: **Gemini** (aistudio.google.com) and **Groq** (console.groq.com).

## 5. Backend → Render

Option A (blueprint): repo includes [`render.yaml`](render.yaml). Render → New → Blueprint,
point at the repo, fill the `sync: false` env vars in the dashboard.

Option B (manual): New Web Service → root dir `backend`, build `npm install`, start `npm start`.

Required env vars (see [`backend/.env.example`](backend/.env.example)):
`FRONTEND_URL, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, JWT_SECRET, ENCRYPTION_KEY,
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUDD_API_TOKEN` (+ optional LLM keys).

Generate secrets: `openssl rand -hex 32`.

## 6. Frontend → Vercel

1. Vercel → New Project → import repo → **Root Directory: `frontend`** (Vite auto-detected).
2. Env var: `VITE_BACKEND_URL = https://<your-render-service>.onrender.com`.
3. Deploy. [`frontend/vercel.json`](frontend/vercel.json) handles SPA routing.

## 7. Wire the URLs together

- Render `FRONTEND_URL` = your Vercel URL (e.g. `https://spotify-agent.vercel.app`).
  Supports comma-separated origins for multiple domains.
- Render `REDIRECT_URI` = `https://<render>.onrender.com/auth/callback` — and add
  the same value in the Spotify dashboard.
- Redeploy backend after changing env vars.

## 8. Smoke test

1. Visit the Vercel URL → **Login with Spotify** → approve.
2. You land back logged in (session in URL is consumed automatically).
3. Open **Settings**, pick a provider, paste a key (or rely on server fallback), Save.
4. Ask: “recommend upbeat songs like Dua Lipa”.
5. Play something on a Spotify device, tap 🎤 to identify it.
6. “add the first one to my queue”.

## Notes / limits

- Render free tier sleeps on idle → first request after idle is slow (cold start).
- AudD needs a reasonably clear ~8s clip; browser mic capture is `audio/webm`.
- `addToQueue` requires an **active** Spotify device (open the app and hit play once).
- Recommendations/queue require Spotify Premium for playback control.
