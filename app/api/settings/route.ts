import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { getSessionUser } from "../../../lib/server-auth";
import { DEFAULT_SETTINGS } from "../../../lib/types";
import { LEARN_MODELS } from "../../../lib/models";

export const runtime = "nodejs";
const THEMES = ["dark", "light", "system"] as const;
const AVAILABLE_SKILLS = new Set(["frontend-design"]);
const DICTATION_LANGUAGES = new Set(["auto", "id-ID", "en-US", "es-ES", "fr-FR", "de-DE", "pt-BR", "ja-JP", "ko-KR", "zh-CN", "hi-IN", "ar-SA"]);
function settingsPayload(settings: any) {
  const skills = Array.isArray(settings.enabledSkills) ? settings.enabledSkills.filter((item: unknown): item is string => typeof item === "string" && AVAILABLE_SKILLS.has(item)) : [];
  return {
    model: LEARN_MODELS.includes(settings.model as any) ? settings.model : DEFAULT_SETTINGS.model,
    theme: THEMES.includes(settings.theme as typeof THEMES[number]) ? settings.theme : DEFAULT_SETTINGS.theme,
    enabledSkills: skills,
    webSearchEnabled: Boolean(settings.webSearchEnabled),
    dictationLanguage: DICTATION_LANGUAGES.has(settings.dictationLanguage) ? settings.dictationLanguage : "id-ID"
  };
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
  const body = await req.json().catch(() => ({}));
  const provider = "ollama";
  const model = LEARN_MODELS.includes(body.model) ? String(body.model) : DEFAULT_SETTINGS.model;
  const theme = THEMES.includes(body.theme) ? body.theme : DEFAULT_SETTINGS.theme;
  const enabledSkills: Prisma.InputJsonValue = Array.isArray(body.enabledSkills)
    ? [...new Set<string>(body.enabledSkills.filter((item: unknown): item is string => typeof item === "string" && AVAILABLE_SKILLS.has(item)))]
    : [...DEFAULT_SETTINGS.enabledSkills];
  const webSearchEnabled = typeof body.webSearchEnabled === "boolean" ? body.webSearchEnabled : DEFAULT_SETTINGS.webSearchEnabled;
  const dictationLanguage = DICTATION_LANGUAGES.has(body.dictationLanguage) ? body.dictationLanguage : DEFAULT_SETTINGS.dictationLanguage;
  const settings = await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { provider, model, theme, enabledSkills, webSearchEnabled, dictationLanguage },
    create: { userId: user.id, provider, model, theme, enabledSkills, webSearchEnabled, dictationLanguage }
  });
  return NextResponse.json({ settings: settingsPayload(settings) });
}
