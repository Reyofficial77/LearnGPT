import { NextRequest, NextResponse } from "next/server";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { prisma } from "../../../lib/prisma";
import { getSessionUser } from "../../../lib/server-auth";
import { ensureUserDirectoryId } from "../../../lib/user-directory";

export const runtime = "nodejs";
const MAX_SKILL_BYTES = 64 * 1024;
const MAX_SKILLS = 20;
const BUILT_IN = { slug: "frontend-design", name: "Frontend design", builtIn: true } as const;

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === request.nextUrl.origin; } catch { return false; }
}
function cleanSkillName(value: string) {
  return value.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);
}
function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "");
}
function getSkillName(content: string, requested: string) {
  const custom = cleanSkillName(requested);
  if (custom) return custom;
  const heading = content.match(/^#\s+(.+)$/m)?.[1] || "";
  return cleanSkillName(heading);
}
async function writeSkillFile(directoryId: string, slug: string, content: string) {
  if (!/^\d{8}$/.test(directoryId) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return;
  const root = resolve(process.cwd(), "users", directoryId, "Skill");
  const folder = resolve(root, slug);
  const rel = relative(root, folder);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Invalid skill path.");
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "SKILL.md"), content, { encoding: "utf8", mode: 0o600 });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const skills = await prisma.userSkill.findMany({ where: { userId: user.id }, select: { id: true, name: true, slug: true, createdAt: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ skills: [{ ...BUILT_IN, id: "builtin-frontend-design" }, ...skills.map((skill) => ({ ...skill, builtIn: false }))] });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_SKILL_BYTES + 32_000) return NextResponse.json({ error: "Skill files must be 64 KB or smaller." }, { status: 413 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a Markdown skill file." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".md")) return NextResponse.json({ error: "Only .md files are supported." }, { status: 415 });
    if (file.size < 1 || file.size > MAX_SKILL_BYTES) return NextResponse.json({ error: "Skill files must be between 1 byte and 64 KB." }, { status: 413 });
    const content = (await file.text()).replace(/^\uFEFF/, "").trim();
    if (!content || content.length > MAX_SKILL_BYTES || content.includes("\u0000")) return NextResponse.json({ error: "The Markdown file is empty or invalid." }, { status: 400 });
    const name = getSkillName(content, String(form.get("name") || ""));
    const slug = slugify(name);
    if (!slug) return NextResponse.json({ error: "Enter a skill name or add a first-level Markdown heading (# Skill name)." }, { status: 400 });
    if (slug === BUILT_IN.slug) return NextResponse.json({ error: "This name is reserved for the built-in skill." }, { status: 409 });
    const count = await prisma.userSkill.count({ where: { userId: user.id } });
    if (count >= MAX_SKILLS) return NextResponse.json({ error: `You can save up to ${MAX_SKILLS} custom skills.` }, { status: 409 });
    const skill = await prisma.userSkill.create({ data: { userId: user.id, name, slug, content } });
    const directoryId = await ensureUserDirectoryId(user.id);
    try { await writeSkillFile(directoryId, slug, content); } catch { /* Postgres remains the durable source on read-only/serverless hosts. */ }
    return NextResponse.json({ skill: { id: skill.id, name: skill.name, slug: skill.slug, createdAt: skill.createdAt, builtIn: false } }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "A skill with this name already exists." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save the skill." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug === BUILT_IN.slug) return NextResponse.json({ error: "Invalid custom skill." }, { status: 400 });
  const skill = await prisma.userSkill.findFirst({ where: { userId: user.id, slug }, select: { id: true } });
  if (!skill) return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  await prisma.userSkill.delete({ where: { id: skill.id } });
  try {
    const directoryId = await ensureUserDirectoryId(user.id);
    const root = resolve(process.cwd(), "users", directoryId, "Skill");
    const folder = resolve(root, slug);
    const rel = relative(root, folder);
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) await rm(folder, { recursive: true, force: true });
  } catch { /* The database deletion is authoritative. */ }
  return NextResponse.json({ ok: true });
}
