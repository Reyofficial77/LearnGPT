import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { getSessionUser } from "../../../lib/server-auth";
import { DEFAULT_SETTINGS } from "../../../lib/types";
import { LEARN_MODELS } from "../../../lib/models";

export const runtime = "nodejs";
const THEMES = ["dark", "light", "system"] as const;
const SPEECH_LANGUAGES = new Set(["auto", "id-ID", "en-US", "es-ES", "fr-FR", "de-DE", "pt-BR", "ja-JP", "ko-KR", "zh-CN", "hi-IN", "ar-SA"]);
function settingsPayload(settings: any) {
  const skills = Array.isArray(settings.enabledSkills) ? settings.enabledSkills.filter((item: unknown): item is string => typeof item === "string") : [];
  return {
    model: LEARN_MODELS.includes(settings.model as any) ? settings.model : DEFAULT_SETTINGS.model,
    theme: THEMES.includes(settings.theme as typeof THEMES[number]) ? settings.theme : DEFAULT_SETTINGS.theme,
    enabledSkills: [...new Set(["frontend-design", ...skills])],
    webSearchEnabled: Boolean(settings.webSearchEnabled),
    speechLanguage: SPEECH_LANGUAGES.has(settings.speechLanguage) ? settings.speechLanguage : "auto"
  };
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === request.nextUrl.origin; } catch { return false; }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ settings: settings ? settingsPayload(settings) : DEFAULT_SETTINGS });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const provider = "ollama";
  const model = LEARN_MODELS.includes(body.model) ? String(body.model) : DEFAULT_SETTINGS.model;
  const theme = THEMES.includes(body.theme) ? body.theme : DEFAULT_SETTINGS.theme;
  const enabledSkills: Prisma.InputJsonValue = ["frontend-design"];
  const webSearchEnabled = typeof body.webSearchEnabled === "boolean" ? body.webSearchEnabled : DEFAULT_SETTINGS.webSearchEnabled;
  const speechLanguage = SPEECH_LANGUAGES.has(body.speechLanguage) ? body.speechLanguage : DEFAULT_SETTINGS.speechLanguage;
  const settings = await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { provider, model, theme, enabledSkills, webSearchEnabled, speechLanguage },
    create: { userId: user.id, provider, model, theme, enabledSkills, webSearchEnabled, speechLanguage }
  });
  return NextResponse.json({ settings: settingsPayload(settings) });
}
