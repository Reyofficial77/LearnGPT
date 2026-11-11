import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { createSession } from "../../../../../lib/server-auth";
import { createDesktopHandoff } from "../../../../../lib/desktop-oauth";
import { generateUserDirectoryId } from "../../../../../lib/user-directory";

export const runtime = "nodejs";

function failure(request: Request, code: string, desktop = false) {
  if (desktop) return NextResponse.redirect(`learngpt://auth/callback?error=${encodeURIComponent(code)}`);
  return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(code)}`, request.url));
}

function clearOAuthCookie(response: NextResponse) {
  response.cookies.set("learngpt_google_oauth", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("cookie")?.match(/(?:^|; )learngpt_google_oauth=([^;]+)/)?.[1];

  let oauth: { state: string; verifier: string; desktop?: boolean } | null = null;
  try {
    if (cookie) oauth = JSON.parse(decodeURIComponent(cookie));
  } catch {
    oauth = null;
  }
  const desktop = oauth?.desktop === true;

  if (url.searchParams.has("error")) return clearOAuthCookie(failure(request, "google_cancelled", desktop));
  if (!code || !state || !oauth || oauth.state !== state) {
    return clearOAuthCookie(failure(request, "google_invalid_state", desktop));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return clearOAuthCookie(failure(request, "google_not_configured", desktop));
  }

  try {
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: oauth.verifier
      }),
      cache: "no-store"
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) {
      return clearOAuthCookie(failure(request, "google_token_exchange_failed", desktop));
    }

    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store"
    });
    const profile = await userResponse.json();
    if (!userResponse.ok || !profile.sub || !profile.email || profile.email_verified !== true) {
      return clearOAuthCookie(failure(request, "google_profile_not_verified", desktop));
    }

    const providerId = String(profile.sub);
    const email = String(profile.email).trim().toLowerCase();
    const existingByProvider = await prisma.user.findFirst({ where: { provider: "google", providerId } });
    const existingByEmail = existingByProvider ? null : await prisma.user.findUnique({ where: { email } });
    if (existingByEmail?.provider && existingByEmail.provider !== "email" && existingByEmail.provider !== "google") {
      return clearOAuthCookie(failure(request, "account_uses_another_provider", desktop));
    }

    const existing = existingByProvider || existingByEmail;
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            provider: "google",
            providerId,
            email,
            name: String(profile.name || email),
            avatar: profile.picture || null
          }
        })
      : await prisma.user.create({
          data: {
            directoryId: await generateUserDirectoryId(),
            provider: "google",
            providerId,
            email,
            name: String(profile.name || email),
            avatar: profile.picture || null
          }
        });

    if (desktop) {
      const handoffCode = await createDesktopHandoff(user.id);
      const response = NextResponse.redirect(`learngpt://auth/callback?code=${encodeURIComponent(handoffCode)}`);
      return clearOAuthCookie(response);
    }

    await createSession(user.id);
    return clearOAuthCookie(NextResponse.redirect(new URL("/", request.url)));
  } catch {
    return clearOAuthCookie(failure(request, "google_sign_in_failed", desktop));
  }
}
