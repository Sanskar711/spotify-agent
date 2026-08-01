// Multi-provider LLM abstraction. Users bring their own API key per provider
// (including free tiers: Gemini, Groq). Server env keys act as fallback.
//
// Neutral message shape used everywhere: { role: "user" | "assistant", content: string }

import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import Groq from "groq-sdk";

export const PROVIDERS = {
  gemini: {
    label: "Google Gemini (free tier available)",
    defaultModel: "gemini-2.5-flash",
    keyUrl: "https://aistudio.google.com/app/apikey",
    free: true,
  },
  groq: {
    label: "Groq (free, very fast)",
    defaultModel: "llama-3.3-70b-versatile",
    keyUrl: "https://console.groq.com/keys",
    free: true,
  },
  claude: {
    label: "Anthropic Claude (best quality)",
    defaultModel: "claude-sonnet-5",
    keyUrl: "https://console.anthropic.com/settings/keys",
    free: false,
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    keyUrl: "https://platform.openai.com/api-keys",
    free: false,
  },
};

export function defaultModelFor(provider) {
  return PROVIDERS[provider]?.defaultModel;
}

// Server-side fallback key for a provider, used when the user hasn't brought one.
export function envKeyFor(provider) {
  return (
    {
      gemini: process.env.GEMINI_API_KEY,
      groq: process.env.GROQ_API_KEY,
      claude: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
    }[provider] || null
  );
}

export async function llmChat({ provider = "gemini", apiKey, model, system, messages }) {
  if (!PROVIDERS[provider]) throw new Error(`Unknown provider: ${provider}`);
  if (!apiKey) throw new Error(`No API key configured for provider "${provider}"`);
  model = model || PROVIDERS[provider].defaultModel;

  switch (provider) {
    case "gemini":
      return geminiChat({ apiKey, model, system, messages });
    case "groq":
      return openAiCompatChat({ apiKey, model, system, messages, Client: Groq });
    case "openai":
      return openAiCompatChat({ apiKey, model, system, messages, Client: OpenAI });
    case "claude":
      return claudeChat({ apiKey, model, system, messages });
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

async function geminiChat({ apiKey, model, system, messages }) {
  const ai = new GoogleGenAI({ apiKey });
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const res = await ai.models.generateContent({
    model,
    contents,
    config: { systemInstruction: system },
  });
  const text = res?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

// Groq + OpenAI share the OpenAI chat.completions shape.
async function openAiCompatChat({ apiKey, model, system, messages, Client }) {
  const client = new Client({ apiKey });
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: system }, ...messages],
    temperature: 0.7,
  });
  const text = res?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty LLM response");
  return text;
}

async function claudeChat({ apiKey, model, system, messages }) {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model,
    max_tokens: 1024,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const text = res?.content?.map((b) => (b.type === "text" ? b.text : "")).join("");
  if (!text) throw new Error("Empty Claude response");
  return text;
}
