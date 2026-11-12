import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSessionUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

// Serves an AI-generated image. Only its owner can open it, unless the chat it belongs to is shared publicly.
// Add ?download=1 to get it as a file instead of showing it inline.
export async function GET(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const notFound = () => NextResponse.json({ error: "Image not found." }, { status: 404 });
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return notFound();
  const image = await prisma.generatedImage.findUnique({
    where: { id },
    select: { id: true, userId: true, mimeType: true, data: true, chat: { select: { isPublic: true } } }
  });
  if (!image) return notFound();
  const isPublic = image.chat?.isPublic === true;
  if (!isPublic) {
    const user = await getSessionUser();
    if (!user || user.id !== image.userId) return notFound();
  }
  const extension = EXTENSIONS[image.mimeType] || "png";
  const filename = `learngpt-image-${image.id.slice(-8)}.${extension}`;
  const download = request.nextUrl.searchParams.get("download") === "1";
  const body = new Uint8Array(image.data);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": isPublic ? "public, max-age=3600" : "private, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
