export type AiErrorInfo = { message: string; code?: "service_unavailable" | "quota"; status: number };

// The API key is server-side only, but never let anything shaped like a key leave in an error message.
const KEY_SHAPED = /([A-Fa-f0-9]{32}\.[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{8,})/g;
export function redactSecrets(text: string): string {
  const key = process.env.OLLAMA_API_KEY?.trim();
  let out = key ? text.split(key).join("[redacted]") : text;
  return out.replace(KEY_SHAPED, "[redacted]");
}

export function describeAiError(error: unknown): AiErrorInfo {
  const raw = error instanceof Error ? error.message : "The AI request failed.";
  const lower = raw.toLowerCase();
  const upstream = typeof (error as any)?.status === "number" ? ((error as any).status as number) : undefined;

  // 401/403 means the site owner's key is wrong; users cannot fix that, so keep it generic and log on the server.
  if (upstream === 401 || upstream === 403) {
    console.error("[ollama] authentication failed:", redactSecrets(raw));
    return { message: "The AI service is temporarily unavailable. Please try again later.", code: "service_unavailable", status: 503 };
  }
  if (upstream === 429 || lower.includes("rate limit") || lower.includes("quota") || lower.includes("usage limit")) {
    return { message: "The AI service is busy or has reached its usage limit. Please try again in a little while.", code: "quota", status: 429 };
  }
  if (upstream === 404 || lower.includes("not found")) {
    console.error("[ollama] model not found:", redactSecrets(raw));
    return { message: "This model is currently unavailable. Try another model.", status: 502 };
  }
  return { message: redactSecrets(raw), status: upstream && upstream >= 400 && upstream < 600 ? upstream : 500 };
}
