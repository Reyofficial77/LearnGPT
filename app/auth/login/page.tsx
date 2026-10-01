"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, GitHub, Loader } from "react-feather";
import { pkce, randomState, readUser, saveUser, type ClientUser } from "../../../lib/oauth";

declare global {
  interface Window { google?: any }
}

type OAuthConfig = { googleClientId: string; githubClientId: string };

function decodeJwt(token: string) {
  const payload = token.split(".")[1];
  return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
}

export default function LoginPage() {
  const googleRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<OAuthConfig>({ googleClientId: "", githubClientId: "" });
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (readUser()) {
      location.href = "/";
      return;
    }
    fetch("/api/config")
      .then((response) => response.json())
      .then((data) => setConfig({
        googleClientId: String(data.googleClientId || ""),
        githubClientId: String(data.githubClientId || "")
      }))
      .catch(() => setError("Could not load OAuth configuration."));
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(location.search).get("code");
    const state = new URLSearchParams(location.search).get("state");
    const savedState = localStorage.getItem("learngpt.github.state");
    const verifier = localStorage.getItem("learngpt.github.verifier");
    if (code && state && savedState === state && verifier) exchangeGithub(code, verifier);
    else if (code || state) setError("Invalid GitHub OAuth state. Please try again.");
  }, []);

  useEffect(() => {
    if (!googleLoaded || !window.google || !googleRef.current || !config.googleClientId) return;
    window.google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: (response: any) => {
        try {
          const payload = decodeJwt(response.credential);
          const user: ClientUser = {
            provider: "google",
            id: payload.sub,
            name: payload.name || payload.email,
            email: payload.email,
            avatar: payload.picture
          };
          saveUser(user);
          location.href = "/";
        } catch {
          setError("Google sign-in response could not be read.");
        }
      }
    });
    googleRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(googleRef.current, {
      theme: "filled_black",
      size: "large",
      shape: "rectangular",
      width: 320,
      text: "signin_with"
    });
  }, [googleLoaded, config.googleClientId]);

  async function exchangeGithub(code: string, verifier: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          codeVerifier: verifier,
          redirectUri: `${location.origin}/auth/login`
        })
      });
      const data = await response.json();
      if (!response.ok || !data.user) throw new Error(data.error || "GitHub authorization failed.");
      saveUser(data.user as ClientUser);
      localStorage.removeItem("learngpt.github.state");
      localStorage.removeItem("learngpt.github.verifier");
      history.replaceState({}, "", "/auth/login");
      location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "GitHub sign-in failed.");
      localStorage.removeItem("learngpt.github.state");
      localStorage.removeItem("learngpt.github.verifier");
    } finally {
      setLoading(false);
    }
  }

  async function github() {
    setError("");
    if (!config.githubClientId) {
      setError("GitHub Client ID is not configured. Add NEXT_PUBLIC_GITHUB_CLIENT_ID (or GITHUB_CLIENT_ID) in Vercel, then redeploy.");
      return;
    }
    const state = randomState();
    const { verifier, challenge } = await pkce();
    localStorage.setItem("learngpt.github.state", state);
    localStorage.setItem("learngpt.github.verifier", verifier);
    const query = new URLSearchParams({
      client_id: config.githubClientId,
      redirect_uri: `${location.origin}/auth/login`,
      scope: "read:user user:email",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256"
    });
    location.href = `https://github.com/login/oauth/authorize?${query}`;
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGoogleLoaded(true)}
      />
      <main className="login-page">
        <div className="login-card">
          <a className="back" href="/"><ArrowLeft size={16} />Back to LearnGPT</a>
          <div className="login-brand"><BookOpen size={30} /><span>LearnGPT</span></div>
          <h1>Welcome back</h1>
          <p>Sign in to keep your learning profile on this browser.</p>
          {config.googleClientId && <div ref={googleRef} className="google-button" />}
          <button className="oauth-btn github" onClick={github} disabled={loading}>
            <GitHub size={18} />
            {loading ? <><Loader size={16} className="spin" />Signing in…</> : "Continue with GitHub"}
          </button>
          {error && <div className="status error">{error}</div>}
          <small>Client-side login with Google or GitHub. No Firebase is used.</small>
        </div>
      </main>
    </>
  );
}
