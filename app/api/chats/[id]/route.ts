import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSessionUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_: NextRequest, { params }: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const chat = await prisma.chat.findFirst({ where: { id, userId: user.id } });
  if (!chat) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  await prisma.chat.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const payload = await req.json().catch(() => ({}));
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const existing = await prisma.chat.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  const data: { title?: string; pinned?: boolean; isPublic?: boolean } = {};
  if (typeof body.title === "string") {
    const title = body.title.trim().slice(0, 80);
    if (!title) return NextResponse.json({ error: "Chat title cannot be empty." }, { status: 400 });
    data.title = title;
  }
  if (typeof body.pinned === "boolean") data.pinned = body.pinned;
  if (typeof body.isPublic === "boolean") data.isPublic = body.isPublic;
  if (!Object.keys(data).length) return NextResponse.json({ error: "No supported changes were provided." }, { status: 400 });
  const chat = await prisma.chat.update({ where: { id }, data });
  return NextResponse.json({ chat });
}
