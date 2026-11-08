import { ollamaChat } from "./ollama";

const TITLE_TIMEOUT_MS = 20_000;
const TITLE_MAX = 60;

const TITLE_SYSTEM_PROMPT = [
  "You write titles for chat conversations.",
  "Read the user's first message and reply with ONLY a short title that summarizes what it is about.",
  "Rules: 2 to 6 words, same language as the message, no quotation marks, no markdown, no emoji, no trailing punctuation.",
  "Do not answer the message and do not add any explanation."
].join(" ");

/** Fallback used when there is no text to summarize or the AI call fails. */
export function fallbackTitle(prompt: string, hasFiles: boolean, hasImages: boolean): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  if (clean) return clean.length > 40 ? `${clean.slice(0, 40).trimEnd()}…` : clean;
  if (hasFiles) return "Uploaded file";
  if (hasImages) return "Image";
  return "New Chat";
}

function cleanTitle(raw: string): string {
  const firstLine = raw.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
  return firstLine
    .replace(/^(title|judul)\s*[:：-]\s*/i, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/^["'“”‘’«»\s]+|["'“”‘’«»\s]+$/g, "")
    .replace(/[.!?。…:;,\s]+$/g, "")
    .slice(0, TITLE_MAX)
    .trim();
}

/**
 * Summarizes the first user prompt into a short chat title with the AI.
 * Never throws: returns the fallback title when the AI is unavailable.
 */
export async function generateChatTitle(model: string, prompt: string, hasFiles: boolean, hasImages: boolean): Promise<string> {
  const fallback = fallbackTitle(prompt, hasFiles, hasImages);
  if (!prompt.trim()) return fallback;
  try {
    const raw = await ollamaChat(model, [
      { role: "system", content: TITLE_SYSTEM_PROMPT },
      { role: "user", content: prompt.trim().slice(0, 1500) }
    ], TITLE_TIMEOUT_MS);
    const title = cleanTitle(raw);
    return title.length >= 2 ? title : fallback;
  } catch {
    return fallback;
  }
}
