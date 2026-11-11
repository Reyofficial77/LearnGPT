import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "../../../../../lib/prisma";
import { createSession, publicUser } from "../../../../../lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code : "";
    if (!/^[A-Za-z0-9_-]{40,50}$/.test(code)) {
      return NextResponse.json({ error: "Invalid or expired sign-in code." }, { status: 400 });
    }

    const token = createHash("sha256").update(code).digest("hex");
    const handoff = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!handoff || handoff.expiresAt <= new Date()) {
      if (handoff) await prisma.session.deleteMany({ where: { id: handoff.id } });
      return NextResponse.json({ error: "This sign-in link has expired. Please try again." }, { status: 401 });
    }

    const consumed = await prisma.session.deleteMany({
      where: { id: handoff.id, token, expiresAt: { gt: new Date() } }
    });
    if (consumed.count !== 1) {
      return NextResponse.json({ error: "This sign-in link has already been used." }, { status: 401 });
    }

    await createSession(handoff.userId);
    const response = NextResponse.json({ user: publicUser(handoff.user) });
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
    return response;
  } catch {
    return NextResponse.json({ error: "Desktop sign-in could not be completed. Please try again." }, { status: 500 });
  }
}
