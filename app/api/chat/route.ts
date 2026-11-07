import { NextRequest, NextResponse } from "next/server";
import { ollamaChat, resolveModel, type OllamaMessage } from "../../../lib/ollama";
import { prisma } from "../../../lib/prisma";
import { getSessionUser } from "../../../lib/server-auth";
import { APP_CAPABILITIES } from "../../../lib/ai-instructions";
import { describeAiError } from "../../../lib/ai-errors";
export const runtime = "nodejs";
export const maxDuration = 300;

const IMAGE_RE = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGES_PER_MESSAGE = 4;
const MAX_IMAGE_CHARS = 2_500_000; // ~1.8 MB per image after base64

type Img = { mime: string; data: string; url: string };
type Msg = { role: "user" | "assistant"; content: string; images: Img[]; omitted: number };

function cleanImages(value: unknown): Img[] {
  if (!Array.isArray(value)) return [];
  const out: Img[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length > MAX_IMAGE_CHARS) continue;
    const match = IMAGE_RE.exec(item);
    if (match) out.push({ mime: match[1], data: match[2], url: item });
    if (out.length === MAX_IMAGES_PER_MESSAGE) break;
  }
  return out;
}

function cleanMessages(value: unknown): Msg[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant"))
    .map((m: any) => {
      const images = m.role === "user" ? cleanImages(m.images) : [];
      const declared = Number(m.imageCount) || 0;
      return { role: m.role, content: String(m.content ?? ""), images, omitted: Math.max(0, declared - images.length) };
    });
}

// Text that also tells the model when older images were dropped to keep the request small.
function textOf(m: Msg): string {
  const note = m.omitted ? `[${m.omitted} image(s) were attached to this message earlier and are no longer available.]` : "";
  return [m.content, note].filter(Boolean).join("\n");
}

async function persist(chatId: string, userId: string, messages: Msg[], assistantText: string) {
  const chat = await prisma.chat.findFirst({ where: { id: chatId, userId } });
  if (!chat) return;
  const existing = await prisma.message.count({ where: { chatId } });
  const incoming = messages.slice(existing);
  if (incoming.length) {
    await prisma.message.createMany({
      data: incoming.map((m) => ({ chatId, role: m.role, content: m.content, images: m.images.length ? m.images.map((i) => i.url) : undefined }))
    });
  }
  await prisma.message.create({ data: { chatId, role: "assistant", content: assistantText } });
  if (existing === 0) {
    const first = messages[0];
    await prisma.chat.update({ where: { id: chatId }, data: { title: (first?.content || (first?.images.length ? "Image" : "New conversation")).slice(0, 80) } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    const body = await req.json();
    const learnModel = String(body.model || "");
    const systemPrompt = [String(body.systemPrompt || ""), APP_CAPABILITIES].filter(Boolean).join("\n\n");
    const messages = cleanMessages(body.messages);
    const chatId = body.chatId ? String(body.chatId) : "";
    if (!messages.length) return NextResponse.json({ error: "No messages to send." }, { status: 400 });
    const model = resolveModel(learnModel);
    if (!model) return NextResponse.json({ error: "Invalid LearnGPT model." }, { status: 400 });

    // The Ollama Cloud API key lives in the server env (OLLAMA_API_KEY); users never see or enter it.
    const payload: OllamaMessage[] = [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      ...messages.map((m): OllamaMessage => ({
        role: m.role,
        content: textOf(m) || " ",
        ...(m.images.length ? { images: m.images.map((i) => i.data) } : {})
      }))
    ];
    const text = await ollamaChat(model, payload);
    if (chatId) await persist(chatId, user.id, messages, text);
    return NextResponse.json({ text });
  } catch (error) {
    const info = describeAiError(error);
    return NextResponse.json({ error: info.message, ...(info.code ? { code: info.code } : {}) }, { status: info.status });
  }
}
