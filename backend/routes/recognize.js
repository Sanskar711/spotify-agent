import express from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { recognizeAudio } from "../lib/audd.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const router = express.Router();

// Shazam-like: POST an audio clip (multipart field "audio") -> matched song.
router.post("/", requireAuth, upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio uploaded" });
  try {
    const result = await recognizeAudio(req.file.buffer, req.file.originalname || "clip.webm");
    res.json(result);
  } catch (e) {
    console.error("Recognize error:", e);
    res.status(500).json({ error: "Recognition failed", detail: String(e.message || e) });
  }
});

export default router;
