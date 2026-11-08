import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSessionUser } from "../../../lib/server-auth";
import { DEFAULT_SETTINGS } from "../../../lib/types";
import { LEARN_MODELS } from "../../../lib/models";

export const runtime = "nodejs";
const THEMES = ["dark", "light", "system"] as const;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ settings: settings ? {
    model: LEARN_MODELS.includes(settings.model as any) ? settings.model : DEFAULT_SETTINGS.model,
    systemPrompt: settings.systemPrompt,
    theme: THEMES.includes(settings.theme as typeof THEMES[number]) ? settings.theme : DEFAULT_SETTINGS.theme
  } : DEFAULT_SETTINGS });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const provider = "ollama";
  const model = LEARN_MODELS.includes(body.model) ? String(body.model) : DEFAULT_SETTINGS.model;
  const systemPrompt = typeof body.systemPrompt === "string" && body.systemPrompt.trim() ? body.systemPrompt.slice(0, 12000) : DEFAULT_SETTINGS.systemPrompt;
  const theme = THEMES.includes(body.theme) ? body.theme : DEFAULT_SETTINGS.theme;
  const settings = await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { provider, model, systemPrompt, theme },
    create: { userId: user.id, provider, model, systemPrompt, theme }
  });
  return NextResponse.json({ settings: { model: settings.model, systemPrompt: settings.systemPrompt, theme: settings.theme } });
}
