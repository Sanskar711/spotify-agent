import "dotenv/config"; // must load env before any module reads process.env at import time

import express from "express";
import cors from "cors";

import { checkDatabase } from "./lib/supabase.js";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import settingsRoutes from "./routes/settings.js";
import recognizeRoutes from "./routes/recognize.js";

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => res.send("Spotify AI Agent API"));
app.get("/health", async (req, res) => {
  const db = await checkDatabase();
  res.status(db.ok ? 200 : 503).json({ ok: db.ok, uptime: process.uptime(), db });
});

app.use("/auth", authRoutes);
app.use("/chat", chatRoutes);
app.use("/settings", settingsRoutes);
app.use("/recognize", recognizeRoutes);

const PORT = process.env.PORT || 8000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  const missing = [
    "CLIENT_ID",
    "CLIENT_SECRET",
    "REDIRECT_URI",
    "JWT_SECRET",
    "ENCRYPTION_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((k) => !process.env[k]);
  if (missing.length) console.error(`[boot] Missing required env vars: ${missing.join(", ")}`);

  // A dead DB otherwise only surfaces as "Spotify login failed" after a full OAuth round-trip.
  const db = await checkDatabase();
  console.log(db.ok ? "[boot] Supabase reachable ✓" : `[boot] Supabase UNREACHABLE — ${db.reason}`);
});

export default app;
