import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSessionUser } from "../../../lib/server-auth";
import { isReservedSlug, slugify } from "../../../lib/slug";
export const runtime = "nodejs";

const NAME_MAX = 60;
const GOAL_MAX = 300;
const publicProject = (p: { id: string; name: string; goal: string; slug: string }) => ({ id: p.id, name: p.name, goal: p.goal, slug: p.slug });

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projects = await prisma.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ projects: projects.map(publicProject) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
    const goal = String(body.goal ?? "").trim().slice(0, GOAL_MAX);
    if (!name || !goal) return NextResponse.json({ error: "Project name and goal are required." }, { status: 400 });

    // The slug is the first URL segment of the project's chats (/{slug}/{chat-id}).
    // It is unique per user and never one of the app's own top-level paths.
    const base = slugify(name);
    for (let attempt = 1; attempt <= 30; attempt++) {
      const suffix = attempt === 1 ? "" : `-${attempt}`;
      const slug = `${base.slice(0, 47 - suffix.length)}${suffix}`;
      if (isReservedSlug(slug)) continue;
      try {
        const project = await prisma.project.create({ data: { userId: user.id, name, goal, slug } });
        return NextResponse.json({ project: publicProject(project) });
      } catch (e: any) {
        if (e?.code !== "P2002") throw e; // slug already used by this user -> try the next suffix
      }
    }
    return NextResponse.json({ error: "Could not create a unique address for this project." }, { status: 409 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create project." }, { status: 500 });
  }
}
