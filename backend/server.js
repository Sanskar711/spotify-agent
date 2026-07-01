import "dotenv/config"; // must load env before any module reads process.env at import time

import express from "express";
import cors from "cors";

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
app.get("/health", (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use("/auth", authRoutes);
app.use("/chat", chatRoutes);
app.use("/settings", settingsRoutes);
app.use("/recognize", recognizeRoutes);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
