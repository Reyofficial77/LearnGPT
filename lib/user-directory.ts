import { randomInt } from "node:crypto";
import { prisma } from "./prisma";

/** Allocates an unguessable-looking, account-scoped 8-digit directory key. Never expose it in client/session payloads. */
export async function generateUserDirectoryId(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = String(randomInt(10_000_000, 100_000_000));
    const existing = await prisma.user.findUnique({ where: { directoryId: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  throw new Error("Could not allocate an account directory.");
}

export async function ensureUserDirectoryId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { directoryId: true } });
  if (user?.directoryId) return user.directoryId;
  const directoryId = await generateUserDirectoryId();
  const updated = await prisma.user.update({ where: { id: userId }, data: { directoryId } , select: { directoryId: true } });
  return updated.directoryId;
}
