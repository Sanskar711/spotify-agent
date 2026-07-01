import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../lib/supabase.js";
import { encrypt } from "../lib/crypto.js";
import { PROVIDERS, defaultModelFor } from "../lib/llm.js";

const router = express.Router();

// Public: list selectable providers (id, label, default model, key signup URL, free flag).
router.get("/providers", (req, res) => {
  res.json(
    Object.entries(PROVIDERS).map(([id, v]) => ({
      id,
      label: v.label,
      defaultModel: v.defaultModel,
      keyUrl: v.keyUrl,
      free: v.free,
    }))
  );
});

router.get("/", requireAuth, async (req, res) => {
  const { data } = await supabase
    .from("user_settings")
    .select("provider, model, has_key")
    .eq("user_id", req.user.id)
    .maybeSingle();
  res.json(data || { provider: "gemini", model: defaultModelFor("gemini"), has_key: false });
});

router.put("/", requireAuth, async (req, res) => {
  const { provider, model, apiKey } = req.body;
  if (provider && !PROVIDERS[provider]) return res.status(400).json({ error: "Unknown provider" });

  const row = {
    user_id: req.user.id,
    provider: provider || "gemini",
    model: model || null,
    updated_at: new Date().toISOString(),
  };
  if (apiKey) {
    row.api_key_enc = encrypt(apiKey);
    row.has_key = true;
  }

  const { error } = await supabase.from("user_settings").upsert(row, { onConflict: "user_id" });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
