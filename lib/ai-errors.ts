import type { Provider } from "./types";
import { PROVIDER_META } from "./providers";

export type AiErrorInfo = { message: string; code?: "invalid_key" | "quota"; status: number };

// Defence in depth: never let a user's key (or anything shaped like one) leave in an error message.
const KEY_SHAPED = /(sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,})/g;
export function redactKey(text: string, apiKey: string): string {
  let out = apiKey ? text.split(apiKey).join("[redacted]") : text;
  out = out.replace(KEY_SHAPED, "[redacted]");
  return out;
}

export function describeAiError(provider: Provider | "", error: unknown, apiKey: string): AiErrorInfo {
  const label = (provider && PROVIDER_META[provider]?.label) || "The AI provider";
  const raw = error instanceof Error ? error.message : "The AI request failed.";
  const lower = raw.toLowerCase();
  const upstream = typeof (error as any)?.status === "number" ? ((error as any).status as number) : undefined;

  const keyRejected =
    upstream === 401 ||
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("invalid x-api-key") ||
    lower.includes("invalid api key") ||
    lower.includes("incorrect api key");
  if (keyRejected) {
    return { message: `${label} rejected your API key. Open Settings and check that the key is correct and still active.`, code: "invalid_key", status: 400 };
  }

  if (upstream === 429 || lower.includes("quota") || lower.includes("rate limit") || lower.includes("resource_exhausted")) {
    return { message: `${label} says you hit a rate limit or ran out of quota. Check the usage and billing of your own ${label} account, then try again.`, code: "quota", status: 429 };
  }

  if (upstream === 403 || lower.includes("permission_denied")) {
    return { message: `${label} denied the request. Your key may be restricted or lack access to this model or API. Check its permissions in your ${label} dashboard.`, status: 403 };
  }

  return { message: redactKey(raw, apiKey), status: 500 };
}
