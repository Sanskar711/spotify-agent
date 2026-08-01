# Frontend — Spotify AI Agent

React 19 + TypeScript SPA built with Vite and Tailwind. Chat UI, the post-login BYOK setup
step, AI model settings, and microphone capture for song recognition.

See the [root README](../README.md) for architecture and the backend setup.

## Run

```bash
npm install
echo "VITE_BACKEND_URL=http://localhost:8000" > .env.local
npm run dev       # http://localhost:5173
```

| Script | Description |
| --- | --- |
| `npm run dev` | Vite dev server. |
| `npm run build` | Production build to `dist/`. |
| `npm run preview` | Serve the built output locally. |

`VITE_BACKEND_URL` is the only env var; it defaults to `http://localhost:8000`. It must be
listed in the backend's `FRONTEND_URL` CORS allowlist.

## Layout

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Router and providers. Routes: `/app`, `/login`. |
| `src/app/page.tsx` | Chat screen; owns the BYOK gate that blocks the composer. |
| `src/app/login/page.tsx` | Login screen and OAuth error messages. |
| `src/context/AuthContext.tsx` | Session token in `localStorage`, `/auth/me` hydration. |
| `src/context/ChatContext.tsx` | Message list, history loading, send/clear. |
| `src/components/Settings.tsx` | Provider/model/API-key modal; doubles as the onboarding step. |
| `src/components/ShazamButton.tsx` | Mic capture → `POST /recognize`. |
| `src/components/Message.tsx` | Message bubble with link rendering. |
| `src/utils/api.tsx` | Axios instance that attaches the session bearer token. |

## Auth flow in the client

The backend redirects to `/app?session=<jwt>` after Spotify login. `page.tsx` reads that
query param, hands it to `AuthContext.login()`, and strips it from the URL. Any request
that returns 401 clears the stored session and bounces the user to `/login`.

## BYOK gate

On landing with a session the app calls `GET /settings`. If `configured` is false (the user
has never completed setup) or `needs_key` is true (no personal key and no server fallback),
`Settings` renders in `onboarding` mode: not dismissable, no close button, and the chat
input stays disabled until a model is connected. A failed settings request does **not**
lock the user out — the gate opens on error.

## Deployment

Vercel with **Root Directory: `frontend`**. `vercel.json` rewrites all paths to
`index.html` for client-side routing. Set `VITE_BACKEND_URL` to the deployed API origin.
