import { GeminiError } from "./gemini";

// Gemma (the chat models) cannot draw. Images come from a Gemini image model on the same API key.
const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";
const IMAGE_TIMEOUT_MS = 120_000;
const MAX_IMAGE_BYTES = 8_000_000;
const ASPECT_RATIOS = new Set(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]);

export type ImageRef = { mimeType: string; data: string };
export type ImageRequest = { prompt: string; aspectRatio?: string; editLast: boolean; caption: string };
export type GeneratedPicture = { mimeType: string; data: Buffer };

export function resolveImageModel() {
  return process.env.GEMINI_MODEL_IMAGE?.trim() || DEFAULT_IMAGE_MODEL;
}

// The chat model asks for an image by answering with one fenced "generate-image" block (see lib/ai-instructions.ts).
const BLOCK_RE = /```generate-image[^\n]*\n([\s\S]*?)(?:```|$)/i;

/** Finds the model's image request. Returns the cleaned prompt plus the text written around the block. */
export function extractImageRequest(text: string): ImageRequest | null {
  const match = BLOCK_RE.exec(text);
  if (!match) return null;
  let aspectRatio: string | undefined;
  let editLast = false;
  const promptLines: string[] = [];
  for (const line of match[1].split(/\r?\n/)) {
    const ratio = /^\s*ratio\s*:\s*(\d{1,2}:\d{1,2})\s*$/i.exec(line);
    if (ratio && !promptLines.length) { if (ASPECT_RATIOS.has(ratio[1])) aspectRatio = ratio[1]; continue; }
    const edit = /^\s*edit\s*:\s*last\s*$/i.exec(line);
    if (edit && !promptLines.length) { editLast = true; continue; }
    promptLines.push(line);
  }
  const prompt = promptLines.join("\n").trim().slice(0, 4000);
  if (!prompt) return null;
  const caption = (text.slice(0, match.index) + text.slice(match.index + match[0].length)).replace(/\n{3,}/g, "\n\n").trim();
  return { prompt, aspectRatio, editLast, caption };
}

/** Creates one image. References (attached or previous images) let the model edit instead of draw from scratch. */
export async function generateImage(prompt: string, references: ImageRef[] = [], aspectRatio?: string): Promise<GeneratedPicture> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiError("The AI service is not configured yet. Please contact the site owner.", 503);
  const model = resolveImageModel();
  const parts = [{ text: prompt }, ...references.slice(0, 4).map((ref) => ({ inlineData: { mimeType: ref.mimeType, data: ref.data } }))];

  const request = (withAspectRatio: boolean) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], ...(withAspectRatio && aspectRatio ? { imageConfig: { aspectRatio } } : {}) }
    }),
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS)
  });

  let response: Response;
  try {
    response = await request(true);
    // Some image models reject imageConfig; the picture is still better than an error, so retry once without it.
    if (response.status === 400 && aspectRatio) response = await request(false);
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new GeminiError("Creating the image took too long. Please try again.", 504);
    throw new GeminiError("Could not reach the image service. Please try again.", 502);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data?.error?.message === "string" ? data.error.message : "";
    throw new GeminiError(detail || `The image service returned an error (${response.status}).`, response.status);
  }

  const candidateParts: any[] = Array.isArray(data?.candidates?.[0]?.content?.parts) ? data.candidates[0].content.parts : [];
  const inline = candidateParts.map((part) => part?.inlineData || part?.inline_data).find((item) => item && typeof item.data === "string" && item.data);
  if (!inline) {
    const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
    const said = candidateParts.filter((part) => typeof part?.text === "string").map((part) => part.text).join(" ").trim();
    const blocked = reason && !/^STOP$/i.test(String(reason));
    throw new GeminiError(said || (blocked ? `The image request was blocked (${reason}). Try a different description.` : "No image was returned. Try describing it differently."), 502);
  }
  const bytes = Buffer.from(inline.data, "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new GeminiError("The generated image was empty or too large. Please try again.", 502);
  const mimeType = typeof (inline.mimeType || inline.mime_type) === "string" && /^image\/(png|jpeg|webp)$/i.test(inline.mimeType || inline.mime_type) ? String(inline.mimeType || inline.mime_type).toLowerCase() : "image/png";
  return { mimeType, data: bytes };
}
