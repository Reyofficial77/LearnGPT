"use client";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDown, ArrowRight, BookOpen, Check, ChevronDown, FileText, Image as ImageIcon, List, LogOut, Menu, MessageCircle, Paperclip, Plus, Send, Settings as SettingsIcon, Trash2, User, X, Zap } from "react-feather";
import { usePathname } from "next/navigation";
import MessageContent from "./MessageContent";
import SettingsModal from "./SettingsModal";
import { DEFAULT_SETTINGS, type ChatAttachment, type ChatMessage, type Settings as AppSettings } from "../lib/types";
import { LEARN_MODELS, MODEL_LABELS } from "../lib/models";
import type { LearnModel } from "../lib/types";

type Chat = { id: string; title: string; messages: ChatMessage[]; updatedAt: number };
type PendingFile = ChatAttachment & { dataUrl: string };
type PromptCard = { icon: ReactNode; title: string; copy: string };

const promptCards: PromptCard[] = [
  { icon: <BookOpen size={20} />, title: "Learn to code", copy: "Help me build my first React component" },
  { icon: <List size={20} />, title: "Complete a task", copy: "Help me outline and improve my assignment" },
  { icon: <Zap size={20} />, title: "Get work done", copy: "Draft a clear project update for my team" }
];

const CHAT_PATH = /^\/chat\/([A-Za-z0-9-]+)\/?$/;
// API rows may come without `messages` (e.g. a freshly created chat) -> always normalize.
function normalizeChat(raw: any): Chat { return { id: raw.id, title: raw.title || "New conversation", messages: Array.isArray(raw.messages) ? raw.messages.map((m: any) => ({ role: m.role, content: m.content, ...(Array.isArray(m.images) && m.images.length ? { images: m.images as string[] } : {}), ...(Array.isArray(m.attachments) && m.attachments.length ? { attachments: m.attachments as ChatAttachment[] } : {}) })) : [], updatedAt: raw.updatedAt ? new Date(raw.updatedAt).getTime() : Date.now() }; }

// Client-side URL change with NO network request and NO reload (like ChatGPT/Claude).
// Next.js syncs native history.pushState/replaceState with usePathname().
function goTo(path: string, mode: "push" | "replace" = "push") {
  if (typeof window === "undefined" || window.location.pathname === path) return;
  window.history[mode === "push" ? "pushState" : "replaceState"](null, "", path);
}

const MODEL_SHORT_LABELS: Record<LearnModel, string> = { "learn-1.0-smart": "Smart", "learn-1.0-study": "Study", "learn-2.0-thinking": "Thinking" };
const MAX_IMAGES = 4;
const MAX_FILES = 4;
const MAX_FILE_BYTES = 1_000_000;
const MAX_COMBINED_UPLOAD_CHARS = 3_500_000;
const SUPPORTED_FILE_EXTENSIONS = new Set(["pdf", "docx", "txt", "md", "csv", "json", "html", "htm", "css", "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "h", "sql", "sh", "yaml", "yml", "xml", "log", "ini", "toml", "go", "rs", "rb", "php", "cs"]);
const ACCEPTED_FILE_TYPES = ".pdf,.docx,.txt,.md,.csv,.json,.html,.htm,.css,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.sql,.sh,.yaml,.yml,.xml,.log,.ini,.toml,.go,.rs,.rb,.php,.cs";
function fileExtension(file: File) { const ext = file.name.split(".").pop()?.toLowerCase() || ""; if (SUPPORTED_FILE_EXTENSIONS.has(ext)) return ext; const byMime: Record<string, string> = { "application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "text/plain": "txt", "text/markdown": "md", "text/csv": "csv", "application/json": "json" }; return byMime[file.type] || ""; }
function readFileDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read file.")); reader.onerror = () => reject(new Error("Could not read file.")); reader.readAsDataURL(file); }); }
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
// Keep the two most recent messages with attachments in the request; older image data is marked as omitted.
function buildPayload(msgs: ChatMessage[]) {
  const keep = new Set<number>();
  for (let i = msgs.length - 1; i >= 0 && keep.size < 2; i--) if (msgs[i].images?.length || msgs[i].attachments?.length) keep.add(i);
  return msgs.map((message, index) => ({
    role: message.role,
    content: message.content,
    images: keep.has(index) ? message.images : undefined,
    // Older files no longer need their upload data URL, but their extracted text
    // stays in context so the assistant can still refer to previously sent files.
    attachments: message.attachments?.map(({ dataUrl, ...metadata }) => keep.has(index) ? { ...metadata, ...(dataUrl ? { dataUrl } : {}) } : metadata),
    imageCount: message.images?.length || 0
  }));
}

function mergeSettings(saved: Partial<AppSettings> = {}): AppSettings { return { ...DEFAULT_SETTINGS, ...saved }; }

function Brand({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return <a className="brand" href="/" aria-label="LearnGPT" onClick={onNavigate ? (event) => { event.preventDefault(); onNavigate(); } : undefined}><span className="brand-mark"><BookOpen size={compact ? 18 : 21} /></span><span className="brand-name">LearnGPT</span></a>;
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
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { (async () => { const [sessionRes, chatsRes, settingsRes] = await Promise.all([fetch("/api/auth/session"), fetch("/api/chats"), fetch("/api/settings")]); const session = await sessionRes.json(); if (!session.user) { location.href = "/auth/login"; return; } setUser(session.user); if (chatsRes.ok) { const data = await chatsRes.json(); const list = (data.chats || []).map(normalizeChat); chatsRef.current = list; setChats(list); } let saved: Partial<AppSettings> | undefined; if (settingsRes.ok) { const data = await settingsRes.json(); saved = data.settings; } setSettings(mergeSettings(saved)); setLoaded(true); })().catch(() => setStatus("Could not load your workspace.")); }, []);
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
  useEffect(() => { const el = taRef.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 220)}px`; }, [input, images.length, files.length]);
  useEffect(() => { if (!lightbox) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setLightbox(null); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [lightbox]);
  useEffect(() => {
    if (!attachMenuOpen && !modelMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!attachMenuRef.current?.contains(target)) setAttachMenuOpen(false);
      if (!modelMenuRef.current?.contains(target)) setModelMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setAttachMenuOpen(false); setModelMenuOpen(false); } };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); window.removeEventListener("keydown", onKeyDown); };
  }, [attachMenuOpen, modelMenuOpen]);
  const history = useMemo(() => chats.filter((chat) => chat.messages.length), [chats]);
  const displayName = user?.name?.split(" ")[0] || "there";
  const model = settings.model;

  const newChat = () => { setCurrent(null); setInput(""); setImages([]); setFiles([]); setStatus(""); setSidebarOpen(false); if (routeChatId) goTo("/"); };
  const createChat = async (title: string) => { const response = await fetch("/api/chats", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ title }) }); if (!response.ok) throw new Error("Could not create conversation."); const data=await response.json(); const chat=normalizeChat(data.chat); setChats((items)=>[chat,...items]); return chat; };
  const addImages = async (selected: FileList | File[]) => {
    const list = Array.from(selected).filter((file) => file.type.startsWith("image/"));
    if (!list.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) { setStatus(`You can attach up to ${MAX_IMAGES} images per message.`); return; }
    setAttaching(true); setStatus(""); setAttachMenuOpen(false);
    try {
      const added: string[] = [];
      for (const file of list.slice(0, room)) {
        if (file.size > 20 * 1024 * 1024) { setStatus("An image is larger than 20 MB and was skipped."); continue; }
        try {
          const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
          const renamed = new File([file], `image-${crypto.randomUUID()}.${ext}`, { type: file.type || "image/jpeg" });
          added.push(await fileToJpegDataUrl(renamed));
        } catch { setStatus("Could not read one of the images (unsupported format)."); }
      }
      if (added.length) setImages((prev) => [...prev, ...added].slice(0, MAX_IMAGES));
      if (list.length > room) setStatus(`Max ${MAX_IMAGES} images per message — extra images were skipped.`);
    } finally { setAttaching(false); }
  };
  const addDocuments = async (selected: FileList | File[]) => {
    const list = Array.from(selected);
    if (!list.length) return;
    const room = MAX_FILES - files.length;
    if (room <= 0) { setStatus(`You can attach up to ${MAX_FILES} documents or files per message.`); return; }
    setAttaching(true); setStatus(""); setAttachMenuOpen(false);
    try {
      const added: PendingFile[] = [];
      for (const file of list.slice(0, room)) {
        const ext = fileExtension(file);
        if (!ext) { setStatus("Unsupported file type. Choose PDF, DOCX, text, data, or code files."); continue; }
        if (file.size > MAX_FILE_BYTES) { setStatus("Each document or file must be 1 MB or smaller."); continue; }
        try {
          const id = crypto.randomUUID();
          const mimeType = file.type || (ext === "pdf" ? "application/pdf" : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain");
          const renamed = new File([file], `attachment-${id.slice(0, 8)}.${ext}`, { type: mimeType, lastModified: Date.now() });
          const dataUrl = await readFileDataUrl(renamed);
          added.push({ id, name: renamed.name, mimeType, size: renamed.size, dataUrl });
        } catch { setStatus("Could not read one of the selected files."); }
      }
      if (added.length) setFiles((previous) => [...previous, ...added].slice(0, MAX_FILES));
      if (list.length > room) setStatus(`Max ${MAX_FILES} documents or files per message — extras were skipped.`);
    } finally { setAttaching(false); }
  };
  const handleFiles = async (selected: FileList | File[]) => {
    const list = Array.from(selected);
    const imageFiles = list.filter((file) => file.type.startsWith("image/"));
    const otherFiles = list.filter((file) => !file.type.startsWith("image/"));
    if (imageFiles.length) await addImages(imageFiles);
    if (otherFiles.length) await addDocuments(otherFiles);
  };
  const send = async (raw = input, attached = images, attachedFiles = files) => {
    const prompt = raw.trim(); if ((!prompt && !attached.length && !attachedFiles.length) || loading || attaching) return;
    const uploadChars = attached.reduce((total, image) => total + image.length, 0) + attachedFiles.reduce((total, file) => total + file.dataUrl.length, 0);
    if (uploadChars > MAX_COMBINED_UPLOAD_CHARS) { setStatus("Attachments are too large to send together. Remove a file or choose smaller items."); return; }
    setLoading(true); setStatus(""); busyRef.current = true; stickRef.current = true;
    let chat: Chat | null = current;
    try {
      const title = (prompt || (attachedFiles.length ? "Uploaded file" : attached.length ? "Image" : "New conversation")).slice(0, 80);
      if (!chat) chat = await createChat(title);
      const userMessage: ChatMessage = { role: "user", content: prompt, ...(attached.length ? { images: attached } : {}), ...(attachedFiles.length ? { attachments: attachedFiles } : {}) };
      const messages = [...chat.messages, userMessage]; const requestMessages = buildPayload(messages); const requestUploadChars = requestMessages.reduce((total, message) => total + (message.images || []).reduce((sum, image) => sum + image.length, 0) + (message.attachments || []).reduce((sum, file) => sum + (file.dataUrl?.length || 0), 0), 0); if (requestUploadChars > MAX_COMBINED_UPLOAD_CHARS) throw new Error("Attachments are too large to send together. Remove a file or choose smaller items."); const optimistic = { ...chat, title: chat.messages.length ? chat.title : title, messages, updatedAt: Date.now() };
      setCurrent(optimistic); setInput(""); setImages([]); setFiles([]); setSidebarOpen(false); if (routeChatId !== chat.id) goTo(`/chat/${chat.id}`);
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId: chat.id, model, systemPrompt: settings.systemPrompt, messages: requestMessages }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { throw new Error(response.status === 413 ? "Attachments are too large to send. Try fewer or smaller files." : data.error || `Request failed (${response.status})`); }
      const savedUserMessage = { ...userMessage, ...(attachedFiles.length ? { attachments: Array.isArray(data.attachments) ? data.attachments as ChatAttachment[] : [] } : {}) }; const finalChat = { ...optimistic, messages: [...chat.messages, savedUserMessage, { role: "assistant" as const, content: data.text }], updatedAt: Date.now() }; setCurrent(finalChat); setChats((items) => [finalChat, ...items.filter((item) => item.id !== finalChat.id)]);
    } catch (error) {
      // Nothing was saved on failure: put the user's message back in the composer instead of making them retype it.
      if (chat) setCurrent(chat);
      setInput(prompt); setImages(attached); setFiles(attachedFiles);
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
    } finally { busyRef.current = false; setLoading(false); }
  };
  // Server stores model/instructions. The AI API key is configured on the server only.
  const saveSettings = async (next: AppSettings): Promise<string | null> => {
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: next.model, systemPrompt: next.systemPrompt }) });
      if (!response.ok) return "Could not save settings. Please try again.";
    } catch { return "Could not reach the server. Please try again."; }
    setSettings(next); setSettingsOpen(false); setStatus("Settings saved."); setTimeout(() => setStatus(""), 1800);
    return null;
  };
  const changeModel = async (nextModel: LearnModel) => {
    if (nextModel === settings.model) { setModelMenuOpen(false); return; }
    const previous = settings;
    const next = { ...settings, model: nextModel };
    setSettings(next); setModelMenuOpen(false);
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: next.model, systemPrompt: next.systemPrompt }) });
      if (!response.ok) throw new Error("Could not save the selected model.");
      setStatus(`Model saved: ${MODEL_LABELS[nextModel]}.`); setTimeout(() => setStatus(""), 1800);
    } catch {
      setSettings(previous); setStatus("Could not save the selected model. Try again.");
    }
  };
  const signOut = async () => { await fetch("/api/auth/logout",{method:"POST"}); location.href="/auth/login"; };
  const deleteChat = async (id:string) => { const response=await fetch(`/api/chats/${id}`,{method:"DELETE"}); if(response.ok){setChats((items)=>items.filter((item)=>item.id!==id));if(current?.id===id){setCurrent(null);goTo("/");}} };
  const clearHistory = async () => { await Promise.all(chats.map((chat)=>fetch(`/api/chats/${chat.id}`,{method:"DELETE"}))); setChats([]);setCurrent(null);setStatus("");if(routeChatId)goTo("/"); };

  const statusGood = /\bsaved\b/i.test(status);
  const hasMessages = !!current?.messages.length;
  const chatTitle = hasMessages ? current!.title : "New conversation";

  if (!user) return <main className="chat-shell"><div className="loading-screen" role="status"><span className="brand-mark large"><BookOpen size={26}/></span><strong>Loading your workspace…</strong></div></main>;
  return <main className="chat-shell">
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`} aria-label="Conversations">
      <div className="sidebar-top"><Brand compact onNavigate={newChat}/><button className="icon-button close-sidebar" onClick={()=>setSidebarOpen(false)} aria-label="Close menu"><X size={20}/></button></div>
      <button className="new-chat" onClick={newChat}><Plus size={18}/>New conversation</button>
      <nav className="sidebar-nav">
        <p className="nav-label">Workspace</p>
        <button className="nav-item active" aria-current="page"><MessageCircle size={18}/>Chat</button>
        <button className="nav-item" onClick={()=>setStatus(`${history.length} saved conversations`)}><List size={18}/>Activity history<span className="nav-count">{history.length}</span></button>
        <div className="history-head"><p className="nav-label history-label">Recent</p><button className="history-clear" onClick={clearHistory} disabled={!chats.length}><Trash2 size={14}/>Clear all</button></div>
        {history.length ? history.map((chat)=><div className={`history-row ${current?.id===chat.id?"active":""}`} key={chat.id}><button className="history-item" title={chat.title} aria-current={current?.id===chat.id?"true":undefined} onClick={()=>{setCurrent(chat);setSidebarOpen(false);goTo(`/chat/${chat.id}`)}}><span>{chat.title}</span></button><button className="history-delete" onClick={()=>deleteChat(chat.id)} aria-label={`Delete ${chat.title}`}><X size={15}/></button></div>) : <div className="empty-history"><MessageCircle size={18}/><span>Your saved chats will appear here.</span></div>}
      </nav>
      <div className="sidebar-bottom">
        <div className="profile-row"><span className="profile-avatar">{user.avatar?<img src={user.avatar} alt=""/>:<User size={16}/>}</span><span className="profile-copy"><strong>{user.name}</strong>{user.email&&<small>{user.email}</small>}</span></div>
        <div className="sidebar-actions"><button onClick={()=>setSettingsOpen(true)}><SettingsIcon size={17}/>AI settings</button><button onClick={signOut}><LogOut size={17}/>Sign out</button></div>
      </div>
    </aside>
    {sidebarOpen&&<button className="sidebar-backdrop" onClick={()=>setSidebarOpen(false)} aria-label="Close menu"/>}
    <section className="chat-main">
      <header className="chat-header">
        <div className="header-left"><button className="icon-button menu-button" onClick={()=>setSidebarOpen(true)} aria-label="Open menu"><Menu size={20}/></button><h2 className="chat-title" title={chatTitle}>{chatTitle}</h2></div>
      </header>
      <div className="chat-scroll-wrap">
        <div className="chat-content" ref={scrollRef} onScroll={onScroll}>
          {!hasMessages ? <div className="welcome-state">
            <span className="brand-mark large"><BookOpen size={26}/></span>
            <h1>Hi, {displayName}.</h1>
            <p className="welcome-copy">What would you like to learn or get done today?</p>
            <div className="prompt-grid">{promptCards.map((card)=><button key={card.title} onClick={()=>send(card.copy,[])}><span className="prompt-icon">{card.icon}</span><span className="prompt-text"><strong>{card.title}</strong><small>{card.copy}</small></span><ArrowRight size={18} className="prompt-arrow"/></button>)}</div>
          </div> : <div className="conversation">
            {current!.messages.map((message,index)=>message.role==="user"
              ? <div className="message-group" data-msg={index} key={`${message.role}-${index}`}><div className="user-message"><div className="user-bubble">{message.images?.length?<div className={`msg-images ${message.images.length===1?"single":""}`}>{message.images.map((src,i)=><button className="msg-image" key={i} onClick={()=>setLightbox(src)} aria-label={`View image ${i+1}`}><img src={src} alt={`Attachment ${i+1}`}/></button>)}</div>:null}{message.attachments?.length?<div className="message-files">{message.attachments.map((file)=><div className="message-file" key={file.id}><FileText size={15}/><span>{file.name}</span></div>)}</div>:null}{message.content&&<span className="user-text">{message.content}</span>}</div></div></div>
              : <div className="message-group" data-msg={index} key={`${message.role}-${index}`}><div className={`ai-message ${message.content.includes("```")?"rich":""}`}><span className="message-ai-icon" aria-hidden="true"><BookOpen size={16}/></span><div className="ai-body"><span className="sr-only">LearnGPT</span><div className="markdown-content"><MessageContent content={message.content}/></div></div></div></div>)}
            {loading&&<div className="message-group"><div className="ai-message"><span className="message-ai-icon" aria-hidden="true"><BookOpen size={16}/></span><div className="ai-body"><span className="sr-only">LearnGPT</span><div className="markdown-content"><p className="thinking-text" role="status">Thinking…</p></div></div></div></div>}
          </div>}
        </div>
        {status&&<div className={`chat-status ${statusGood?"ok":""}`} role="status">{statusGood?<Check size={16}/>:<AlertCircle size={16}/>}<span>{status}</span><button onClick={()=>setStatus("")} aria-label="Dismiss message"><X size={15}/></button></div>}
        {showJump&&msgCount>0&&<button className="jump-bottom" onClick={()=>scrollToBottom(true)} aria-label="Scroll to latest message"><ArrowDown size={18}/></button>}
      </div>
      <div className="composer-zone" onDragOver={(event)=>{if(event.dataTransfer.types.includes("Files")){event.preventDefault();setDragging(true)}}} onDragLeave={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setDragging(false)}} onDrop={(event)=>{event.preventDefault();setDragging(false);if(event.dataTransfer.files.length)void handleFiles(event.dataTransfer.files)}}>
        <div className={`composer ${images.length||files.length||attaching?"has-images":""} ${dragging?"dragging":""}`}>
          {(images.length>0||files.length>0||attaching)&&<div className="attachment-tray">
            {images.map((src,index)=><div className="attachment" key={`${index}-${src.length}`}><img src={src} alt={`Image attachment ${index+1}`}/><button className="attachment-remove" onClick={()=>setImages((items)=>items.filter((_,i)=>i!==index))} aria-label={`Remove image ${index+1}`}><X size={14}/></button></div>)}
            {files.map((file)=><div className="attachment-file" key={file.id}><FileText size={19}/><span title={file.name}>{file.name}</span><button className="attachment-remove" onClick={()=>setFiles((items)=>items.filter((item)=>item.id!==file.id))} aria-label={`Remove ${file.name}`}><X size={14}/></button></div>)}
            {attaching&&<div className="attachment attachment-loading" aria-label="Processing attachment"><i/></div>}
          </div>}
          <div className="composer-row">
            <div className="attach-menu-wrap" ref={attachMenuRef}>
              <button className="attach-button" aria-label="Attach files" title="Attach files or images" disabled={attaching||files.length>=MAX_FILES&&images.length>=MAX_IMAGES} aria-expanded={attachMenuOpen} onClick={()=>setAttachMenuOpen((open)=>!open)}><Plus size={21}/></button>
              {attachMenuOpen&&<div className="composer-menu attach-menu" role="menu">
                <button role="menuitem" onClick={()=>{setAttachMenuOpen(false);fileInputRef.current?.click()}}><FileText size={17}/><span><strong>Documents & files</strong><small>PDF, DOCX, text, data, code</small></span></button>
                <button role="menuitem" onClick={()=>{setAttachMenuOpen(false);imageInputRef.current?.click()}}><ImageIcon size={17}/><span><strong>Images</strong><small>PNG, JPG, WEBP, GIF</small></span></button>
              </div>}
            </div>
            <input ref={fileInputRef} type="file" accept={ACCEPTED_FILE_TYPES} multiple hidden onChange={(event)=>{if(event.target.files?.length)addDocuments(event.target.files);event.target.value=""}}/>
            <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={(event)=>{if(event.target.files?.length)addImages(event.target.files);event.target.value=""}}/>
            <textarea ref={taRef} rows={1} aria-label="Message" value={input} onChange={(event)=>setInput(event.target.value)} onPaste={(event)=>{const pasted=Array.from(event.clipboardData.files).filter((file)=>file.type.startsWith("image/"));if(pasted.length){event.preventDefault();addImages(pasted)}}} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send()}}} placeholder={images.length||files.length?"Add a message about your attachments…":"Ask anything…"}/>
            <div className="model-picker-wrap" ref={modelMenuRef}>
              <button className="model-picker-trigger" aria-label={`Choose model, current model ${MODEL_LABELS[model]}`} aria-haspopup="listbox" aria-expanded={modelMenuOpen} onClick={()=>setModelMenuOpen((open)=>!open)}><span>{MODEL_SHORT_LABELS[model]}</span><ChevronDown size={15}/></button>
              {modelMenuOpen&&<div className="composer-menu model-menu" role="listbox" aria-label="Choose a LearnGPT model">
                {LEARN_MODELS.map((item)=><button className="model-option" key={item} role="option" aria-selected={model===item} onClick={()=>changeModel(item)}><span><strong>{MODEL_LABELS[item]}</strong><small>{item==="learn-1.0-smart"?"For everyday questions":item==="learn-1.0-study"?"For guided explanations and practice":"For complex questions and reasoning"}</small></span>{model===item&&<Check size={16}/>}</button>)}
              </div>}
            </div>
            <button className="send-button" disabled={(!input.trim()&&!images.length&&!files.length)||loading||attaching} onClick={()=>send()} aria-label="Send message"><Send size={18}/></button>
          </div>
          {dragging&&<div className="drop-hint"><Paperclip size={20}/>Drop files or images to attach</div>}
        </div>
        <p>Your chats are saved to your LearnGPT account. LearnGPT can make mistakes.</p>
      </div>
    </section>{lightbox&&<div className="lightbox" role="dialog" aria-modal="true" aria-label="Image preview" onClick={()=>setLightbox(null)}><button className="lightbox-close" aria-label="Close image" onClick={()=>setLightbox(null)}><X size={20}/></button><img src={lightbox} alt="Attachment preview" onClick={(event)=>event.stopPropagation()}/></div>}{settingsOpen&&<SettingsModal settings={settings} onClose={()=>setSettingsOpen(false)} onSave={saveSettings}/>}</main>;
}
