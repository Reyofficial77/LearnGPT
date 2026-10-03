"use client";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, BookOpen, Check, Image as ImageIcon, List, LogOut, Menu, MessageCircle, Paperclip, Plus, Send, Settings as SettingsIcon, Star, User, X, Zap } from "react-feather";
import { usePathname } from "next/navigation";
import MessageContent from "./MessageContent";
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
function normalizeChat(raw: any): Chat { return { id: raw.id, title: raw.title || "New conversation", messages: Array.isArray(raw.messages) ? raw.messages.map((m: any) => ({ role: m.role, content: m.content, ...(Array.isArray(m.images) && m.images.length ? { images: m.images as string[] } : {}) })) : [], updatedAt: raw.updatedAt ? new Date(raw.updatedAt).getTime() : Date.now() }; }

// Client-side URL change with NO network request and NO reload (like ChatGPT/Claude).
// Next.js syncs native history.pushState/replaceState with usePathname().
function goTo(path: string, mode: "push" | "replace" = "push") {
  if (typeof window === "undefined" || window.location.pathname === path) return;
  window.history[mode === "push" ? "pushState" : "replaceState"](null, "", path);
}

const MAX_IMAGES = 4;
// Resize + re-encode to JPEG so uploads stay small (Vercel request limit is ~4.5 MB) and every provider accepts them.
async function fileToJpegDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const el = new Image(); el.onload = () => resolve(el); el.onerror = () => reject(new Error("unreadable")); el.src = url; });
    let scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    for (const quality of [0.8, 0.65, 0.5]) {
      const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("canvas");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      const out = canvas.toDataURL("image/jpeg", quality);
      if (out.length < 1_200_000 || quality === 0.5) return out;
      scale *= 0.8;
    }
    throw new Error("unreadable");
  } finally { URL.revokeObjectURL(url); }
}
// Only the two most recent messages that carry images are re-sent in full; older ones are flagged so the model knows.
function buildPayload(msgs: ChatMessage[]) {
  const keep = new Set<number>();
  for (let i = msgs.length - 1; i >= 0 && keep.size < 2; i--) if (msgs[i].images?.length) keep.add(i);
  return msgs.map((m, i) => ({ role: m.role, content: m.content, images: keep.has(i) ? m.images : undefined, imageCount: m.images?.length || 0 }));
}

function mergeSettings(saved: Partial<AppSettings> = {}): AppSettings { return { ...DEFAULT_SETTINGS, ...saved, keys: DEFAULT_SETTINGS.keys }; }

function Brand({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return <a className="brand" href="/" aria-label="LearnGPT" onClick={onNavigate ? (event) => { event.preventDefault(); onNavigate(); } : undefined}><span className="brand-mark"><BookOpen size={compact ? 18 : 21} /></span><span className="brand-name">LearnGPT</span></a>;
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
  const pathname = usePathname();
  const routeChatId = CHAT_PATH.exec(pathname || "")?.[1] ?? null;
  const chatsRef = useRef<Chat[]>([]);
  const busyRef = useRef(false);
  const [images, setImages] = useState<string[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const taRef = useRef<HTMLTextAreaElement>(null);
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
    else { setCurrent(null); setStatus("Conversation not found."); goTo("/","replace"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeChatId, loaded]);
  const msgCount = current?.messages.length ?? 0;
  const lastRole = current?.messages[msgCount - 1]?.role;
  const scrollToBottom = (smooth = false) => { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" }); };
  const onScroll = () => { const el = scrollRef.current; if (!el) return; const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120; stickRef.current = near; setShowJump(!near); };
  // New user message / "Thinking…" -> stay at the bottom. New AI answer -> show its START (long code answers are read top-down).
  useEffect(() => {
    const el = scrollRef.current; if (!el || !msgCount || !stickRef.current) return;
    if (lastRole === "assistant") {
      const target = el.querySelector<HTMLElement>(`[data-msg="${msgCount - 1}"]`);
      if (target) { const delta = target.getBoundingClientRect().top - el.getBoundingClientRect().top; el.scrollTo({ top: el.scrollTop + delta - 12, behavior: "smooth" }); return; }
    }
    el.scrollTo({ top: el.scrollHeight });
  }, [msgCount, lastRole, loading]);
  useEffect(() => { stickRef.current = true; setShowJump(false); requestAnimationFrame(() => scrollToBottom()); }, [current?.id]);
  // Composer textarea grows with its content (up to a cap), then scrolls.
  useEffect(() => { const el = taRef.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 220)}px`; }, [input, images.length]);
  useEffect(() => { if (!lightbox) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setLightbox(null); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [lightbox]);
  const history = useMemo(() => chats.filter((chat) => chat.messages.length), [chats]);
  const displayName = user?.name?.split(" ")[0] || "there";
  const model = settings.model;

  const newChat = () => { setCurrent(null); setInput(""); setImages([]); setStatus(""); setSidebarOpen(false); if (routeChatId) goTo("/"); };
  const createChat = async (title: string) => { const response = await fetch("/api/chats", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ title }) }); if (!response.ok) throw new Error("Could not create conversation."); const data=await response.json(); const chat=normalizeChat(data.chat); setChats((items)=>[chat,...items]); return chat; };
  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!list.length) { setStatus("Only image files can be attached."); return; }
    const room = MAX_IMAGES - images.length;
    if (room <= 0) { setStatus(`You can attach up to ${MAX_IMAGES} images per message.`); return; }
    setAttaching(true); setStatus("");
    try {
      const added: string[] = [];
      for (const file of list.slice(0, room)) {
        if (file.size > 20 * 1024 * 1024) { setStatus("An image is larger than 20 MB and was skipped."); continue; }
        try { added.push(await fileToJpegDataUrl(file)); } catch { setStatus("Could not read one of the images (unsupported format)."); }
      }
      if (added.length) setImages((prev) => [...prev, ...added].slice(0, MAX_IMAGES));
      if (list.length > room) setStatus(`Max ${MAX_IMAGES} images per message — extra images were skipped.`);
    } finally { setAttaching(false); }
  };
  const send = async (raw = input, attached = images) => {
    const prompt = raw.trim(); if ((!prompt && !attached.length) || loading || attaching) return;
    setLoading(true); setStatus(""); busyRef.current = true; stickRef.current = true;
    let chat: Chat | null = current;
    try {
      const title = (prompt || "Image").slice(0, 80);
      if (!chat) chat = await createChat(title);
      const userMessage: ChatMessage = { role: "user", content: prompt, ...(attached.length ? { images: attached } : {}) };
      const messages = [...chat.messages, userMessage]; const optimistic = { ...chat, title: chat.messages.length ? chat.title : title, messages, updatedAt: Date.now() };
      setCurrent(optimistic); setInput(""); setImages([]); setSidebarOpen(false); if (routeChatId !== chat.id) goTo(`/chat/${chat.id}`);
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId: chat.id, provider: settings.provider, model, systemPrompt: settings.systemPrompt, messages: buildPayload(messages) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 413 ? "The images are too large to send. Try fewer or smaller images." : data.error || `Request failed (${response.status})`);
      const finalChat = { ...optimistic, messages: [...messages, { role: "assistant" as const, content: data.text }], updatedAt: Date.now() }; setCurrent(finalChat); setChats((items) => [finalChat, ...items.filter((item) => item.id !== finalChat.id)]);
    } catch (error) {
      // Nothing was saved on failure: put the user's message back in the composer instead of making them retype it.
      if (chat) setCurrent(chat);
      setInput(prompt); setImages(attached);
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
    } finally { busyRef.current = false; setLoading(false); }
  };
  const saveSettings = async () => { const response=await fetch("/api/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:settings.provider,model:settings.model,systemPrompt:settings.systemPrompt})}); if(!response.ok){setStatus("Could not save settings.");return;} setSettingsOpen(false); setStatus("Settings saved."); setTimeout(()=>setStatus(""),1800); };
  const signOut = async () => { await fetch("/api/auth/logout",{method:"POST"}); location.href="/auth/login"; };
  const deleteChat = async (id:string) => { const response=await fetch(`/api/chats/${id}`,{method:"DELETE"}); if(response.ok){setChats((items)=>items.filter((item)=>item.id!==id));if(current?.id===id){setCurrent(null);goTo("/");}} };
  const clearHistory = async () => { await Promise.all(chats.map((chat)=>fetch(`/api/chats/${chat.id}`,{method:"DELETE"}))); setChats([]);setCurrent(null);setStatus("");if(routeChatId)goTo("/"); };

  if (!user) return <main className="chat-shell"><div className="loading-screen"><div className="ai-badge"><BookOpen size={25}/></div><strong>Loading your LearnGPT workspace…</strong></div></main>;
  return <main className="chat-shell">
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-top"><Brand compact onNavigate={newChat}/><button className="icon-button close-sidebar" onClick={()=>setSidebarOpen(false)} aria-label="Close menu"><X size={19}/></button></div>
      <button className="new-chat" onClick={newChat}><Plus size={18}/>New conversation</button>
      <nav className="sidebar-nav"><p className="nav-label">Workspace</p><button className="nav-item active"><MessageCircle size={18}/>Chat</button><button className="nav-item" onClick={()=>setStatus(`${history.length} saved conversations`)}><List size={18}/>Activity history<span className="nav-count">{history.length}</span></button><p className="nav-label history-label">Recent</p>
      {history.length ? history.map((chat)=><div className={`history-row ${current?.id===chat.id?"active":""}`} key={chat.id}><button className="history-item" onClick={()=>{setCurrent(chat);setSidebarOpen(false);goTo(`/chat/${chat.id}`)}}><span>{chat.title}</span></button><button className="history-delete" onClick={()=>deleteChat(chat.id)} aria-label={`Delete ${chat.title}`}><X size={14}/></button></div>) : <div className="empty-history"><MessageCircle size={17}/><span>Your saved chats will appear here.</span></div>}</nav>
      <div className="sidebar-bottom"><div className="upgrade-card"><span className="upgrade-icon"><Star size={17}/></span><span><strong>LearnGPT workspace</strong><small>Chats are saved securely</small></span></div><div className="profile-row"><span className="profile-avatar">{user.avatar?<img src={user.avatar} alt=""/>:<User size={15}/>}</span><span className="profile-copy"><strong>{user.name}</strong><small>{user.email}</small></span></div><div className="sidebar-actions"><button onClick={()=>setSettingsOpen(true)}><SettingsIcon size={16}/>AI settings</button><button onClick={signOut}><LogOut size={16}/>Sign out</button><button onClick={clearHistory}><X size={16}/>Clear history</button></div></div>
    </aside>
    {sidebarOpen&&<button className="sidebar-backdrop" onClick={()=>setSidebarOpen(false)} aria-label="Close menu"/>}
    <section className="chat-main">
      <header className="chat-header"><div className="header-left"><button className="icon-button menu-button" onClick={()=>setSidebarOpen(true)} aria-label="Open menu"><Menu size={20}/></button><div><strong>AI Assistant</strong><span><i/> Online</span></div></div><div className="header-actions"><span className="header-provider">{labels[settings.provider]}</span><select className="header-model" value={model} onChange={(event)=>setSettings((value)=>({...value,model:event.target.value as LearnModel}))}>{LEARN_MODELS.map((item)=><option key={item} value={item}>{item}</option>)}</select><button className="icon-button" onClick={()=>setSettingsOpen(true)} aria-label="Settings"><SettingsIcon size={18}/></button></div></header>
      <div className="chat-scroll-wrap"><div className="chat-content" ref={scrollRef} onScroll={onScroll}>{!current?.messages.length?<div className="welcome-state"><div className="ai-badge"><BookOpen size={29}/><span><Star size={12}/></span></div><p className="welcome-kicker">LEARNGPT AI</p><h1>Welcome, {displayName}.</h1><p className="welcome-copy">What can I help you accomplish today?</p><div className="prompt-grid">{promptCards.map((card)=><button key={card.title} onClick={()=>send(card.copy,[])}><span className="prompt-icon">{card.icon}</span><strong>{card.title}</strong><small>{card.copy}</small><ArrowRight size={17} className="prompt-arrow"/></button>)}</div></div>:<div className="conversation">{current.messages.map((message,index)=>message.role==="user"?<div className="message-group" data-msg={index} key={`${message.role}-${index}`}><div className="user-message"><div className="user-bubble">{message.images?.length?<div className={`msg-images ${message.images.length===1?"single":""}`}>{message.images.map((src,i)=><button className="msg-image" key={i} onClick={()=>setLightbox(src)} aria-label={`View image ${i+1}`}><img src={src} alt={`Attachment ${i+1}`}/></button>)}</div>:null}{message.content&&<span className="user-text">{message.content}</span>}</div><span className="profile-avatar small">{user.avatar?<img src={user.avatar} alt=""/>:<User size={14}/>}</span></div></div>:<div className="message-group" data-msg={index} key={`${message.role}-${index}`}><div className={`ai-message ${message.content.includes("```")?"rich":""}`}><span className="message-ai-icon"><BookOpen size={18}/></span><div><strong>LearnGPT</strong><div className="markdown-content"><MessageContent content={message.content}/></div></div></div></div>)}{loading&&<div className="message-group"><div className="ai-message"><span className="message-ai-icon"><BookOpen size={18}/></span><div><strong>LearnGPT</strong><div className="markdown-content"><p className="thinking-text">Thinking…</p></div></div></div></div>}</div>}{status&&<div className="chat-status">{status}</div>}</div>{showJump&&msgCount>0&&<button className="jump-bottom" onClick={()=>scrollToBottom(true)} aria-label="Scroll to latest message"><ArrowDown size={17}/></button>}</div>
      <div className="composer-zone" onDragOver={(event)=>{if(event.dataTransfer.types.includes("Files")){event.preventDefault();setDragging(true)}}} onDragLeave={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setDragging(false)}} onDrop={(event)=>{event.preventDefault();setDragging(false);if(event.dataTransfer.files.length)addFiles(event.dataTransfer.files)}}>
        <div className={`composer ${images.length||attaching?"has-images":""} ${dragging?"dragging":""}`}>
          {(images.length>0||attaching)&&<div className="attachment-tray">{images.map((src,index)=><div className="attachment" key={`${index}-${src.length}`}><img src={src} alt={`Attachment ${index+1}`}/><button className="attachment-remove" onClick={()=>setImages((items)=>items.filter((_,i)=>i!==index))} aria-label={`Remove image ${index+1}`}><X size={13}/></button></div>)}{attaching&&<div className="attachment attachment-loading" aria-label="Processing image"><i/></div>}</div>}
          <div className="composer-row">
            <button className="attach-button" aria-label="Attach images" title={`Attach images (max ${MAX_IMAGES})`} disabled={attaching||images.length>=MAX_IMAGES} onClick={()=>attachRef.current?.click()}><Paperclip size={19}/></button>
            <input ref={attachRef} type="file" accept="image/*" multiple hidden onChange={(event)=>{if(event.target.files?.length)addFiles(event.target.files);event.target.value=""}}/>
            <textarea ref={taRef} rows={1} value={input} onChange={(event)=>setInput(event.target.value)} onPaste={(event)=>{const files=Array.from(event.clipboardData.files).filter((file)=>file.type.startsWith("image/"));if(files.length){event.preventDefault();addFiles(files)}}} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send()}}} placeholder={images.length?"Add a message about your image(s)…":"Ask anything, start a task, or describe what you're working on…"}/>
            <button className="send-button" disabled={(!input.trim()&&!images.length)||loading||attaching} onClick={()=>send()} aria-label="Send message"><Send size={18}/></button>
          </div>
          {dragging&&<div className="drop-hint"><ImageIcon size={20}/>Drop images to attach</div>}
        </div>
        <p>Your chats are saved to your LearnGPT account. LearnGPT can make mistakes.</p>
      </div>
    </section>{lightbox&&<div className="lightbox" role="dialog" aria-modal="true" aria-label="Image preview" onClick={()=>setLightbox(null)}><button className="lightbox-close" aria-label="Close image" onClick={()=>setLightbox(null)}><X size={20}/></button><img src={lightbox} alt="Attachment preview" onClick={(event)=>event.stopPropagation()}/></div>}{settingsOpen&&<SettingsModal settings={settings} onChange={setSettings} onClose={()=>setSettingsOpen(false)} onSave={saveSettings}/>}</main>;
}
