import { NextRequest, NextResponse } from "next/server";
import { deflateRawSync } from "node:zlib";
import { getSessionUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function dosDateTime(date: Date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = (date.getFullYear() - 1980 << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: day };
}
function makeZip(files: { path: string; content: string }[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const stamp = dosDateTime(new Date());
  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const raw = Buffer.from(file.content, "utf8");
    const compressed = deflateRawSync(raw, { level: 6 });
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(stamp.time, 10); local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(stamp.time, 12); central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralDirectory.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}
function safePath(value: string) {
  const path = value.replace(/\\/g, "/").replace(/^\.\//, "");
  const segments = path.split("/");
  if (!path || path.startsWith("/") || /^[a-z]:/i.test(path) || segments.some((part) => !part || part === "." || part === "..")) return null;
  if (segments.some((part) => part.length > 120) || path.length > 240) return null;
  return path;
}
function safeName(value: string) {
  const name = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  return name && name !== "." && name !== ".." ? name : "learngpt-project";
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { name?: unknown; files?: unknown } | null;
  if (!body || !body.files || typeof body.files !== "object" || Array.isArray(body.files)) return NextResponse.json({ error: "Project manifest must contain a files object." }, { status: 400 });
  const entries = Object.entries(body.files as Record<string, unknown>);
  if (!entries.length || entries.length > 80) return NextResponse.json({ error: "A project must contain between 1 and 80 files." }, { status: 400 });
  const seen = new Set<string>();
  const files: { path: string; content: string }[] = [];
  let totalBytes = 0;
  for (const [rawPath, value] of entries) {
    const path = safePath(rawPath);
    if (!path || typeof value !== "string") return NextResponse.json({ error: `Invalid project file: ${rawPath.slice(0, 80)}` }, { status: 400 });
    if (seen.has(path)) return NextResponse.json({ error: `Duplicate project file: ${path}` }, { status: 400 });
    seen.add(path);
    totalBytes += Buffer.byteLength(value, "utf8");
    if (totalBytes > 12_000_000) return NextResponse.json({ error: "The generated project is larger than 12 MB. Split it into smaller downloads." }, { status: 413 });
    files.push({ path, content: value });
  }
  const name = safeName(typeof body.name === "string" ? body.name : "learngpt-project");
  const zip = makeZip(files);
  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(zip.length),
      "Content-Disposition": `attachment; filename="${name}.zip"; filename*=UTF-8''${encodeURIComponent(`${name}.zip`)}`,
      "Cache-Control": "private, no-store"
    }
  });
}
