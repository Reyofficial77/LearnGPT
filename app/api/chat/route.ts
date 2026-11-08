import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ollamaChat, resolveModel, type OllamaMessage } from "../../../lib/ollama";
import { prisma } from "../../../lib/prisma";
import { getSessionUser } from "../../../lib/server-auth";
import { APP_CAPABILITIES } from "../../../lib/ai-instructions";
import { describeAiError } from "../../../lib/ai-errors";
import { extractAttachment, textFromAttachment, type ExtractedAttachment } from "../../../lib/file-extract";
import { loadMemoryContext, updateMemoryFromConversation } from "../../../lib/memory";
export const runtime = "nodejs";
export const maxDuration = 300;

const IMAGE_RE = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGES_PER_MESSAGE = 4;
const MAX_IMAGE_CHARS = 2_500_000;

type Img = { mime: string; data: string; url: string };
type Msg = { role: "user" | "assistant"; content: string; images: Img[]; attachments: ExtractedAttachment[]; omitted: number };

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

function cleanAttachments(value: unknown): ExtractedAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: ExtractedAttachment[] = [];
  for (const item of value.slice(0, 4)) {
    if (!item || typeof item !== "object") continue;
    const attachment = item as Record<string, unknown>;
    if (typeof attachment.dataUrl === "string") {
      const extracted = extractAttachment(attachment);
      if (extracted) out.push(extracted);
      continue;
    }
    if (typeof attachment.extractedText === "string") {
      const ext = typeof attachment.name === "string" ? attachment.name.split(".").pop()?.toLowerCase() || "" : "";
      const allowed = new Set(["pdf", "docx", "txt", "md", "csv", "json", "html", "htm", "css", "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "h", "sql", "sh", "yaml", "yml", "xml", "log", "ini", "toml", "go", "rs", "rb", "php", "cs"]);
      out.push({
        id: typeof attachment.id === "string" ? attachment.id : randomUUID(),
        name: `attachment-${randomUUID().slice(0, 8)}.${allowed.has(ext) ? ext : "txt"}`,
        mimeType: typeof attachment.mimeType === "string" ? attachment.mimeType.slice(0, 120) : "text/plain",
        size: Math.max(0, Math.min(Number(attachment.size) || 0, 1_000_000)),
        extractedText: attachment.extractedText.slice(0, 40_000)
      });
    }
  }
  return out;
}

function cleanMessages(value: unknown): Msg[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((message: any) => message && (message.role === "user" || message.role === "assistant"))
    .map((message: any) => {
      const images = message.role === "user" ? cleanImages(message.images) : [];
      const attachments = message.role === "user" ? cleanAttachments(message.attachments) : [];
      const declared = Number(message.imageCount) || 0;
      return { role: message.role, content: String(message.content ?? ""), images, attachments, omitted: Math.max(0, declared - images.length) };
    });
}

function textOf(message: Msg) {
  const imageNote = message.omitted ? `[${message.omitted} image(s) were attached to this message earlier and are no longer available.]` : "";
  const fileText = message.attachments.map(textFromAttachment).join("\n");
  return [message.content, imageNote, fileText].filter(Boolean).join("\n");
}

async function persist(chatId: string, userId: string, messages: Msg[], assistantText: string) {
  const chat = await prisma.chat.findFirst({ where: { id: chatId, userId } });
  if (!chat) return;
  const existing = await prisma.message.count({ where: { chatId } });
  const incoming = messages.slice(existing);
  if (incoming.length) {
    await prisma.message.createMany({
      data: incoming.map((message) => ({
        chatId,
        role: message.role,
        content: message.content,
        images: message.images.length ? message.images.map((image) => image.url) : undefined,
        attachments: message.attachments.length ? message.attachments : undefined
      }))
    });
  }
  await prisma.message.create({ data: { chatId, role: "assistant", content: assistantText } });
  if (existing === 0) {
    const first = messages[0];
    await prisma.chat.update({ where: { id: chatId }, data: { title: (first?.content || (first?.images.length || first?.attachments.length ? "Attachment" : "New conversation")).slice(0, 80) } });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    const body = await request.json();
    const learnModel = String(body.model || "");
    const customInstructions = String(body.systemPrompt || "");
    const messages = cleanMessages(body.messages);
    const uploadChars = messages.reduce((total, message) => total + message.images.reduce((sum, image) => sum + image.url.length, 0) + message.attachments.reduce((sum, attachment) => sum + Math.ceil(attachment.size * 1.4), 0), 0);
    if (uploadChars > 3_900_000) return NextResponse.json({ error: "Attachments are too large to send together. Remove a file or choose smaller items." }, { status: 413 });
    const chatId = body.chatId ? String(body.chatId) : "";
    if (!messages.length) return NextResponse.json({ error: "No messages to send." }, { status: 400 });
    const model = resolveModel(learnModel);
    if (!model) return NextResponse.json({ error: "Invalid LearnGPT model." }, { status: 400 });

    const memory = await loadMemoryContext(user.id);
    const systemPrompt = [
      APP_CAPABILITIES,
      customInstructions,
      memory.userTemplate,
      "## Private memory for this signed-in user (USER.md)",
      memory.user,
      "## Global LearnGPT memory (MEMORY.md)",
      memory.global
    ].filter(Boolean).join("\n\n");
    const payload: OllamaMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((message): OllamaMessage => ({
        role: message.role,
        content: textOf(message) || " ",
        ...(message.images.length ? { images: message.images.map((image) => image.data) } : {})
      }))
    ];
    const text = await ollamaChat(model, payload);
    if (chatId) await persist(chatId, user.id, messages, text);

    await updateMemoryFromConversation({
      userId: user.id,
      model,
      ollamaChat: (selectedModel, memoryMessages) => ollamaChat(selectedModel, memoryMessages, 35_000),
      messages: messages.map(({ role, content }) => ({ role, content }))
    });

    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
    return NextResponse.json({ text, attachments: latestUserMessage?.attachments || [] });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unsupported file type")) return NextResponse.json({ error: error.message }, { status: 415 });
    if (error instanceof Error && error.message.includes("must be 1 MB")) return NextResponse.json({ error: error.message }, { status: 413 });
    const info = describeAiError(error);
    return NextResponse.json({ error: info.message, ...(info.code ? { code: info.code } : {}) }, { status: info.status });
  }
}
