import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSessionUser } from "../../../../lib/server-auth";
export const runtime = "nodejs";

// Deleting a project also deletes its chats and their messages (ON DELETE CASCADE).
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
