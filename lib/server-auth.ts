import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "./prisma";
const COOKIE = "learngpt_session";
const DAYS = 30;
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + DAYS * 86400000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV === "production", path:"/", expires:expiresAt });
  return token;
}
export async function getSessionUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where:{ token }, include:{ user:true } });
  if (!session) return null;
  if (session.expiresAt < new Date()) { await prisma.session.delete({ where:{ id:session.id } }).catch(()=>{}); return null; }
  return session.user;
}
export async function destroySession() {
  const jar = await cookies(); const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where:{ token } });
  jar.set(COOKIE, "", { httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV === "production", path:"/", maxAge:0 });
}
export function publicUser(user:any) { return { id:user.id, provider:user.provider || "email", name:user.name, email:user.email, avatar:user.avatar || undefined }; }
