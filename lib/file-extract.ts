import { randomUUID } from "node:crypto";
import { inflateRawSync, inflateSync } from "node:zlib";

export type ExtractedAttachment = { id: string; name: string; mimeType: string; size: number; extractedText: string };

type IncomingAttachment = { id?: unknown; name?: unknown; mimeType?: unknown; size?: unknown; dataUrl?: unknown; extractedText?: unknown };

const MAX_FILE_BYTES = 1_000_000;
const MAX_TEXT_CHARS = 40_000;
const SUPPORTED_EXTENSIONS = new Set(["pdf", "docx", "txt", "md", "csv", "json", "html", "htm", "css", "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "h", "sql", "sh", "yaml", "yml", "xml", "log", "ini", "toml", "go", "rs", "rb", "php", "cs"]);
const TEXT_EXTENSIONS = new Set([...SUPPORTED_EXTENSIONS].filter((ext) => ext !== "pdf" && ext !== "docx"));

function safeExtension(name: string, mimeType: string) {
  const fromName = name.split(".").pop()?.toLowerCase() || "";
  if (SUPPORTED_EXTENSIONS.has(fromName)) return fromName;
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mimeType === "text/markdown") return "md";
  if (mimeType === "text/csv") return "csv";
  if (mimeType === "application/json") return "json";
  if (mimeType.startsWith("text/")) return "txt";
  return "";
}

function decodePdfLiteral(value: string) {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char !== "\\") { out += char; continue; }
    const next = value[++i];
    if (next === undefined) break;
    if (/[0-7]/.test(next)) {
      let octal = next;
      for (let j = 0; j < 2 && /[0-7]/.test(value[i + 1] || ""); j++) octal += value[++i];
      out += String.fromCharCode(parseInt(octal, 8));
    } else {
      const escaped: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
      if (next === "\r" && value[i + 1] === "\n") i++;
      else if (next !== "\r" && next !== "\n") out += escaped[next] ?? next;
    }
  }
  return out;
}

function pdfLiteralStrings(content: string) {
  const strings: string[] = [];
  for (let i = 0; i < content.length; i++) {
    if (content[i] !== "(") continue;
    let depth = 1, start = ++i, value = "";
    while (i < content.length && depth > 0) {
      const char = content[i];
      if (char === "\\") { value += char; i++; if (i < content.length) value += content[i]; i++; continue; }
      if (char === "(") depth++;
      if (char === ")") { depth--; if (depth === 0) break; }
      value += char; i++;
    }
    if (depth === 0 && i >= start) strings.push(decodePdfLiteral(value));
  }
  return strings;
}

function extractPdfText(buffer: Buffer) {
  const source = buffer.toString("latin1");
  const pages: string[] = [];
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of source.matchAll(streamPattern)) {
    const index = match.index ?? 0;
    const dictStart = source.lastIndexOf("<<", index);
    const dictionary = source.slice(Math.max(0, dictStart), index);
    let stream = Buffer.from(match[1], "latin1");
    if (/\/FlateDecode/.test(dictionary)) { try { stream = inflateSync(stream, { maxOutputLength: 10_000_000 }); } catch { continue; } }
    const content = stream.toString("latin1");
    for (const block of content.matchAll(/BT([\s\S]*?)ET/g)) {
      const textBlock = block[1];
      const tokens = pdfLiteralStrings(textBlock);
      const hexStrings = [...textBlock.matchAll(/<([0-9a-fA-F\s]{4,})>\s*Tj/g)].map((item) => {
        const hex = item[1].replace(/\s/g, "");
        if (hex.length % 4 === 0) {
          const decoded: string[] = [];
          for (let i = 0; i < hex.length; i += 4) decoded.push(String.fromCharCode(parseInt(hex.slice(i, i + 4), 16)));
          return decoded.join("");
        }
        return "";
      });
      if (tokens.length || hexStrings.length) pages.push([...tokens, ...hexStrings].join(" "));
    }
  }
  return pages.join("\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").trim();
}

function findZipEntry(buffer: Buffer, target: string): Buffer | null {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const entries = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < entries && cursor + 46 <= buffer.length; i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) return null;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    if (name === target) {
      if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) return null;
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      try { return method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed, { maxOutputLength: 10_000_000 }) : null; }
      catch { return null; }
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

function extractDocxText(buffer: Buffer) {
  const xml = findZipEntry(buffer, "word/document.xml")?.toString("utf8");
  if (!xml) return "";
  return xml
    .replace(/<w:tab\s*\/>/g, "\t")
    .replace(/<w:br\s*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g, (_match, value: string) => value)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .trim();
}

function decodeDataUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^data:[^;,]+;base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  try { return Buffer.from(match[1], "base64"); } catch { return null; }
}

export function extractAttachment(input: IncomingAttachment): ExtractedAttachment | null {
  const originalName = typeof input.name === "string" ? input.name : "attachment.txt";
  const mimeType = typeof input.mimeType === "string" ? input.mimeType : "application/octet-stream";
  const ext = safeExtension(originalName, mimeType);
  if (!ext) throw new Error("Unsupported file type. Upload PDF, DOCX, text, data, or code files.");
  const buffer = decodeDataUrl(input.dataUrl);
  if (!buffer) return null;
  if (buffer.length > MAX_FILE_BYTES) throw new Error("Each document or file must be 1 MB or smaller.");

  let extractedText = "";
  if (ext === "pdf") extractedText = extractPdfText(buffer);
  else if (ext === "docx") extractedText = extractDocxText(buffer);
  else if (TEXT_EXTENSIONS.has(ext)) extractedText = buffer.toString("utf8").replace(/^\uFEFF/, "");
  if (!extractedText.trim()) extractedText = ext === "pdf" ? "No selectable text was found in this PDF. It may be a scanned document; ask the user to upload relevant pages as images." : "No readable text was found in this file.";
  extractedText = extractedText.slice(0, MAX_TEXT_CHARS);
  return { id: randomUUID(), name: `attachment-${randomUUID().slice(0, 8)}.${ext}`, mimeType, size: buffer.length, extractedText };
}

export function textFromAttachment(attachment: ExtractedAttachment) {
  return `\n\n--- Attached file: ${attachment.name} (${attachment.mimeType}) ---\n${attachment.extractedText}\n--- End of ${attachment.name} ---`;
}
