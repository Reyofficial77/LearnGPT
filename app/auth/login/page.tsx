"use client";
import Script from "next/script";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, Eye, EyeOff, GitHub, Loader, Star } from "react-feather";
import { pkce, randomState, readUser, saveUser, type ClientUser } from "../../../lib/oauth";

declare global { interface Window { google?: any } }
type OAuthConfig = { googleClientId: string; githubClientId: string };

function decodeJwt(token: string) { const payload = token.split(".")[1]; return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))); }
function Brand() { return <a className="brand" href="/"><span className="brand-mark"><BookOpen size={21} /></span><span className="brand-name">LearnGPT</span></a>; }
function Feature({ title, copy }: { title: string; copy: string }) { return <div className="auth-feature"><span className="feature-check"><Check size={14} strokeWidth={3} /></span><div><strong>{title}</strong><p>{copy}</p></div></div>; }

export default function LoginPage() {
  const googleRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<OAuthConfig>({ googleClientId: "", githubClientId: "" });
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => { if (readUser()) { location.href = "/"; return; } fetch("/api/config").then((response) => response.json()).then((data) => setConfig({ googleClientId: String(data.googleClientId || ""), githubClientId: String(data.githubClientId || "") })).catch(() => setError("Could not load OAuth configuration.")); }, []);
  useEffect(() => { const code = new URLSearchParams(location.search).get("code"); const state = new URLSearchParams(location.search).get("state"); const savedState = localStorage.getItem("learngpt.github.state"); const verifier = localStorage.getItem("learngpt.github.verifier"); if (code && state && savedState === state && verifier) exchangeGithub(code, verifier); else if (code || state) setError("Invalid GitHub OAuth state. Please try again."); }, []);
  useEffect(() => {
    if (!googleLoaded || !window.google || !googleRef.current || !config.googleClientId) return;
    window.google.accounts.id.initialize({ client_id: config.googleClientId, callback: (response: any) => { try { const payload = decodeJwt(response.credential); const user: ClientUser = { provider: "google", id: payload.sub, name: payload.name || payload.email, email: payload.email, avatar: payload.picture }; saveUser(user); location.href = "/"; } catch { setError("Google sign-in response could not be read."); } } });
    googleRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(googleRef.current, { theme: "filled_black", size: "large", shape: "rectangular", width: 420, text: "continue_with" });
  }, [googleLoaded, config.googleClientId]);

  async function exchangeGithub(code: string, verifier: string) {
    setLoading(true); setError("");
    try { const response = await fetch("/api/auth/github", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, codeVerifier: verifier, redirectUri: `${location.origin}/auth/login` }) }); const data = await response.json(); if (!response.ok || !data.user) throw new Error(data.error || "GitHub authorization failed."); saveUser(data.user as ClientUser); localStorage.removeItem("learngpt.github.state"); localStorage.removeItem("learngpt.github.verifier"); history.replaceState({}, "", "/auth/login"); location.href = "/"; } catch (e) { setError(e instanceof Error ? e.message : "GitHub sign-in failed."); localStorage.removeItem("learngpt.github.state"); localStorage.removeItem("learngpt.github.verifier"); } finally { setLoading(false); }
  }
  async function github() {
    setError("");
    if (!config.githubClientId) { setError("GitHub Client ID is not configured. Add NEXT_PUBLIC_GITHUB_CLIENT_ID (or GITHUB_CLIENT_ID) in Vercel, then redeploy."); return; }
    const state = randomState(); const { verifier, challenge } = await pkce(); localStorage.setItem("learngpt.github.state", state); localStorage.setItem("learngpt.github.verifier", verifier);
    const query = new URLSearchParams({ client_id: config.githubClientId, redirect_uri: `${location.origin}/auth/login`, scope: "read:user user:email", state, code_challenge: challenge, code_challenge_method: "S256" }); location.href = `https://github.com/login/oauth/authorize?${query}`;
  }
  function emailLogin(event: FormEvent) { event.preventDefault(); setError(email ? "Email/password login is not connected yet. Use Google or GitHub to continue." : "Enter your email address."); }

  return <>
    <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleLoaded(true)} />
    <main className="auth-page">
      <aside className="auth-aside"><Brand /><div className="auth-pitch"><span className="eyebrow"><Star size={14} />Your all-purpose AI assistant</span><h1>Learn, build,<br /><span>and get things done.</span></h1><p className="pitch-copy">One capable assistant for learning to code, completing assignments, and doing your best work—whatever your experience level.</p><div className="feature-list"><Feature title="Learn and code with confidence" copy="Understand concepts and solve problems step by step." /><Feature title="Complete tasks faster" copy="Plan, research, write, and refine your assignments." /><Feature title="Do better work" copy="Turn ideas into polished, practical results." /></div></div><div className="aside-footer"><div className="avatar-stack"><span>LG</span><span>AI</span><span>+</span></div><p>Built for <strong>learning</strong>, coding, and getting things done</p></div></aside>
      <section className="auth-main"><div className="mobile-brand"><Brand /></div><div className="auth-card"><div className="auth-heading"><span className="mobile-kicker">WELCOME BACK</span><h2>Sign in to LearnGPT</h2><p>Continue where you left off and turn your next idea into action.</p></div>
        {config.googleClientId ? <div ref={googleRef} className="google-button google-oauth" /> : <button className="google-button" type="button" onClick={() => setError("Google OAuth is not configured on this deployment.")}><span className="google-icon">G</span>Continue with Google</button>}
        <button className="google-button" type="button" onClick={github} disabled={loading}><GitHub size={18} />{loading ? <><Loader size={16} className="spin" />Signing in…</> : "Continue with GitHub"}</button>
        <div className="divider"><span>or continue with email</span></div>
        <form onSubmit={emailLogin}><label className="field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" /></label><label className="field"><span>Password</span><span className="input-wrap"><input type={passwordVisible ? "text" : "password"} placeholder="Enter your password" /><button type="button" className="input-action" onClick={() => setPasswordVisible((value) => !value)} aria-label={passwordVisible ? "Hide password" : "Show password"}>{passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label><div className="form-options"><label className="remember"><input type="checkbox" /><span>Remember me</span></label><button type="button" className="text-link" onClick={() => setError("Password reset is not connected yet.")}>Forgot password?</button></div><button className="primary-button" type="submit">Sign in<ArrowRight size={18} /></button></form>
        {error && <div className="status error">{error}</div>}
        <p className="auth-switch">New to LearnGPT? <a href="/auth/login">Create an account</a></p>
      </div><p className="auth-legal">© 2026 LearnGPT · Help · Privacy</p></section>
    </main>
  </>;
}
