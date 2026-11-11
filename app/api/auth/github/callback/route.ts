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
  response.cookies.set("learngpt_github_oauth", "", {
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
  const cookie = request.headers.get("cookie")?.match(/(?:^|; )learngpt_github_oauth=([^;]+)/)?.[1];

  let oauth: { state: string; verifier: string; desktop?: boolean } | null = null;
  try {
    if (cookie) oauth = JSON.parse(decodeURIComponent(cookie));
  } catch {
    oauth = null;
  }
  const desktop = oauth?.desktop === true;

  if (url.searchParams.has("error")) return clearOAuthCookie(failure(request, "github_cancelled", desktop));
  if (!code || !state || !oauth || oauth.state !== state) {
    return clearOAuthCookie(failure(request, "github_invalid_state", desktop));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return clearOAuthCookie(failure(request, "github_not_configured", desktop));
  }

  try {
    const redirectUri = `${url.origin}/api/auth/github/callback`;
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: oauth.verifier,
        redirect_uri: redirectUri
      }),
      cache: "no-store"
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) {
      return clearOAuthCookie(failure(request, "github_token_exchange_failed", desktop));
    }

    const headers = {
      Authorization: `Bearer ${token.access_token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    const [profileResponse, emailsResponse] = await Promise.all([
      fetch("https://api.github.com/user", { headers, cache: "no-store" }),
      fetch("https://api.github.com/user/emails", { headers, cache: "no-store" })
    ]);
    const profile = await profileResponse.json();
    const emails = emailsResponse.ok ? await emailsResponse.json() : [];
    if (!profileResponse.ok || !profile.id || !Array.isArray(emails)) {
      return clearOAuthCookie(failure(request, "github_profile_unavailable", desktop));
    }

    const verifiedEmail = emails.find((item: any) => item.primary === true && item.verified === true)
      || emails.find((item: any) => item.verified === true);
    if (!verifiedEmail?.email) {
      return clearOAuthCookie(failure(request, "github_verified_email_required", desktop));
    }

    const providerId = String(profile.id);
    const email = String(verifiedEmail.email).trim().toLowerCase();
    const existingByProvider = await prisma.user.findFirst({ where: { provider: "github", providerId } });
    const existingByEmail = existingByProvider ? null : await prisma.user.findUnique({ where: { email } });
    if (existingByEmail?.provider && existingByEmail.provider !== "email" && existingByEmail.provider !== "github") {
      return clearOAuthCookie(failure(request, "account_uses_another_provider", desktop));
    }

    const existing = existingByProvider || existingByEmail;
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            provider: "github",
            providerId,
            email,
            name: String(profile.name || profile.login || email),
            avatar: profile.avatar_url || null
          }
        })
      : await prisma.user.create({
          data: {
            directoryId: await generateUserDirectoryId(),
            provider: "github",
            providerId,
            email,
            name: String(profile.name || profile.login || email),
            avatar: profile.avatar_url || null
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
    return clearOAuthCookie(failure(request, "github_sign_in_failed", desktop));
  }
}
