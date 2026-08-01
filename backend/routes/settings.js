import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../lib/supabase.js";
import { encrypt } from "../lib/crypto.js";
import { PROVIDERS, defaultModelFor, envKeyFor } from "../lib/llm.js";

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

  const fallbackProvider = process.env.DEFAULT_LLM_PROVIDER || "gemini";
  const provider = data?.provider || fallbackProvider;
  const hasKey = !!data?.has_key;
  // A server-side key for this provider lets the user chat without bringing their own.
  const serverFallback = !!envKeyFor(provider);

  res.json({
    provider,
    model: data?.model || defaultModelFor(provider),
    has_key: hasKey,
    // `configured` drives the post-login onboarding gate: no row means the user has
    // never been through the BYOK step.
    configured: !!data,
    server_fallback: serverFallback,
    needs_key: !hasKey && !serverFallback,
  });
});

router.put("/", requireAuth, async (req, res) => {
  const { provider, model, apiKey } = req.body;
  if (provider && !PROVIDERS[provider]) return res.status(400).json({ error: "Unknown provider" });

  const chosen = provider || process.env.DEFAULT_LLM_PROVIDER || "gemini";

  const { data: existing } = await supabase
    .from("user_settings")
    .select("provider, has_key")
    .eq("user_id", req.user.id)
    .maybeSingle();

  // Only one key is stored per user, so it belongs to the provider it was saved under.
  const keptKey = !apiKey && existing?.has_key && existing.provider === chosen;

  if (!apiKey && !keptKey && !envKeyFor(chosen)) {
    return res.status(400).json({
      error: `An API key is required for ${PROVIDERS[chosen].label}.`,
      code: "key_required",
    });
  }

  const row = {
    user_id: req.user.id,
    provider: chosen,
    model: model || null,
    updated_at: new Date().toISOString(),
  };
  if (apiKey) {
    row.api_key_enc = encrypt(apiKey);
    row.has_key = true;
  } else if (!keptKey) {
    // Switched providers with no new key — the old one no longer applies.
    row.api_key_enc = null;
    row.has_key = false;
  }

  const { error } = await supabase.from("user_settings").upsert(row, { onConflict: "user_id" });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
