import crypto from "crypto";

// AES-256-GCM at-rest encryption for secrets (Spotify refresh tokens, user LLM API keys).
// ENCRYPTION_KEY can be any string; we derive a 32-byte key from it via SHA-256.

function deriveKey(secret) {
  if (!secret) return null;
  return crypto.createHash("sha256").update(String(secret)).digest();
}

const KEY = deriveKey(process.env.ENCRYPTION_KEY);

export function encrypt(plain) {
  if (plain === null || plain === undefined || plain === "") return null;
  if (!KEY) throw new Error("ENCRYPTION_KEY is not set");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload) {
  if (!payload) return null;
  if (!KEY) throw new Error("ENCRYPTION_KEY is not set");
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
