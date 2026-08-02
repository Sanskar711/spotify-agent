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
    const result = await recognizeAudio(
      req.file.buffer,
      req.file.originalname || "clip.webm",
      req.file.mimetype
    );
    res.json(result);
  } catch (e) {
    console.error("Recognize error:", e.message || e);
    if (e.configIssue) {
      console.error(
        "[recognize] Hint: AUDD_API_TOKEN is missing, wrong, or the account has no active " +
          "trial/subscription. Check dashboard.audd.io."
      );
      return res.status(503).json({
        error:
          "Song recognition is unavailable — the AudD API key is invalid or inactive. " +
          "This is an app configuration issue, not a problem with your recording.",
        code: "audd_unavailable",
      });
    }
    res.status(500).json({ error: "Recognition failed", detail: String(e.message || e) });
  }
});

export default router;
