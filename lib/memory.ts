import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "./prisma";

const GLOBAL_MEMORY_ID = "global";
const DEFAULT_USER_MEMORY = "# User memory\n\nNo durable user details have been saved yet.\n";

async function readGlobalMemory(): Promise<string> {
  try { return await readFile(join(process.cwd(), "MEMORY.md"), "utf8"); }
  catch { return "You are LearnGPT. Reply in the user's language, explain clearly, adapt to their level, and be transparent about uncertainty."; }
}

export async function loadMemoryContext(userId: string) {
  const globalSeed = await readGlobalMemory();
  const [global, user] = await Promise.all([
    prisma.globalMemory.upsert({ where: { id: GLOBAL_MEMORY_ID }, update: {}, create: { id: GLOBAL_MEMORY_ID, content: globalSeed } }),
    prisma.userMemory.findUnique({ where: { userId } })
  ]);
  return { global: global.content, user: user?.content || DEFAULT_USER_MEMORY };
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { const value = JSON.parse(raw.slice(start, end + 1)); return value && typeof value === "object" ? value : null; }
  catch { return null; }
}

const MEMORY_CUE = /\b(remember|don't forget|do not forget|from now on|going forward|always|i prefer|i like|my name is|i work as|i study|i am learning|i'm learning|i am building|i'm building|i am working on|i'm working on|my goal is|i use|i'm using|save this|keep in mind)\b|\b(ingat|jangan lupa|mulai sekarang|ke depannya|selalu|saya lebih suka|aku lebih suka|saya suka|aku suka|nama saya|catat ini|simpan ini|saya ingin belajar|aku ingin belajar|saya sedang belajar|aku sedang belajar|saya sedang membuat|saya sedang mengembangkan|saya sedang mengerjakan|saya menggunakan|aku menggunakan|saya memakai|aku memakai|saya adalah|aku adalah|saya seorang|aku seorang|saya lebih nyaman|saya kurang suka|saya tidak suka|aku tidak suka|tujuan saya|biasanya saya|preferensi saya)\b/i;
const GLOBAL_CUE = /\b(global memory|memori global|for all users|for everyone|all LearnGPT users|everyone using LearnGPT)\b|\b(untuk semua pengguna|untuk semua user|semua pengguna LearnGPT|seluruh pengguna LearnGPT)\b/i;

function looksSensitive(value: string) {
  return /\b(password|passphrase|api[_ -]?key|access token|refresh token|secret key|rekening|nomor kartu|credit card|bank account|passport|national id|social security|diagnosis|disease|medical|health|pregnan|disability|obat|penyakit|agama|religion|partai politik|political party|orientasi seksual|sexual orientation|race|ethnicity|ras|etnis|home address|street address|alamat rumah|precise location|gps coordinates)\b/i.test(value);
}

/** Store private memory in the authenticated user's database record, never in a shared project file. */
export async function updateMemoryFromConversation(args: {
  userId: string;
  model: string;
  chatCompletion: (model: string, messages: { role: "system" | "user"; content: string }[]) => Promise<string>;
  messages: { role: "user" | "assistant"; content: string }[];
}) {
  const lastUserMessage = [...args.messages].reverse().find((message) => message.role === "user")?.content || "";
  const updateGlobal = GLOBAL_CUE.test(lastUserMessage);
  const updateUser = MEMORY_CUE.test(lastUserMessage) && !updateGlobal;
  if (!updateUser && !updateGlobal) return;

  const current = await loadMemoryContext(args.userId);
  const transcript = args.messages.slice(-8).map((message) => `${message.role}: ${message.content.slice(0, 2500)}`).join("\n\n");
  const prompt = `Review this recent conversation and return strict JSON only: {"userMemory": string|null, "globalMemory": string|null}.\n\nPrivate user memory (logical path: user/${args.userId}/USER.md):\n${current.user}\n\nGlobal memory (MEMORY.md):\n${current.global}\n\nRecent conversation:\n${transcript}\n\nRules:\n- User memory belongs only to the signed-in account represented by userId ${args.userId}. Update it only with durable facts/preferences explicitly stated by that person. Preserve useful details and remove corrected outdated details. Return null when there is nothing durable to add. Never store credentials, sensitive personal data, precise location, or guesses.\n- Global memory is shared across every account. Update it only if the user's latest message explicitly asks for a rule to apply to all LearnGPT users. Never include an individual user's identity, preferences, projects, chat details, or private information. Return null without an explicit shared rule.\n- Return each non-null field as the complete updated Markdown document, not a fragment. Keep each document under 6,000 characters.`;

  try {
    const raw = await args.chatCompletion(args.model, [
      { role: "system", content: "You maintain concise, privacy-conscious Markdown memory documents. Follow every boundary exactly. Output one valid JSON object and nothing else." },
      { role: "user", content: prompt }
    ]);
    const parsed = parseJsonObject(raw);
    if (!parsed) return;
    const userMemory = typeof parsed.userMemory === "string" ? parsed.userMemory.trim() : "";
    const globalMemory = typeof parsed.globalMemory === "string" ? parsed.globalMemory.trim() : "";
    if (updateUser && userMemory.startsWith("#") && userMemory.length <= 6000 && !looksSensitive(userMemory)) {
      await prisma.userMemory.upsert({ where: { userId: args.userId }, update: { content: userMemory }, create: { userId: args.userId, content: userMemory } });
    }
    if (updateGlobal && globalMemory.startsWith("#") && globalMemory.length <= 6000 && !looksSensitive(globalMemory)) {
      await prisma.globalMemory.upsert({ where: { id: GLOBAL_MEMORY_ID }, update: { content: globalMemory }, create: { id: GLOBAL_MEMORY_ID, content: globalMemory } });
    }
  } catch {
    // Memory maintenance must never turn a successful chat into a failed response.
  }
}
