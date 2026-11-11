import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";

const HANDOFF_TTL_MS = 2 * 60 * 1000;

export async function createDesktopHandoff(userId: string) {
  const code = randomBytes(32).toString("base64url");
  const token = createHash("sha256").update(code).digest("hex");
  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + HANDOFF_TTL_MS)
    }
  });
  return code;
}
