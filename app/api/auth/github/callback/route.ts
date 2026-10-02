import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { createSession } from "../../../../../lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookie = request.headers.get("cookie")?.match(/(?:^|; )learngpt_github_oauth=([^;]+)/)?.[1];
  if (error) return NextResponse.redirect(new URL("/auth/login?error=github_cancelled", request.url));
  if (!code || !state || !cookie) return NextResponse.redirect(new URL("/auth/login?error=github_invalid_state", request.url));
  let oauth: { state: string; verifier: string };
  try { oauth = JSON.parse(decodeURIComponent(cookie)); } catch { return NextResponse.redirect(new URL("/auth/login?error=github_invalid_state", request.url)); }
  if (oauth.state !== state) return NextResponse.redirect(new URL("/auth/login?error=github_invalid_state", request.url));
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.redirect(new URL("/auth/login?error=github_not_configured", request.url));
  try {
    const redirectUri = `${url.origin}/api/auth/github/callback`;
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, code_verifier: oauth.verifier, redirect_uri: redirectUri }) });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.error_description || "GitHub token exchange failed.");
    const headers = { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    const profileResponse = await fetch("https://api.github.com/user", { headers });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.id) throw new Error("Could not read GitHub profile.");
    let email = profile.email || "";
    if (!email) { const emailsResponse = await fetch("https://api.github.com/user/emails", { headers }); if (emailsResponse.ok) { const emails = await emailsResponse.json(); email = emails.find((x: any) => x.primary && x.verified)?.email || emails.find((x: any) => x.verified)?.email || ""; } }
    if (!email) throw new Error("GitHub did not provide a verified email address.");
    email = String(email).toLowerCase();
    const existing = await prisma.user.findFirst({ where: { OR: [{ provider: "github", providerId: String(profile.id) }, { email }] } });
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { provider: "github", providerId: String(profile.id), email, name: profile.name || profile.login, avatar: profile.avatar_url || null } })
      : await prisma.user.create({ data: { provider: "github", providerId: String(profile.id), email, name: profile.name || profile.login, avatar: profile.avatar_url || null } });
    await createSession(user.id);
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set("learngpt_github_oauth", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return response;
  } catch (e) { return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(e instanceof Error ? e.message : "github_failed")}`, request.url)); }
}
