"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, Eye, EyeOff, GitHub, Loader } from "react-feather";

function Brand() {
  return <a className="brand" href="/"><span className="brand-mark"><BookOpen size={20} /></span><span className="brand-name">LearnGPT</span></a>;
}

function Feature({ title, copy }: { title: string; copy: string }) {
  return <div className="auth-feature"><span className="feature-check"><Check size={15} strokeWidth={2.5} /></span><div><strong>{title}</strong><p>{copy}</p></div></div>;
}

function isDesktopRuntime() {
  return typeof window !== "undefined" && Object.prototype.hasOwnProperty.call(window, "__TAURI_INTERNALS__");
}

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [registerMode, setRegisterMode] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(s => {
      if (s.user) window.location.replace("/");
    }).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const message = params.get("error");
    if (message) {
      const messages: Record<string, string> = {
        google_not_configured: "Google sign-in is not configured yet.",
        github_not_configured: "GitHub sign-in is not configured yet.",
        account_uses_another_provider: "This email is connected to another sign-in provider. Please use that provider.",
        google_cancelled: "Google sign-in was cancelled.",
        github_cancelled: "GitHub sign-in was cancelled."
      };
      setError(messages[message] || "Sign-in could not be completed. Please try again.");
    }

    if (!isDesktopRuntime()) return;
    let active = true;
    let handled = false;
    let unlisten: (() => void) | undefined;

    const handleDeepLinks = async (urls: string[]) => {
      for (const raw of urls) {
        let callback: URL;
        try { callback = new URL(raw); } catch { continue; }
        if (callback.protocol !== "learngpt:" || callback.hostname !== "auth" || callback.pathname !== "/callback") continue;
        if (handled) return;
        handled = true;

        const code = callback.searchParams.get("code");
        const callbackError = callback.searchParams.get("error");
        if (!code || callbackError) {
          if (active) {
            setError("Sign-in was cancelled or could not be completed. Please try again.");
            setLoading(false);
          }
          return;
        }

        if (active) setLoading(true);
        try {
          const response = await fetch("/api/auth/desktop/exchange", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code })
          });
          if (!response.ok) throw new Error("The sign-in link is invalid or expired.");
          if (active) window.location.replace("/");
        } catch {
          if (active) {
            setError("Secure desktop sign-in could not be completed. Please try again.");
            setLoading(false);
          }
        }
        return;
      }
    };

    const deepLink = (window as any).__TAURI__?.deepLink;
    if (!deepLink?.onOpenUrl || !deepLink?.getCurrent) {
      setError("Desktop sign-in could not be initialized. Please restart the app and try again.");
      return;
    }
    void (async () => {
      unlisten = await deepLink.onOpenUrl((urls: string[]) => { void handleDeepLinks(urls); });
      const current = await deepLink.getCurrent();
      if (current) await handleDeepLinks(current);
    })().catch(() => {
      if (active) setError("Desktop sign-in could not be initialized. Please restart the app and try again.");
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  async function oauth(provider: "google" | "github") {
    setLoading(true);
    setError("");
    const startUrl = `${window.location.origin}/api/auth/${provider}/start`;
    if (!isDesktopRuntime()) {
      window.location.assign(startUrl);
      return;
    }
    try {
      const openUrl = (window as any).__TAURI__?.opener?.openUrl;
      if (!openUrl) throw new Error("System browser integration is unavailable.");
      await openUrl(`${startUrl}?desktop=1`);
    } catch {
      setError("Could not open your default browser. Please check your Windows browser settings.");
      setLoading(false);
    }
  }

  async function emailLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = registerMode ? "/api/auth/register" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerMode ? { name, email, password } : { email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authentication failed.");
      window.location.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page">
    <aside className="auth-aside">
      <Brand />
      <div className="auth-pitch">
        <h1>Learn, build, and get things done.</h1>
        <p className="pitch-copy">One capable assistant for learning to code, completing assignments, and doing your best work—whatever your experience level.</p>
        <div className="feature-list">
          <Feature title="Learn and code with confidence" copy="Understand concepts and solve problems step by step." />
          <Feature title="Complete tasks faster" copy="Plan, research, write, and refine your assignments." />
          <Feature title="Do better work" copy="Turn ideas into polished, practical results." />
        </div>
      </div>
      <p className="aside-footer">Built for learning, coding, and getting things done.</p>
    </aside>
    <section className="auth-main">
      <div className="mobile-brand"><Brand /></div>
      <div className="auth-card">
        <div className="auth-heading">
          <h2>{registerMode ? "Create your LearnGPT account" : "Sign in to LearnGPT"}</h2>
          <p>{registerMode ? "Save your chats, settings, and learning progress in one account." : "Continue where you left off and turn your next idea into action."}</p>
        </div>
        <div className="oauth-group">
          <button className="google-button" type="button" onClick={() => oauth("google")} disabled={loading}>
            <span className="google-icon">G</span>{loading ? "Please wait…" : "Continue with Google"}
          </button>
          <button className="google-button" type="button" onClick={() => oauth("github")} disabled={loading}>
            <GitHub size={18} />{loading ? <><Loader size={16} className="spin" />Signing in…</> : "Continue with GitHub"}
          </button>
        </div>
        <div className="divider"><span>or use email</span></div>
        <form onSubmit={emailLogin}>
          {registerMode && <label className="field"><span>Name</span><input required name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></label>}
          <label className="field"><span>Email</span><input required name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" /></label>
          <label className="field"><span>Password</span><span className="input-wrap"><input required name="password" minLength={8} autoComplete={registerMode ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} type={passwordVisible ? "text" : "password"} placeholder={registerMode ? "At least 8 characters" : "Enter your password"} /><button type="button" className="input-action" onClick={() => setPasswordVisible(v => !v)} aria-label={passwordVisible ? "Hide password" : "Show password"}>{passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
          {!registerMode && <p className="auth-provider-hint">If you originally signed up with Google or GitHub, use that provider button instead. Those accounts do not have a LearnGPT password by default.</p>}
          <div className="form-options"><label className="remember"><input type="checkbox" /><span>Remember me</span></label></div>
          <button className="primary-button" type="submit" disabled={loading}>{loading ? "Please wait…" : registerMode ? "Create account" : "Sign in"}<ArrowRight size={18} /></button>
        </form>
        {error && <div className="status error" role="alert">{error}</div>}
        <p className="auth-switch">{registerMode ? "Already have an account?" : "New to LearnGPT?"} <button type="button" onClick={() => { setRegisterMode(v => !v); setError(""); }}>{registerMode ? "Sign in" : "Create an account"}</button></p>
      </div>
      <p className="auth-legal">© 2026 LearnGPT · Help · Privacy</p>
    </section>
  </main>;
}
