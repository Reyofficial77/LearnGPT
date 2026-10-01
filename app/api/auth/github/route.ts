import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code || "");
    const verifier = String(body.codeVerifier || "");
    const redirectUri = String(body.redirectUri || "");
    const clientId = process.env.GITHUB_CLIENT_ID || process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "";
    const clientSecret = process.env.GITHUB_CLIENT_SECRET || "";

    if (!code || !verifier || !redirectUri) {
      return NextResponse.json({ error: "Missing GitHub OAuth parameters." }, { status: 400 });
    }
    if (!clientId) {
      return NextResponse.json({ error: "GITHUB_CLIENT_ID is not configured on the server." }, { status: 500 });
    }
    if (!clientSecret) {
      return NextResponse.json({ error: "GITHUB_CLIENT_SECRET is not configured on the server." }, { status: 500 });
    }

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri
      })
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) {
      return NextResponse.json(
        { error: token.error_description || "GitHub authorization failed." },
        { status: 400 }
      );
    }

    const headers = {
      Authorization: `Bearer ${token.access_token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    const userResponse = await fetch("https://api.github.com/user", { headers });
    const me = await userResponse.json();
    if (!userResponse.ok) {
      return NextResponse.json({ error: me.message || "Could not read GitHub profile." }, { status: 400 });
    }

    let email = me.email || undefined;
    if (!email) {
      const emailsResponse = await fetch("https://api.github.com/user/emails", { headers });
      if (emailsResponse.ok) {
        const emails = await emailsResponse.json();
        if (Array.isArray(emails)) {
          email = emails.find((entry: any) => entry.primary)?.email || emails.find((entry: any) => entry.verified)?.email;
        }
      }
    }

    return NextResponse.json({
      user: {
        provider: "github",
        id: String(me.id),
        name: me.name || me.login,
        email,
        avatar: me.avatar_url
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GitHub sign-in failed." },
      { status: 500 }
    );
  }
}
