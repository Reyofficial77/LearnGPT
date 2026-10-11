import type { Provider, Settings } from "./types";
export const SETTINGS_KEY="learngpt.settings";
export const CHATS_KEY="learngpt.chats";
export function readSettings(): Settings { if(typeof window==="undefined") return {} as Settings; try { const raw=localStorage.getItem(SETTINGS_KEY); return raw?JSON.parse(raw):{} as Settings; } catch { return {} as Settings; } }
export function writeSettings(value: Settings){ localStorage.setItem(SETTINGS_KEY,JSON.stringify(value)); }
export function readChats(){ if(typeof window==="undefined") return []; try { return JSON.parse(localStorage.getItem(CHATS_KEY)||"[]"); } catch { return []; } }
export function writeChats(value: unknown[]){ localStorage.setItem(CHATS_KEY,JSON.stringify(value)); }

// ---- User-provided API keys (BYOK) ----------------------------------------
// Keys live ONLY in this browser (localStorage), scoped per LearnGPT account so a shared
// computer never mixes keys between users. They are never written to the database.
const KEYS_PREFIX = "learngpt.apikeys.";
const PROVIDERS: Provider[] = ["gemini", "openai", "anthropic"];
const emptyKeys = (): Record<Provider, string> => ({ gemini: "", openai: "", anthropic: "" });

export function readKeys(userId: string): Record<Provider, string> {
  const keys = emptyKeys();
  if (typeof window === "undefined" || !userId) return keys;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEYS_PREFIX + userId) || "{}");
    for (const provider of PROVIDERS) if (typeof parsed?.[provider] === "string") keys[provider] = parsed[provider].trim();
  } catch { /* corrupted or blocked storage -> behave as "no keys" */ }
  return keys;
}

/** Returns false when the browser refuses to store the keys (private mode, quota, blocked storage). */
export function writeKeys(userId: string, keys: Record<Provider, string>): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    const clean = emptyKeys();
    for (const provider of PROVIDERS) clean[provider] = (keys[provider] || "").trim();
    if (PROVIDERS.some((provider) => clean[provider])) localStorage.setItem(KEYS_PREFIX + userId, JSON.stringify(clean));
    else localStorage.removeItem(KEYS_PREFIX + userId);
    return true;
  } catch { return false; }
}
