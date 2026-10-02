import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { createSession } from "../../../../../lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookie = request.headers.get("cookie")?.match(/(?:^|; )learngpt_google_oauth=([^;]+)/)?.[1];
  if (error) return NextResponse.redirect(new URL("/auth/login?error=google_cancelled", request.url));
  if (!code || !state || !cookie) return NextResponse.redirect(new URL("/auth/login?error=google_invalid_state", request.url));
  let oauth: { state: string; verifier: string };
  try { oauth = JSON.parse(decodeURIComponent(cookie)); } catch { return NextResponse.redirect(new URL("/auth/login?error=google_invalid_state", request.url)); }
  if (oauth.state !== state) return NextResponse.redirect(new URL("/auth/login?error=google_invalid_state", request.url));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.redirect(new URL("/auth/login?error=google_not_configured", request.url));
  try {
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: oauth.verifier }) });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) throw new Error("Google token exchange failed.");
    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const profile = await userResponse.json();
    if (!userResponse.ok || !profile.sub || !profile.email) throw new Error("Could not read Google profile.");
    const existing = await prisma.user.findFirst({ where: { OR: [{ provider: "google", providerId: String(profile.sub) }, { email: String(profile.email).toLowerCase() }] } });
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { provider: "google", providerId: String(profile.sub), email: String(profile.email).toLowerCase(), name: profile.name || profile.email, avatar: profile.picture || null } })
      : await prisma.user.create({ data: { provider: "google", providerId: String(profile.sub), email: String(profile.email).toLowerCase(), name: profile.name || profile.email, avatar: profile.picture || null } });
    await createSession(user.id);
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set("learngpt_google_oauth", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return response;
  } catch (e) { return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(e instanceof Error ? e.message : "google_failed")}`, request.url)); }
}
