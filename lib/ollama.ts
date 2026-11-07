import { LEARN_MODELS, type LearnModel } from "./models";

// Mapping LearnGPT model -> Ollama Cloud model. Each one can be overridden from Vercel env vars.
const DEFAULT_MODELS: Record<LearnModel, string> = {
  "learn-1.0-smart": "gemma4:31b",
  "learn-1.0-study": "beam",
  "learn-2.0-thinking": "gpt-oss:120b"
};
const MODEL_ENV: Record<LearnModel, string> = {
  "learn-1.0-smart": "OLLAMA_MODEL_SMART",
  "learn-1.0-study": "OLLAMA_MODEL_STUDY",
  "learn-2.0-thinking": "OLLAMA_MODEL_THINKING"
};

export function resolveModel(learnModel: string): string | null {
  if (!LEARN_MODELS.includes(learnModel as LearnModel)) return null;
  const key = learnModel as LearnModel;
  return process.env[MODEL_ENV[key]]?.trim() || DEFAULT_MODELS[key];
}

export class OllamaError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export type OllamaMessage = { role: "system" | "user" | "assistant"; content: string; images?: string[] };

const REQUEST_TIMEOUT_MS = 270_000;

/** One non-streaming call to Ollama Cloud. The API key is read from env on the server only. */
export async function ollamaChat(model: string, messages: OllamaMessage[]): Promise<string> {
  const apiKey = process.env.OLLAMA_API_KEY?.trim();
  if (!apiKey) throw new OllamaError("The AI service is not configured yet. Please contact the site owner.", 503);
  const baseUrl = (process.env.OLLAMA_BASE_URL?.trim() || "https://ollama.com").replace(/\/+$/, "");

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new OllamaError("The AI took too long to respond. Please try again.", 504);
    throw new OllamaError("Could not reach the AI service. Please try again.", 502);
  }

  if (!response.ok) {
    let detail = "";
    try { const data = await response.json(); detail = typeof data?.error === "string" ? data.error : ""; } catch { /* non-JSON body */ }
    throw new OllamaError(detail || `The AI service returned an error (${response.status}).`, response.status);
  }
  const data = await response.json();
  return typeof data?.message?.content === "string" ? data.message.content : "";
}
