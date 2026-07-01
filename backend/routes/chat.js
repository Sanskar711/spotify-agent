import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { runChatTurn } from "../agent.js";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.get("/history", requireAuth, async (req, res) => {
  const { data } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: true })
    .limit(200);
  res.json(data || []);
});

router.delete("/history", requireAuth, async (req, res) => {
  await supabase.from("chat_messages").delete().eq("user_id", req.user.id);
  res.json({ ok: true });
});

router.post("/", requireAuth, async (req, res) => {
  const { query } = req.body;
  if (!query || !query.trim()) return res.status(400).json({ error: "Empty query" });

  try {
    const { data: hist } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: true })
      .limit(40);

    const reply = await runChatTurn({
      query: query.trim(),
      history: hist || [],
      user: req.user,
      spotifyToken: req.spotifyToken,
    });

    await supabase.from("chat_messages").insert([
      { user_id: req.user.id, role: "user", content: query.trim() },
      { user_id: req.user.id, role: "assistant", content: reply },
    ]);

    res.json({ response: reply });
  } catch (e) {
    console.error("Chat error:", e);
    res.status(500).json({ error: "Chat failed", detail: String(e.message || e) });
  }
});

export default router;
