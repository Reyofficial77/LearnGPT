import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${new URL(request.url).origin}/api/auth/google/callback`;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) return NextResponse.redirect(new URL("/auth/login?error=google_not_configured", request.url));
  const state = randomBytes(32).toString("hex");
  const verifier = randomBytes(48).toString("base64url");
  const challengeBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = Buffer.from(challengeBuffer).toString("base64url");
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, code_challenge: challenge, code_challenge_method: "S256", access_type: "offline", prompt: "select_account" });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set("learngpt_google_oauth", JSON.stringify({ state, verifier }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return response;
}
