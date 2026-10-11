import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { Provider } from "../../../../lib/types";
import { getSessionUser } from "../../../../lib/server-auth";
import { API_KEY_PATTERN, PROVIDER_META } from "../../../../lib/providers";
import { describeAiError } from "../../../../lib/ai-errors";
export const runtime = "nodejs";
export const maxDuration = 30;

const TIMEOUT_MS = 15_000;

// Checks a user-supplied key by listing models: it needs a valid key but does not spend any tokens.
// The key is used for this one call only and is never stored or logged.
export async function POST(req: NextRequest) {
  let provider = "" as Provider;
  let apiKey = "";
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized. Please sign in." }, { status: 401 });
    const body = await req.json();
    provider = body.provider as Provider;
    apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!["gemini", "openai", "anthropic"].includes(provider)) return NextResponse.json({ ok: false, error: "Unsupported provider." }, { status: 400 });
    if (!API_KEY_PATTERN.test(apiKey)) return NextResponse.json({ ok: false, error: `This does not look like a valid ${PROVIDER_META[provider].label} key.`, code: "invalid_key" }, { status: 400 });

    if (provider === "openai") {
      await new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 }).models.list();
    } else if (provider === "anthropic") {
      await new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 }).models.list({ limit: 1 });
    } else {
      await new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } }).models.list({ config: { pageSize: 1 } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const info = describeAiError(provider, error, apiKey);
    return NextResponse.json({ ok: false, error: info.message, ...(info.code ? { code: info.code } : {}) }, { status: info.status });
  }
}
