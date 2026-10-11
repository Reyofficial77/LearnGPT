import type { Provider } from "./types";

export type ProviderMeta = {
  label: string;
  placeholder: string;
  getKeyUrl: string;
  getKeyHost: string;
};

export const PROVIDER_META: Record<Provider, ProviderMeta> = {
  gemini: { label: "Gemini", placeholder: "AIza...", getKeyUrl: "https://aistudio.google.com/apikey", getKeyHost: "aistudio.google.com" },
  openai: { label: "OpenAI", placeholder: "sk-...", getKeyUrl: "https://platform.openai.com/api-keys", getKeyHost: "platform.openai.com" },
  anthropic: { label: "Anthropic (Claude)", placeholder: "sk-ant-...", getKeyUrl: "https://console.anthropic.com/settings/keys", getKeyHost: "console.anthropic.com" }
};

export const PROVIDER_LIST = Object.keys(PROVIDER_META) as Provider[];

/** Printable ASCII only (no spaces / line breaks), 8-512 chars. Every real provider key fits this. */
export const API_KEY_PATTERN = /^[\x21-\x7E]{8,512}$/;

/** Best-effort guess of which provider a key belongs to, based on its well-known prefix. */
export function detectProvider(key: string): Provider | null {
  if (key.startsWith("AIza")) return "gemini";
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-")) return "openai";
  return null;
}

export type KeyIssue = { level: "error" | "warning"; message: string };

/**
 * "error"   -> the key can never work (stray space, odd characters, too short): block saving.
 * "warning" -> the key looks like it belongs to another provider: allow saving, but tell the user.
 */
export function checkKey(provider: Provider, rawKey: string): KeyIssue | null {
  const key = rawKey.trim();
  if (!key) return null;
  if (!API_KEY_PATTERN.test(key)) {
    return { level: "error", message: "This key looks invalid. Make sure it has no spaces or line breaks and was copied completely." };
  }
  const detected = detectProvider(key);
  if (detected && detected !== provider) {
    return { level: "warning", message: `This looks like a ${PROVIDER_META[detected].label} key, not a ${PROVIDER_META[provider].label} key.` };
  }
  return null;
}
