"use client";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, List, HelpCircle, LogOut, Menu, MessageCircle, MoreHorizontal, Paperclip, Plus, Search, Send, Settings as SettingsIcon, Star, User, X, Zap } from "react-feather";
import { usePathname, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DEFAULT_SETTINGS, type ChatMessage, type Provider, type Settings as AppSettings } from "../lib/types";
import { LEARN_MODELS, MODEL_REGISTRY } from "../lib/models";
import type { LearnModel } from "../lib/types";

const labels: Record<Provider, string> = { gemini: "Gemini", openai: "OpenAI", anthropic: "Anthropic" };
type Chat = { id: string; title: string; messages: ChatMessage[]; updatedAt: number };
type PromptCard = { icon: ReactNode; title: string; copy: string };

const promptCards: PromptCard[] = [
  { icon: <BookOpen size={19} />, title: "Learn to code", copy: "Help me build my first React component" },
  { icon: <List size={19} />, title: "Complete a task", copy: "Help me outline and improve my assignment" },
  { icon: <Zap size={19} />, title: "Get work done", copy: "Draft a clear project update for my team" }
];

const CHAT_PATH = /^\/chat\/([A-Za-z0-9-]+)\/?$/;
// API rows may come without `messages` (e.g. a freshly created chat) -> always normalize.
function normalizeChat(raw: any): Chat { return { id: raw.id, title: raw.title || "New conversation", messages: Array.isArray(raw.messages) ? raw.messages.map((m: any) => ({ role: m.role, content: m.content })) : [], updatedAt: raw.updatedAt ? new Date(raw.updatedAt).getTime() : Date.now() }; }

function mergeSettings(saved: Partial<AppSettings> = {}): AppSettings { return { ...DEFAULT_SETTINGS, ...saved, keys: DEFAULT_SETTINGS.keys }; }

function Brand({ compact = false }: { compact?: boolean }) {
  return <a className="brand" href="/" aria-label="LearnGPT"><span className="brand-mark"><BookOpen size={compact ? 18 : 21} /></span><span className="brand-name">LearnGPT</span></a>;
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
          <div className="api-section"><div className="section-label"><strong>Server AI connection</strong><span>Managed by Vercel environment variables.</span></div><p className="settings-note">LearnGPT now keeps provider keys on the server. Configure <code>GEMINI_API_KEY</code>, <code>OPENAI_API_KEY</code>, or <code>ANTHROPIC_API_KEY</code> in Vercel instead of storing secrets in the browser.</p></div>
          <label className="settings-field"><span>Learning instructions</span><textarea rows={5} value={settings.systemPrompt} onChange={(event) => onChange({ ...settings, systemPrompt: event.target.value })} placeholder="Describe how the AI should respond..." /><small>Set the tone, response style, expertise, or rules the AI should follow.</small></label>
        </div>
        <footer className="settings-footer"><button className="settings-cancel" onClick={onClose}>Cancel</button><button className="settings-save" onClick={onSave}><Check size={17} />Save settings</button></footer>
      </section>
    </div>
  );
}

export default function LearnGPT() {
  const [user, setUser] = useState<{ id:string; provider:string; name:string; email?:string; avatar?:string } | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [chats, setChats] = useState<Chat[]>([]);
  const [current, setCurrent] = useState<Chat | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const routeChatId = CHAT_PATH.exec(pathname || "")?.[1] ?? null;
  const chatsRef = useRef<Chat[]>([]);
  const busyRef = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  useEffect(() => { (async () => { const [sessionRes, chatsRes, settingsRes] = await Promise.all([fetch("/api/auth/session"), fetch("/api/chats"), fetch("/api/settings")]); const session = await sessionRes.json(); if (!session.user) { location.href = "/auth/login"; return; } setUser(session.user); if (chatsRes.ok) { const data = await chatsRes.json(); const list = (data.chats || []).map(normalizeChat); chatsRef.current = list; setChats(list); } if (settingsRes.ok) { const data = await settingsRes.json(); setSettings(mergeSettings(data.settings)); } setLoaded(true); })().catch(() => setStatus("Could not load your workspace.")); }, []);
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  // Keep the open conversation in sync with the URL (/chat/[id]) — direct visits, refresh, back/forward.
  useEffect(() => {
    if (!loaded || busyRef.current) return;
    if (!routeChatId) { if (current) setCurrent(null); return; }
    if (current?.id === routeChatId) return;
    const found = chatsRef.current.find((chat) => chat.id === routeChatId);
    if (found) { setCurrent(found); setStatus(""); }
    else { setCurrent(null); setStatus("Conversation not found."); router.replace("/"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeChatId, loaded]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [current?.messages.length, loading]);
  const history = useMemo(() => chats.filter((chat) => chat.messages.length), [chats]);
  const displayName = user?.name?.split(" ")[0] || "there";
  const model = settings.model;

  const newChat = () => { setCurrent(null); setInput(""); setStatus(""); setSidebarOpen(false); if (routeChatId) router.push("/"); };
  const createChat = async (title: string) => { const response = await fetch("/api/chats", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ title }) }); if (!response.ok) throw new Error("Could not create conversation."); const data=await response.json(); const chat=normalizeChat(data.chat); setChats((items)=>[chat,...items]); return chat; };
  const send = async (raw = input) => {
    const prompt = raw.trim(); if (!prompt || loading) return; setLoading(true); setStatus(""); busyRef.current = true;
    try {
      let chat = current; if (!chat) chat = await createChat(prompt.slice(0,80));
      const messages = [...chat.messages, { role:"user" as const, content:prompt }]; const optimistic={...chat,title:chat.messages.length?chat.title:prompt.slice(0,80),messages,updatedAt:Date.now()}; setCurrent(optimistic); setInput(""); setSidebarOpen(false); if (routeChatId !== chat.id) router.push(`/chat/${chat.id}`);
      const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:chat.id,provider:settings.provider,model,systemPrompt:settings.systemPrompt,messages})}); const data=await response.json(); if(!response.ok) throw new Error(data.error||"Request failed");
      const finalChat={...optimistic,messages:[...messages,{role:"assistant" as const,content:data.text}],updatedAt:Date.now()}; setCurrent(finalChat); setChats((items)=>[finalChat,...items.filter((item)=>item.id!==finalChat.id)]);
    } catch(error){ setStatus(error instanceof Error?error.message:"Something went wrong."); } finally { busyRef.current = false; setLoading(false); }
  };
  const saveSettings = async () => { const response=await fetch("/api/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:settings.provider,model:settings.model,systemPrompt:settings.systemPrompt})}); if(!response.ok){setStatus("Could not save settings.");return;} setSettingsOpen(false); setStatus("Settings saved."); setTimeout(()=>setStatus(""),1800); };
  const signOut = async () => { await fetch("/api/auth/logout",{method:"POST"}); location.href="/auth/login"; };
  const deleteChat = async (id:string) => { const response=await fetch(`/api/chats/${id}`,{method:"DELETE"}); if(response.ok){setChats((items)=>items.filter((item)=>item.id!==id));if(current?.id===id){setCurrent(null);router.push("/");}} };
  const clearHistory = async () => { await Promise.all(chats.map((chat)=>fetch(`/api/chats/${chat.id}`,{method:"DELETE"}))); setChats([]);setCurrent(null);setStatus("");if(routeChatId)router.push("/"); };

  if (!user) return <main className="chat-shell"><div className="loading-screen"><div className="ai-badge"><BookOpen size={25}/></div><strong>Loading your LearnGPT workspace…</strong></div></main>;
  return <main className="chat-shell">
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-top"><Brand compact/><button className="icon-button close-sidebar" onClick={()=>setSidebarOpen(false)} aria-label="Close menu"><X size={19}/></button></div>
      <button className="new-chat" onClick={newChat}><Plus size={18}/>New conversation</button>
      <nav className="sidebar-nav"><p className="nav-label">Workspace</p><button className="nav-item active"><MessageCircle size={18}/>Chat</button><button className="nav-item" onClick={()=>setStatus(`${history.length} saved conversations`)}><List size={18}/>Activity history<span className="nav-count">{history.length}</span></button><p className="nav-label history-label">Recent</p>
      {history.length ? history.slice(0,10).map((chat)=><div className={`history-row ${current?.id===chat.id?"active":""}`} key={chat.id}><button className="history-item" onClick={()=>{setCurrent(chat);setSidebarOpen(false);router.push(`/chat/${chat.id}`)}}><span>{chat.title}</span></button><button className="history-delete" onClick={()=>deleteChat(chat.id)} aria-label={`Delete ${chat.title}`}><X size={14}/></button></div>) : <div className="empty-history"><MessageCircle size={17}/><span>Your saved chats will appear here.</span></div>}</nav>
      <div className="sidebar-bottom"><div className="upgrade-card"><span className="upgrade-icon"><Star size={17}/></span><span><strong>LearnGPT workspace</strong><small>Chats are saved securely</small></span></div><div className="profile-row"><span className="profile-avatar">{user.avatar?<img src={user.avatar} alt=""/>:<User size={15}/>}</span><span className="profile-copy"><strong>{user.name}</strong><small>{user.email}</small></span></div><div className="sidebar-actions"><button onClick={()=>setSettingsOpen(true)}><SettingsIcon size={16}/>AI settings</button><button onClick={signOut}><LogOut size={16}/>Sign out</button><button onClick={clearHistory}><X size={16}/>Clear history</button></div></div>
    </aside>
    {sidebarOpen&&<button className="sidebar-backdrop" onClick={()=>setSidebarOpen(false)} aria-label="Close menu"/>}
    <section className="chat-main">
      <header className="chat-header"><div className="header-left"><button className="icon-button menu-button" onClick={()=>setSidebarOpen(true)} aria-label="Open menu"><Menu size={20}/></button><div><strong>AI Assistant</strong><span><i/> Online</span></div></div><div className="header-actions"><span className="header-provider">{labels[settings.provider]}</span><select className="header-model" value={model} onChange={(event)=>setSettings((value)=>({...value,model:event.target.value as LearnModel}))}>{LEARN_MODELS.map((item)=><option key={item} value={item}>{item}</option>)}</select><button className="icon-button" onClick={()=>setSettingsOpen(true)} aria-label="Settings"><SettingsIcon size={18}/></button></div></header>
      <div className="chat-content">{!current?.messages.length?<div className="welcome-state"><div className="ai-badge"><BookOpen size={29}/><span><Star size={12}/></span></div><p className="welcome-kicker">LEARNGPT AI</p><h1>Welcome, {displayName}.</h1><p className="welcome-copy">What can I help you accomplish today?</p><div className="prompt-grid">{promptCards.map((card)=><button key={card.title} onClick={()=>send(card.copy)}><span className="prompt-icon">{card.icon}</span><strong>{card.title}</strong><small>{card.copy}</small><ArrowRight size={17} className="prompt-arrow"/></button>)}</div></div>:<div className="conversation">{current.messages.map((message,index)=>message.role==="user"?<div className="message-group" key={`${message.role}-${index}`}><div className="user-message"><span>{message.content}</span><span className="profile-avatar small">{user.avatar?<img src={user.avatar} alt=""/>:<User size={14}/>}</span></div></div>:<div className="message-group" key={`${message.role}-${index}`}><div className="ai-message"><span className="message-ai-icon"><BookOpen size={18}/></span><div><strong>LearnGPT</strong><div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div></div></div></div>)}{loading&&<div className="message-group"><div className="ai-message"><span className="message-ai-icon"><BookOpen size={18}/></span><div><strong>LearnGPT</strong><div className="markdown-content"><p className="thinking-text">Thinking…</p></div></div></div></div>}<div ref={bottom}/></div>}{status&&<div className="chat-status">{status}</div>}</div>
      <div className="composer-zone"><div className="composer"><button className="attach-button" aria-label="Attach file" onClick={()=>attachRef.current?.click()}><Paperclip size={19}/></button><input ref={attachRef} type="file" hidden onChange={()=>setStatus("Attachments are not stored yet. Text chat is fully persisted.")}/><input value={input} onChange={(event)=>setInput(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();send()}}} placeholder="Ask anything, start a task, or describe what you're working on…"/><button className="send-button" disabled={!input.trim()||loading} onClick={()=>send()} aria-label="Send message"><Send size={18}/></button></div><p>Your chats are saved to your LearnGPT account. LearnGPT can make mistakes.</p></div>
    </section>{settingsOpen&&<SettingsModal settings={settings} onChange={setSettings} onClose={()=>setSettingsOpen(false)} onSave={saveSettings}/>}</main>;
}
