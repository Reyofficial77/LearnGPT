import { LEARN_MODELS, type LearnModel } from "./models";

// Gemma 4 models hosted by the Google Gemini API. Model IDs can be overridden
// on the server without changing the public LearnGPT model names.
const DEFAULT_MODELS: Record<LearnModel, string> = {
  "learn-1.0-smart": "gemma-4-26b-a4b-it",
  "learn-1.0-study": "gemma-4-31b-it",
  "learn-2.0-thinking": "gemma-4-31b-it"
};
const MODEL_ENV: Record<LearnModel, string> = {
  "learn-1.0-smart": "GEMINI_MODEL_SMART",
  "learn-1.0-study": "GEMINI_MODEL_STUDY",
  "learn-2.0-thinking": "GEMINI_MODEL_THINKING"
};
const THINKING_LEVELS: Record<LearnModel, "minimal" | "high"> = {
  "learn-1.0-smart": "minimal",
  "learn-1.0-study": "minimal",
  "learn-2.0-thinking": "high"
};

export function resolveModel(learnModel: string): string | null {
  if (!LEARN_MODELS.includes(learnModel as LearnModel)) return null;
  const key = learnModel as LearnModel;
  return process.env[MODEL_ENV[key]]?.trim() || DEFAULT_MODELS[key];
}

export function resolveThinkingLevel(learnModel: string): "minimal" | "high" {
  return THINKING_LEVELS[learnModel as LearnModel] || "minimal";
}

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type GeminiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  images?: { mimeType: string; data: string }[];
};

const REQUEST_TIMEOUT_MS = 270_000;

/** Calls the Gemini API with a server-only key and Gemma 4 generation settings. */
export async function geminiChat(
  model: string,
  messages: GeminiMessage[],
  timeoutMs = REQUEST_TIMEOUT_MS,
  thinkingLevel: "minimal" | "high" = "minimal"
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiError("The AI service is not configured yet. Please contact the site owner.", 503);

  const systemText = messages.filter((message) => message.role === "system").map((message) => message.content).filter(Boolean).join("\n\n");
  const contents = messages.filter((message) => message.role !== "system").map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [
      ...(message.content ? [{ text: message.content }] : []),
      ...(message.images || []).map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.data } }))
    ]
  })).filter((content) => content.parts.length > 0);

  if (!contents.length) throw new GeminiError("No message content was provided.", 400);

  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        ...(systemText ? { systemInstruction: { role: "system", parts: [{ text: systemText }] } } : {}),
        contents,
        generationConfig: {
          temperature: 1,
          topP: 0.95,
          topK: 64,
          thinkingConfig: { thinkingLevel }
        }
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new GeminiError("The AI took too long to respond. Please try again.", 504);
    }
    throw new GeminiError("Could not reach the AI service. Please try again.", 502);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data?.error?.message === "string" ? data.error.message : "";
    throw new GeminiError(detail || `The AI service returned an error (${response.status}).`, response.status);
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.filter((part: any) => part?.thought !== true && typeof part?.text === "string").map((part: any) => part.text).join("")
    : "";
  if (!text.trim()) {
    const reason = data?.promptFeedback?.blockReason;
    throw new GeminiError(reason ? `The AI request was blocked (${reason}). Please revise your prompt.` : "The AI returned an empty response. Please try again.", 502);
  }
  return text;
}
