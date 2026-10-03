import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { Provider } from "../../../lib/types";
import { resolveModel } from "../../../lib/models";
import { prisma } from "../../../lib/prisma";
import { getSessionUser } from "../../../lib/server-auth";
import { APP_CAPABILITIES } from "../../../lib/ai-instructions";
export const runtime = "nodejs";
export const maxDuration = 60;

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
    const provider = body.provider as Provider;
    const learnModel = String(body.model || "");
    const apiKey = (provider === "gemini" ? process.env.GEMINI_API_KEY : provider === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY) || "";
    const systemPrompt = [String(body.systemPrompt || ""), APP_CAPABILITIES].filter(Boolean).join("\n\n");
    const messages = cleanMessages(body.messages);
    const chatId = body.chatId ? String(body.chatId) : "";
    if (!["gemini", "openai", "anthropic"].includes(provider)) return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: `${provider} API key is missing. Open Settings to add it.` }, { status: 400 });
    if (!messages.length) return NextResponse.json({ error: "No messages to send." }, { status: 400 });
    const model = resolveModel(provider, learnModel);
    if (!model) return NextResponse.json({ error: "Invalid LearnGPT model." }, { status: 400 });

    let text = "";
    if (provider === "openai") {
      const client = new OpenAI({ apiKey });
      const input = messages.map((m) => {
        if (m.role === "assistant" || !m.images.length) return { role: m.role, content: textOf(m) || " " };
        const parts: any[] = m.images.map((i) => ({ type: "input_image", image_url: i.url, detail: "auto" }));
        const t = textOf(m); if (t) parts.push({ type: "input_text", text: t });
        return { role: "user", content: parts };
      });
      const response = await client.responses.create({ model, instructions: systemPrompt, input: input as any });
      text = response.output_text;
    } else if (provider === "anthropic") {
      const client = new Anthropic({ apiKey });
      const chatMessages = messages.map((m) => {
        if (m.role === "assistant" || !m.images.length) return { role: m.role, content: textOf(m) || " " };
        const blocks: any[] = m.images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mime, data: i.data } }));
        const t = textOf(m); if (t) blocks.push({ type: "text", text: t });
        return { role: "user" as const, content: blocks };
      });
      const response = await client.messages.create({ model, max_tokens: 16000, system: systemPrompt, messages: chatMessages as any });
      text = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
    } else {
      const ai = new GoogleGenAI({ apiKey });
      const contents = messages.map((m) => {
        const parts: any[] = m.images.map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } }));
        const t = textOf(m); if (t || !parts.length) parts.push({ text: t || " " });
        return { role: m.role === "assistant" ? "model" : "user", parts };
      });
      const response = await ai.models.generateContent({ model, contents, config: { systemInstruction: systemPrompt } });
      text = response.text || "";
    }
    if (chatId) await persist(chatId, user.id, messages, text);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The AI request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
