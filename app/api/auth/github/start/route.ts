import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId || !process.env.GITHUB_CLIENT_SECRET) return NextResponse.redirect(new URL("/auth/login?error=github_not_configured", request.url));
  const state = randomBytes(32).toString("hex");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))).toString("base64url");
  const redirectUri = `${new URL(request.url).origin}/api/auth/github/callback`;
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: "read:user user:email", state, code_challenge: challenge, code_challenge_method: "S256" });
  const response = NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`);
  response.cookies.set("learngpt_github_oauth", JSON.stringify({ state, verifier }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return response;
}
