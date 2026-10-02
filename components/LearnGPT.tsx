"use client";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, History, HelpCircle, LogOut, Menu, MessageCircle, MoreHorizontal, Paperclip, Plus, Search, Send, Settings as SettingsIcon, Star, User, X, Zap } from "react-feather";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DEFAULT_SETTINGS, type ChatMessage, type Provider, type Settings as AppSettings } from "../lib/types";
import { readChats, readSettings, writeChats, writeSettings } from "../lib/storage";
import { clearUser, readUser, type ClientUser } from "../lib/oauth";
import { LEARN_MODELS, MODEL_REGISTRY } from "../lib/models";
import type { LearnModel } from "../lib/types";

const labels: Record<Provider, string> = { gemini: "Gemini", openai: "OpenAI", anthropic: "Anthropic" };
type Chat = { id: string; title: string; messages: ChatMessage[]; updatedAt: number };
type PromptCard = { icon: ReactNode; title: string; copy: string };

const promptCards: PromptCard[] = [
  { icon: <BookOpen size={19} />, title: "Learn to code", copy: "Help me build my first React component" },
  { icon: <History size={19} />, title: "Complete a task", copy: "Help me outline and improve my assignment" },
  { icon: <Zap size={19} />, title: "Get work done", copy: "Draft a clear project update for my team" }
];

function mergeSettings(): AppSettings {
  const saved = readSettings();
  return {
    provider: saved.provider || DEFAULT_SETTINGS.provider,
    model: saved.model || DEFAULT_SETTINGS.model,
    keys: { ...DEFAULT_SETTINGS.keys, ...saved.keys },
    systemPrompt: saved.systemPrompt || DEFAULT_SETTINGS.systemPrompt
  };
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className="brand" href="/" aria-label="LearnGPT">
      <span className="brand-mark"><BookOpen size={compact ? 18 : 21} /></span>
      <span className="brand-name">LearnGPT</span>
    </a>
  );
}

function SettingsModal({ settings, onChange, onClose, onSave }: { settings: AppSettings; onChange: (value: AppSettings) => void; onClose: () => void; onSave: () => void }) {
  return (
    <div className="settings-overlay" role="presentation" onMouseDown={onClose}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="settings-heading">
          <div>
            <span className="settings-icon"><SettingsIcon size={19} /></span>
            <div><h2 id="settings-title">AI settings</h2><p>Connect a provider and personalize how LearnGPT responds.</p></div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={19} /></button>
        </header>
        <div className="settings-body">
          <label className="settings-field"><span>Default AI provider</span><select value={settings.provider} onChange={(event) => onChange({ ...settings, provider: event.target.value as Provider })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>LearnGPT will use this provider for new responses.</small></label>
          <label className="settings-field"><span>LearnGPT model</span><select value={settings.model} onChange={(event) => onChange({ ...settings, model: event.target.value as LearnModel })}>{LEARN_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}</select><small>API model: {MODEL_REGISTRY[settings.provider][settings.model]}</small></label>
          <div className="api-section">
            <div className="section-label"><strong>API connections</strong><span>Your keys stay in this browser.</span></div>
            {(["gemini", "openai", "anthropic"] as Provider[]).map((provider) => <label className="settings-field" key={provider}><span>{labels[provider]} API key</span><input type="password" value={settings.keys[provider]} onChange={(event) => onChange({ ...settings, keys: { ...settings.keys, [provider]: event.target.value } })} placeholder={`Enter your ${labels[provider]} API key`} autoComplete="off" /></label>)}
          </div>
          <label className="settings-field"><span>Learning instructions</span><textarea rows={5} value={settings.systemPrompt} onChange={(event) => onChange({ ...settings, systemPrompt: event.target.value })} placeholder="Describe how the AI should respond..." /><small>Set the tone, response style, expertise, or rules the AI should follow.</small></label>
        </div>
        <footer className="settings-footer"><button className="settings-cancel" onClick={onClose}>Cancel</button><button className="settings-save" onClick={onSave}><Check size={17} />Save settings</button></footer>
      </section>
    </div>
  );
}

export default function LearnGPT() {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [chats, setChats] = useState<Chat[]>([]);
  const [current, setCurrent] = useState<Chat | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [attachInputKey, setAttachInputKey] = useState(0);
  const bottom = useRef<HTMLDivElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSettings(mergeSettings()); setChats(readChats()); setUser(readUser()); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [current?.messages.length, loading]);

  const history = useMemo(() => chats.filter((chat) => chat.messages.length), [chats]);
  const displayName = user?.name?.split(" ")[0] || "there";
  const model = settings.model;

  const persistChats = (next: Chat[]) => { setChats(next); writeChats(next); };
  const newChat = () => { setCurrent({ id: crypto.randomUUID(), title: "New conversation", messages: [], updatedAt: Date.now() }); setInput(""); setStatus(""); setSidebarOpen(false); };

  const send = async (raw = input) => {
    const prompt = raw.trim();
    if (!prompt || loading) return;
    let chat = current;
    if (!chat) chat = { id: crypto.randomUUID(), title: prompt.slice(0, 42), messages: [], updatedAt: Date.now() };
    const messages = [...chat.messages, { role: "user" as const, content: prompt }];
    const nextChat = { ...chat, title: chat.messages.length ? chat.title : prompt.slice(0, 42), messages, updatedAt: Date.now() };
    setCurrent(nextChat); setInput(""); setSidebarOpen(false); setLoading(true); setStatus("");
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: settings.provider, model, apiKey: settings.keys[settings.provider], systemPrompt: settings.systemPrompt, messages }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      const finalChat = { ...nextChat, messages: [...messages, { role: "assistant" as const, content: data.text }], updatedAt: Date.now() };
      setCurrent(finalChat); persistChats([finalChat, ...chats.filter((chatItem) => chatItem.id !== finalChat.id)]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
    } finally { setLoading(false); }
  };

  const saveSettings = () => { writeSettings(settings); setSettingsOpen(false); setStatus("Settings saved."); setTimeout(() => setStatus(""), 1800); };
  const signOut = () => { clearUser(); setUser(null); location.href = "/auth/login"; };
  const clearHistory = () => { localStorage.removeItem("learngpt.chats"); setChats([]); setCurrent(null); setStatus(""); };

  return (
    <main className="chat-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top"><Brand compact /><button className="icon-button close-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={19} /></button></div>
        <button className="new-chat" onClick={newChat}><Plus size={18} />New conversation</button>
        <nav className="sidebar-nav">
          <p className="nav-label">Menu</p>
          <button className="nav-item active"><MessageCircle size={18} />Chat</button>
          <button className="nav-item"><History size={18} />Activity history</button>
          <p className="nav-label history-label">Recent</p>
          {history.length ? history.slice(0, 8).map((chat) => <button className={`history-item ${current?.id === chat.id ? "active" : ""}`} key={chat.id} onClick={() => { setCurrent(chat); setSidebarOpen(false); }}><span>{chat.title}</span><MoreHorizontal size={16} /></button>) : <div style={{ color: "#666a73", fontSize: 11, padding: "4px 10px" }}>No conversations yet.</div>}
        </nav>
        <div className="sidebar-bottom">
          <button className="upgrade-card" onClick={() => setStatus("Pro upgrades are not enabled yet.")}><span className="upgrade-icon"><Star size={17} /></span><span><strong>Upgrade to Pro</strong><small>Learn without limits</small></span><ArrowRight size={16} /></button>
          <div className="profile-row"><span className="profile-avatar">{user?.avatar ? <img src={user.avatar} alt="" /> : <User size={15} />}</span><span className="profile-copy"><strong>{user?.name || "Guest mode"}</strong><small>{user?.email || "Local session"}</small></span><ChevronDown size={17} /></div>
          <div className="sidebar-actions"><button onClick={() => setSettingsOpen(true)}><SettingsIcon size={16} />AI settings</button><button onClick={user ? signOut : () => { location.href = "/auth/login"; }}><LogOut size={16} />{user ? "Sign out" : "Sign in"}</button><button onClick={clearHistory}><X size={16} />Clear history</button></div>
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />}

      <section className="chat-main">
        <header className="chat-header">
          <div className="header-left"><button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div><strong>AI Assistant</strong><span><i /> Online</span></div></div>
          <div className="header-actions"><span className="header-provider">{labels[settings.provider]}</span><select className="header-model" value={model} onChange={(event) => setSettings((value) => ({ ...value, model: event.target.value as LearnModel }))}>{LEARN_MODELS.map((item) => <option key={item} value={item}>{item}</option>)}</select><button className="icon-button" aria-label="Search"><Search size={19} /></button><button className="icon-button" aria-label="Help"><HelpCircle size={19} /></button></div>
        </header>

        <div className="chat-content">
          {!current?.messages.length ? (
            <div className="welcome-state"><div className="ai-badge"><BookOpen size={29} /><span><Star size={12} /></span></div><p className="welcome-kicker">LEARNGPT AI</p><h1>Welcome, {displayName}.</h1><p className="welcome-copy">What can I help you accomplish today?</p><div className="prompt-grid">{promptCards.map((card) => <button key={card.title} onClick={() => send(card.copy)}><span className="prompt-icon">{card.icon}</span><strong>{card.title}</strong><small>{card.copy}</small><ArrowRight size={17} className="prompt-arrow" /></button>)}</div></div>
          ) : (
            <div className="conversation">{current.messages.map((message, index) => message.role === "user" ? <div className="message-group" key={`${message.role}-${index}`}><div className="user-message"><span>{message.content}</span><span className="profile-avatar small">{user?.avatar ? <img src={user.avatar} alt="" /> : <User size={14} />}</span></div></div> : <div className="message-group" key={`${message.role}-${index}`}><div className="ai-message"><span className="message-ai-icon"><BookOpen size={18} /></span><div><strong>LearnGPT</strong><div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div></div></div></div>)}{loading && <div className="message-group"><div className="ai-message"><span className="message-ai-icon"><BookOpen size={18} /></span><div><strong>LearnGPT</strong><div className="markdown-content"><p className="thinking-text">Thinking…</p></div></div></div></div>}<div ref={bottom} /></div>
          )}
          {status && <div className="chat-status">{status}</div>}
        </div>

        <div className="composer-zone"><div className="composer"><button className="attach-button" aria-label="Attach file" onClick={() => attachRef.current?.click()}><Paperclip size={19} /></button><input key={attachInputKey} ref={attachRef} type="file" hidden onChange={() => { setAttachInputKey((key) => key + 1); setStatus("File attachment is ready to be connected to the chat API."); }} /><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Ask anything, start a task, or describe what you're working on..." /><button className="send-button" disabled={!input.trim() || loading} onClick={() => send()} aria-label="Send message"><Send size={18} /></button></div><p>LearnGPT can make mistakes. Double-check important information.</p></div>
      </section>

      {settingsOpen && <SettingsModal settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} onSave={saveSettings} />}
    </main>
  );
}
