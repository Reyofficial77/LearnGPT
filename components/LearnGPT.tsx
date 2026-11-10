"use client";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowDown, BookOpen, Check, ChevronUp, Camera, Code, FileText, Folder, Image as ImageIcon, Menu, Mic, Paperclip, Plus, Send, X, Zap, Globe } from "react-feather";
import { usePathname } from "next/navigation";
import MessageContent from "./MessageContent";
import CameraCapture from "./CameraCapture";
import SettingsModal from "./SettingsModal";
import Sidebar from "./Sidebar";
import { DeleteProjectModal, HelpModal, LanguageModal, ProjectModal } from "./SidebarDialogs";
import { DEFAULT_SETTINGS, type Chat, type ChatAttachment, type ChatMessage, type ProjectSummary, type Settings as AppSettings } from "../lib/types";
import { DEFAULT_LANG, LANG_STORAGE_KEY, SUPPORTED_LANGUAGES, getDict, type Lang } from "../lib/i18n";
import { isReservedSlug } from "../lib/slug";
import { LEARN_MODELS, MODEL_LABELS } from "../lib/models";
import type { LearnModel } from "../lib/types";

type PendingFile = ChatAttachment & { dataUrl: string };

const NEW_CHAT_TITLE = "New Chat";
// URL shapes: "/" (new chat) · "/chat/{id}" (chat) · "/{project}" (project page) · "/{project}/{id}" (chat inside a project)
type Route = { kind: "home" } | { kind: "chat"; chatId: string } | { kind: "project"; slug: string } | { kind: "project-chat"; slug: string; chatId: string };
function parseRoute(pathname: string): Route {
  const parts = (pathname || "/").split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === "chat") return { kind: "chat", chatId: parts[1] };
  if (parts.length === 1 && !isReservedSlug(parts[0])) return { kind: "project", slug: parts[0] };
  if (parts.length === 2 && !isReservedSlug(parts[0])) return { kind: "project-chat", slug: parts[0], chatId: parts[1] };
  return { kind: "home" };
}
function chatPath(chat: { id: string; projectId?: string | null }, projects: ProjectSummary[]) {
  const project = chat.projectId ? projects.find((item) => item.id === chat.projectId) : undefined;
  return project ? `/${project.slug}/${chat.id}` : `/chat/${chat.id}`;
}
// API rows may come without `messages` (e.g. a freshly created chat) -> always normalize.
function normalizeChat(raw: any): Chat { return { id: raw.id, projectId: typeof raw.projectId === "string" ? raw.projectId : null, title: raw.title || NEW_CHAT_TITLE, messages: Array.isArray(raw.messages) ? raw.messages.map((m: any) => ({ role: m.role, content: m.content, ...(Array.isArray(m.images) && m.images.length ? { images: m.images as string[] } : {}), ...(Array.isArray(m.attachments) && m.attachments.length ? { attachments: m.attachments as ChatAttachment[] } : {}) })) : [], updatedAt: raw.updatedAt ? new Date(raw.updatedAt).getTime() : Date.now(), pinned: Boolean(raw.pinned), isPublic: Boolean(raw.isPublic) }; }

// Client-side URL change with NO network request and NO reload (like ChatGPT/Claude).
// Next.js syncs native history.pushState/replaceState with usePathname().
function goTo(path: string, mode: "push" | "replace" = "push") {
  if (typeof window === "undefined" || window.location.pathname === path) return;
  window.history[mode === "push" ? "pushState" : "replaceState"](null, "", path);
}

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

function mergeSettings(saved: Partial<AppSettings> = {}): AppSettings { return { ...DEFAULT_SETTINGS, ...saved, enabledSkills: ["frontend-design"] }; }
function randomGreetingIndex(lang: Lang, previous = -1) {
  const count = getDict(lang).greetings.length;
  let next = Math.floor(Math.random() * count);
  if (count > 1 && next === previous) next = (next + 1 + Math.floor(Math.random() * (count - 1))) % count;
  return next;
}

export default function LearnGPT() {
  const [user, setUser] = useState<{ provider:string; name:string; email?:string; avatar?:string } | null>(null);
  const [skills, setSkills] = useState<{ id:string; name:string; slug:string; builtIn:boolean }[]>([{ id:"builtin-frontend-design", name:"Frontend design", slug:"frontend-design", builtIn:true }]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [chats, setChats] = useState<Chat[]>([]);
  const [current, setCurrent] = useState<Chat | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [webSearchOnce, setWebSearchOnce] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(null);
  const pathname = usePathname();
  const route = parseRoute(pathname || "/");
  const routeSlug = route.kind === "project" || route.kind === "project-chat" ? route.slug : null;
  const chatsRef = useRef<Chat[]>([]);
  const projectsRef = useRef<ProjectSummary[]>([]);
  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const recognitionRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletedSlugsRef = useRef<Set<string>>(new Set());
  const busyRef = useRef(false);
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skillFileInputRef = useRef<HTMLInputElement>(null);
  const skillMenuRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { (async () => { const [sessionRes, chatsRes, settingsRes, projectsRes, skillsRes] = await Promise.all([fetch("/api/auth/session"), fetch("/api/chats"), fetch("/api/settings"), fetch("/api/projects"), fetch("/api/skills")]); const session = await sessionRes.json(); if (!session.user) { location.href = "/auth/login"; return; } setUser(session.user); if (chatsRes.ok) { const data = await chatsRes.json(); const list = (data.chats || []).map(normalizeChat); chatsRef.current = list; setChats(list); } if (projectsRes.ok) { const data = await projectsRes.json(); const projectList: ProjectSummary[] = data.projects || []; projectsRef.current = projectList; setProjects(projectList); } if (skillsRes.ok) { const data = await skillsRes.json(); if (Array.isArray(data.skills)) setSkills(data.skills); } let saved: Partial<AppSettings> | undefined; if (settingsRes.ok) { const data = await settingsRes.json(); saved = data.settings; } setSettings(mergeSettings(saved)); setLoaded(true); })().catch(() => setStatus(getDict(lang).workspaceLoadError)); }, []);
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  // Keep the UI in sync with the URL — direct visits, refresh, back/forward.
  // Reads projects/chats from refs so a project created or deleted in the same tick is already visible.
  useEffect(() => {
    if (!loaded || busyRef.current) return;
    if (route.kind === "home") { if (current) setCurrent(null); return; }
    const slug = route.kind === "project" || route.kind === "project-chat" ? route.slug : null;
    const slugWasDeleted = !!slug && deletedSlugsRef.current.has(slug);
    if (slug && !projectsRef.current.some((project) => project.slug === slug)) {
      setCurrent(null);
      if (!slugWasDeleted) setStatus(getDict(lang).projectNotFound);
      goTo("/", "replace");
      return;
    }
    if (route.kind === "project") { if (current) setCurrent(null); setStatus(""); return; }
    const found = chatsRef.current.find((chat) => chat.id === route.chatId);
    if (!found) { setCurrent(null); if (!slugWasDeleted) setStatus(getDict(lang).conversationNotFound); goTo("/", "replace"); return; }
    const canonical = chatPath(found, projectsRef.current); // wrong prefix for this chat -> fix the address bar
    if (window.location.pathname !== canonical) goTo(canonical, "replace");
    if (current?.id !== found.id) { setCurrent(found); setStatus(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, loaded]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      const initialLang: Lang = SUPPORTED_LANGUAGES.some(([code]) => code === saved) ? saved as Lang : DEFAULT_LANG;
      if (initialLang !== DEFAULT_LANG) setLang(initialLang);
      document.documentElement.lang = initialLang;
      setGreetingIndex(randomGreetingIndex(initialLang));
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 901px)");
    const sync = () => setSidebarOpen(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => { const theme = settings.theme || "dark"; document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme === "system" ? "light dark" : theme; }, [settings.theme]);
  // Stop the microphone if the component goes away.
  useEffect(() => () => { shouldListenRef.current = false; if (recognitionRestartRef.current) clearTimeout(recognitionRestartRef.current); try { recognitionRef.current?.abort(); } catch { /* already stopped */ } }, []);
  // Ctrl+Shift+, opens Settings (shown in the account menu).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === "Comma") { event.preventDefault(); setSidebarOpen(false); setSettingsOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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
  useEffect(() => {
    if (!skillMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!skillMenuRef.current?.contains(target) && !taRef.current?.contains(target)) setSkillMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [skillMenuOpen]);
  const displayName = user?.name?.split(" ")[0] || (lang === "id" ? "di sana" : "there");
  const model = settings.model;
  const closeSidebarOnMobile = () => { if (window.matchMedia("(max-width: 900px)").matches) setSidebarOpen(false); };

  const newChat = () => { setCurrent(null); setInput(""); setImages([]); setFiles([]); setStatus(""); closeSidebarOnMobile(); setGreetingIndex(randomGreetingIndex(lang, greetingIndex)); if (route.kind !== "home") goTo("/"); };
  const createChat = async (title: string, projectId: string | null = null) => { const response = await fetch("/api/chats", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ title, ...(projectId ? { projectId } : {}) }) }); if (!response.ok) throw new Error(getDict(lang).createConversationError); const data=await response.json(); const chat=normalizeChat(data.chat); setChats((items)=>[chat,...items]); return chat; };
  const addImages = async (selected: FileList | File[]) => {
    const list = Array.from(selected).filter((file) => file.type.startsWith("image/"));
    if (!list.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) { setStatus(getDict(lang).imageLimit(MAX_IMAGES)); return; }
    setAttaching(true); setStatus(""); setAttachMenuOpen(false);
    try {
      const added: string[] = [];
      for (const file of list.slice(0, room)) {
        if (file.size > 20 * 1024 * 1024) { setStatus(getDict(lang).imageTooLarge); continue; }
        try {
          const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
          const renamed = new File([file], `image-${crypto.randomUUID()}.${ext}`, { type: file.type || "image/jpeg" });
          added.push(await fileToJpegDataUrl(renamed));
        } catch { setStatus(getDict(lang).imageReadError); }
      }
      if (added.length) setImages((prev) => [...prev, ...added].slice(0, MAX_IMAGES));
      if (list.length > room) setStatus(getDict(lang).imageExtraSkipped(MAX_IMAGES));
    } finally { setAttaching(false); }
  };
  const addDocuments = async (selected: FileList | File[]) => {
    const list = Array.from(selected);
    if (!list.length) return;
    const room = MAX_FILES - files.length;
    if (room <= 0) { setStatus(getDict(lang).fileLimit(MAX_FILES)); return; }
    setAttaching(true); setStatus(""); setAttachMenuOpen(false);
    try {
      const added: PendingFile[] = [];
      for (const file of list.slice(0, room)) {
        const ext = fileExtension(file);
        if (!ext) { setStatus(getDict(lang).unsupportedFile); continue; }
        if (file.size > MAX_FILE_BYTES) { setStatus(getDict(lang).fileTooLarge); continue; }
        try {
          const id = crypto.randomUUID();
          const mimeType = file.type || (ext === "pdf" ? "application/pdf" : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain");
          const renamed = new File([file], `attachment-${id.slice(0, 8)}.${ext}`, { type: mimeType, lastModified: Date.now() });
          const dataUrl = await readFileDataUrl(renamed);
          added.push({ id, name: renamed.name, mimeType, size: renamed.size, dataUrl });
        } catch { setStatus(getDict(lang).fileReadError); }
      }
      if (added.length) setFiles((previous) => [...previous, ...added].slice(0, MAX_FILES));
      if (list.length > room) setStatus(getDict(lang).fileExtraSkipped(MAX_FILES));
    } finally { setAttaching(false); }
  };
  const handleFiles = async (selected: FileList | File[]) => {
    const list = Array.from(selected);
    const imageFiles = list.filter((file) => file.type.startsWith("image/"));
    const otherFiles = list.filter((file) => !file.type.startsWith("image/"));
    if (imageFiles.length) await addImages(imageFiles);
    if (otherFiles.length) await addDocuments(otherFiles);
  };
  const uploadSkill = async (file: File, name = ""): Promise<string | null> => {
    const form = new FormData(); form.set("file", file); form.set("name", name);
    try {
      const response = await fetch("/api/skills", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return data.error || "Could not save the skill.";
      setSkills((items) => [...items.filter((item) => item.slug !== data.skill.slug), { ...data.skill, builtIn: false }].sort((a, b) => a.builtIn ? -1 : b.builtIn ? 1 : a.name.localeCompare(b.name)));
      setStatus(`Skill added: ${data.skill.name}`);
      setTimeout(() => setStatus(""), 2200);
      return null;
    } catch { return getDict(lang).serverUnavailable; }
  };
  const deleteSkill = async (slug: string): Promise<string | null> => {
    try {
      const response = await fetch("/api/skills", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return data.error || "Could not remove the skill.";
      setSkills((items) => items.filter((item) => item.slug !== slug));
      return null;
    } catch { return getDict(lang).serverUnavailable; }
  };
  const send = async (raw = input, attached = images, attachedFiles = files) => {
    const forceWebSearch = webSearchOnce;
    const prompt = raw.trim(); if ((!prompt && !attached.length && !attachedFiles.length) || loading || attaching) return;
    const uploadChars = attached.reduce((total, image) => total + image.length, 0) + attachedFiles.reduce((total, file) => total + file.dataUrl.length, 0);
    if (uploadChars > MAX_COMBINED_UPLOAD_CHARS) { setStatus(getDict(lang).attachmentsTooLarge); return; }
    cancelDictation(); setLoading(true); setStatus(""); busyRef.current = true; stickRef.current = true;
    let chat: Chat | null = current;
    try {
      // The AI writes the real title from the first prompt (returned by /api/chat); until then the sidebar shows a placeholder.
      const draftTitle = (prompt || (attachedFiles.length ? "Uploaded file" : attached.length ? "Image" : NEW_CHAT_TITLE)).slice(0, 40);
      if (!chat) chat = await createChat(NEW_CHAT_TITLE, route.kind === "project" ? (projectsRef.current.find((project) => project.slug === route.slug)?.id ?? null) : null);
      const userMessage: ChatMessage = { role: "user", content: prompt, ...(attached.length ? { images: attached } : {}), ...(attachedFiles.length ? { attachments: attachedFiles } : {}) };
      const messages = [...chat.messages, userMessage]; const requestMessages = buildPayload(messages); const requestUploadChars = requestMessages.reduce((total, message) => total + (message.images || []).reduce((sum, image) => sum + image.length, 0) + (message.attachments || []).reduce((sum, file) => sum + ("dataUrl" in file && typeof file.dataUrl === "string" ? file.dataUrl.length : 0), 0), 0); if (requestUploadChars > MAX_COMBINED_UPLOAD_CHARS) throw new Error(getDict(lang).attachmentsTooLarge); const optimistic = { ...chat, title: chat.messages.length ? chat.title : NEW_CHAT_TITLE, messages, updatedAt: Date.now() };
      setCurrent(optimistic); setChats((items) => [optimistic, ...items.filter((item) => item.id !== optimistic.id)].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)); setInput(""); setImages([]); setFiles([]); closeSidebarOnMobile(); goTo(chatPath(chat, projectsRef.current));
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId: chat.id, model, messages: requestMessages, webSearch: forceWebSearch }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { throw new Error(response.status === 413 ? getDict(lang).attachmentsTooLargeRetry : data.error || `${lang === "id" ? "Permintaan gagal" : "Request failed"} (${response.status})`); }
      setWebSearchOnce(false);
      const savedUserMessage = { ...userMessage, ...(attachedFiles.length ? { attachments: Array.isArray(data.attachments) ? data.attachments as ChatAttachment[] : [] } : {}) }; const finalChat = { ...optimistic, title: chat.messages.length ? chat.title : (typeof data.title === "string" && data.title.trim() ? data.title.trim().slice(0, 80) : draftTitle), messages: [...chat.messages, savedUserMessage, { role: "assistant" as const, content: data.text }], updatedAt: Date.now() }; setCurrent(finalChat); setChats((items) => [finalChat, ...items.filter((item) => item.id !== finalChat.id)].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt));
    } catch (error) {
      // Nothing was saved on failure: put the user's message back in the composer instead of making them retype it.
      if (chat) { const restored = chat; setCurrent(restored); setChats((items) => items.map((item) => item.id === restored.id ? restored : item)); }
      setInput(prompt); setImages(attached); setFiles(attachedFiles);
      setStatus(error instanceof Error ? error.message : getDict(lang).somethingWrong);
    } finally { busyRef.current = false; setLoading(false); }
  };
  // Server stores model/instructions. The AI API key is configured on the server only.
  const saveSettings = async (next: AppSettings): Promise<string | null> => {
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (!response.ok) return getDict(lang).settingsError;
    } catch { return getDict(lang).serverUnavailable; }
    setSettings(next); setSettingsOpen(false); setStatus(getDict(lang).settingsSaved); setTimeout(() => setStatus(""), 1800);
    return null;
  };
  const changeModel = async (nextModel: LearnModel) => {
    if (nextModel === settings.model) { setModelMenuOpen(false); return; }
    const previous = settings;
    const next = { ...settings, model: nextModel };
    setSettings(next); setModelMenuOpen(false);
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error(getDict(lang).modelSaveFailed);
      setStatus(getDict(lang).modelSaved(MODEL_LABELS[nextModel])); setTimeout(() => setStatus(""), 1800);
    } catch {
      setSettings(previous); setStatus(getDict(lang).modelSaveFailed);
    }
  };
  // Keep the browser recognizer alive across brief pauses; users stop it explicitly from the mic or input field.
  const cancelDictation = () => {
    shouldListenRef.current = false;
    if (recognitionRestartRef.current) { clearTimeout(recognitionRestartRef.current); recognitionRestartRef.current = null; }
    const recognition = recognitionRef.current; recognitionRef.current = null; setListening(false);
    try { recognition?.abort(); } catch { /* already stopped */ }
  };
  const toggleDictation = () => {
    if (shouldListenRef.current || listening) { cancelDictation(); return; }
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) { setStatus(getDict(lang).dictationNotSupported); return; }
    const recognition = new Recognition();
    const browserLanguage = (navigator.language || "en-US");
    const automaticLanguage = browserLanguage.toLowerCase() === "id" ? "id-ID" : browserLanguage.toLowerCase() === "en" ? "en-US" : browserLanguage;
    recognition.lang = settings.speechLanguage === "auto" ? automaticLanguage : settings.speechLanguage;
    recognition.maxAlternatives = 1; recognition.continuous = true; recognition.interimResults = true;
    const base = input.trim() ? `${input.replace(/\s+$/, "")} ` : "";
    let finalText = "";
    recognition.onstart = () => { if (shouldListenRef.current && recognitionRef.current === recognition) setListening(true); };
    recognition.onresult = (event: any) => {
      if (recognitionRef.current !== recognition || !shouldListenRef.current) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += `${result[0].transcript} `;
        else interim += result[0].transcript;
      }
      setInput(base + (finalText + interim).replace(/\s+/g, " ").replace(/^\s+/, ""));
    };
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") { setStatus(getDict(lang).microphoneBlocked); cancelDictation(); }
      else if (event.error === "network") { setStatus(getDict(lang).dictationNetwork); cancelDictation(); }
      else if (event.error === "audio-capture") { setStatus(getDict(lang).microphoneMissing); cancelDictation(); }
      else if (event.error !== "no-speech" && event.error !== "aborted") setStatus(getDict(lang).dictationUnexpected);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition || !shouldListenRef.current) return;
      if (recognitionRestartRef.current) clearTimeout(recognitionRestartRef.current);
      recognitionRestartRef.current = setTimeout(() => {
        recognitionRestartRef.current = null;
        if (!shouldListenRef.current || recognitionRef.current !== recognition) return;
        try { recognition.start(); } catch { recognitionRestartRef.current = setTimeout(() => { try { if (shouldListenRef.current && recognitionRef.current === recognition) recognition.start(); } catch { cancelDictation(); } }, 350); }
      }, 220);
    };
    recognitionRef.current = recognition; shouldListenRef.current = true; setStatus("");
    try { recognition.start(); setListening(true); } catch { shouldListenRef.current = false; recognitionRef.current = null; setStatus(getDict(lang).microphoneStartFailed); }
  };
  const signOut = async () => { await fetch("/api/auth/logout",{method:"POST"}); location.href="/auth/login"; };
  const deleteChat = async (id:string) => { const target = chats.find((item)=>item.id===id); const response=await fetch(`/api/chats/${id}`,{method:"DELETE"}); if(response.ok){setChats((items)=>items.filter((item)=>item.id!==id));if(current?.id===id){const home=target?.projectId?projectsRef.current.find((project)=>project.id===target.projectId):undefined;setCurrent(null);goTo(home?`/${home.slug}`:"/");}} };
  const updateChat = (updated: Partial<Chat> & { id: string }) => {
    setChats((items) => items.map((chat) => chat.id === updated.id ? { ...chat, ...updated } : chat).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt));
    setCurrent((chat) => chat?.id === updated.id ? { ...chat, ...updated } : chat);
  };
  const renameChat = async (chat: Chat) => {
    const nextTitle = window.prompt(labels.titlePrompt, chat.title);
    if (nextTitle === null) return;
    const title = nextTitle.trim();
    if (!title) { setStatus(labels.titleRequired); return; }
    const response = await fetch(`/api/chats/${chat.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) { setStatus(data?.error || labels.shareFailed); return; }
    updateChat({ id: chat.id, title: data.chat.title });
  };
  const togglePinChat = async (chat: Chat) => {
    const pinned = !chat.pinned;
    const response = await fetch(`/api/chats/${chat.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned }) }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) { setStatus(data?.error || labels.shareFailed); return; }
    updateChat({ id: chat.id, pinned: Boolean(data.chat.pinned) });
    setStatus(pinned ? labels.chatPinned : labels.chatUnpinned);
  };
  const shareChat = async (chat: Chat) => {
    const isPublic = !chat.isPublic;
    const response = await fetch(`/api/chats/${chat.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublic }) }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) { setStatus(data?.error || labels.shareFailed); return; }
    updateChat({ id: chat.id, isPublic: Boolean(data.chat.isPublic) });
    if (!isPublic) { setStatus(labels.sharePrivate); return; }
    const url = `${window.location.origin}/shared/c/${chat.id}`;
    try { await navigator.clipboard.writeText(url); setStatus(labels.shareCopied); }
    catch {
      const field = document.createElement("textarea"); field.value = url; field.style.position = "fixed"; field.style.opacity = "0"; document.body.appendChild(field); field.select();
      const copied = document.execCommand("copy"); field.remove(); setStatus(copied ? labels.shareCopied : url);
    }
  };
  // "Clear all" belongs to the Chat section, so it only removes chats that are not inside a project.
  const clearHistory = async () => { const plain = chats.filter((chat)=>!chat.projectId); await Promise.all(plain.map((chat)=>fetch(`/api/chats/${chat.id}`,{method:"DELETE"}))); setChats((items)=>items.filter((chat)=>chat.projectId)); if(current&&!current.projectId){setCurrent(null);setStatus("");goTo("/");} };
  const openProject = (project: ProjectSummary) => { setCurrent(null); setInput(""); setImages([]); setFiles([]); setStatus(""); closeSidebarOnMobile(); goTo(`/${project.slug}`); };
  const openChat = (chat: Chat) => { setCurrent(chat); closeSidebarOnMobile(); goTo(chatPath(chat, projectsRef.current)); };
  const createProject = async (name: string, goal: string): Promise<string | null> => {
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, goal }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.project) return data.error || "Could not create the project.";
      const project = data.project as ProjectSummary;
      projectsRef.current = [project, ...projectsRef.current];
      setProjects(projectsRef.current);
      setProjectModalOpen(false); openProject(project);
      return null;
    } catch { return getDict(lang).serverUnavailable; }
  };
  const deleteProject = async (project: ProjectSummary) => {
    const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { setProjectToDelete(null); setStatus(getDict(lang).projectDeleteFailed); return; }
    deletedSlugsRef.current.add(project.slug);
    projectsRef.current = projectsRef.current.filter((item) => item.id !== project.id);
    setProjects(projectsRef.current);
    setChats((items) => items.filter((chat) => chat.projectId !== project.id));
    setProjectToDelete(null);
    if (current?.projectId === project.id || routeSlug === project.slug) { setCurrent(null); goTo("/"); }
  };
  const changeLang = (next: Lang) => { setLang(next); document.documentElement.lang = next; setLanguageOpen(false); setGreetingIndex(randomGreetingIndex(next, greetingIndex)); try { localStorage.setItem(LANG_STORAGE_KEY, next); } catch { /* storage unavailable */ } };

  const statusGood = /\bsaved\b|berhasil|tersimpan|disalin/i.test(status);
  const hasMessages = !!current?.messages.length;
  const labels = getDict(lang);
  const slashMatch = input.match(/(?:^|\s)\/([a-z0-9-]*)$/i);
  const slashSkills = slashMatch ? skills.filter((skill) => `${skill.name} ${skill.slug}`.toLowerCase().includes(slashMatch[1].toLowerCase())) : [];
  const chooseSkill = (slug: string) => {
    const match = input.match(/(?:^|\s)\/([a-z0-9-]*)$/i);
    const prefix = match ? input.slice(0, match.index) : input;
    const spacer = prefix && !/\s$/.test(prefix) ? " " : "";
    setInput(`${prefix}${spacer}/${slug} `); setSkillMenuOpen(false); taRef.current?.focus();
  };
  const resizeSidebar = (nextWidth: number) => {
    if (nextWidth < 190) { setSidebarOpen(false); return; }
    setSidebarOpen(true); setSidebarWidth(Math.min(380, Math.max(216, nextWidth)));
  };
  const routeProject = routeSlug ? projects.find((project) => project.slug === routeSlug) ?? null : null;
  const currentProject = current?.projectId ? projects.find((project) => project.id === current.projectId) ?? null : null;
  const activeProjectId = currentProject?.id ?? (route.kind === "project" ? routeProject?.id ?? null : null);
  const showProjectHome = !hasMessages && route.kind === "project" && !!routeProject;
  const titlingChatId = loading && current && current.messages.length === 1 ? current.id : null;
  const chatTitle = hasMessages ? current!.title : showProjectHome ? routeProject!.name : NEW_CHAT_TITLE;

  if (!user) return <main className="chat-shell"><div className="loading-screen" role="status"><span className="brand-mark large"><BookOpen size={26}/></span><strong>{labels.loadingWorkspace}</strong></div></main>;
  return <main className="chat-shell" onDragOver={(event)=>{if(event.dataTransfer.types.includes("Files")){event.preventDefault();setDragging(true)}}} onDragLeave={(event)=>{const target=event.relatedTarget;if(!(target instanceof Node)||!event.currentTarget.contains(target))setDragging(false)}} onDrop={(event)=>{if(event.dataTransfer.types.includes("Files")){event.preventDefault();setDragging(false);if(event.dataTransfer.files.length)void handleFiles(event.dataTransfer.files)}}}>
    <Sidebar t={labels} open={sidebarOpen} width={sidebarWidth} onResize={resizeSidebar} user={user} projects={projects} chats={chats} currentChatId={current?.id ?? null} activeProjectId={activeProjectId} titlingChatId={titlingChatId}
      onClose={()=>setSidebarOpen(false)} onToggleSidebar={()=>setSidebarOpen((open)=>!open)} onNewChat={newChat} onCreateProject={()=>{closeSidebarOnMobile();setProjectModalOpen(true)}} onOpenProject={openProject} onDeleteProject={setProjectToDelete}
      onOpenChat={openChat} onDeleteChat={deleteChat} onRenameChat={renameChat} onPinChat={togglePinChat} onShareChat={shareChat} onClearChats={clearHistory}
      onOpenSettings={()=>{closeSidebarOnMobile();setSettingsOpen(true)}} onOpenLanguage={()=>{closeSidebarOnMobile();setLanguageOpen(true)}} onOpenHelp={()=>{closeSidebarOnMobile();setHelpOpen(true)}} onSignOut={signOut}/>
    {sidebarOpen&&<button className="sidebar-backdrop" onClick={()=>setSidebarOpen(false)} aria-label={labels.closeMenu}/> }
    <section className="chat-main">
      <header className="chat-header">
        <div className="header-left"><button className="icon-button menu-button" onClick={()=>setSidebarOpen((open)=>!open)} aria-label={labels.toggleSidebar} aria-expanded={sidebarOpen}><Menu size={20}/></button>{currentProject&&<><button className="chat-crumb" title={currentProject.goal} onClick={()=>openProject(currentProject)}>{currentProject.name}</button><span className="crumb-sep" aria-hidden="true">/</span></>}<h2 className="chat-title" title={chatTitle}>{chatTitle}</h2></div>
      </header>
      <div className="chat-scroll-wrap">
        <div className="chat-content" ref={scrollRef} onScroll={onScroll}>
          {showProjectHome ? <div className="welcome-state project-welcome">
            <span className="brand-mark large"><Folder size={26}/></span>
            <h1>{routeProject!.name}</h1>
            <p className="welcome-copy">{routeProject!.goal}</p>
          </div> : !hasMessages ? <div className="welcome-state">
            <span className="brand-mark large"><BookOpen size={26}/></span>
            <h1>{labels.welcomeHeading(displayName)}</h1>
            <p className="welcome-copy">{labels.greetings[greetingIndex % labels.greetings.length]}</p>
            
          </div> : <div className="conversation">
            {current!.messages.map((message,index)=>message.role==="user"
              ? <div className="message-group" data-msg={index} key={`${message.role}-${index}`}><div className="user-message"><div className="user-bubble">{message.images?.length?<div className={`msg-images ${message.images.length===1?"single":""}`}>{message.images.map((src,i)=><button className="msg-image" key={i} onClick={()=>setLightbox(src)} aria-label={labels.viewImage(i+1)}><img src={src} alt={`Attachment ${i+1}`}/></button>)}</div>:null}{message.attachments?.length?<div className="message-files">{message.attachments.map((file)=><div className="message-file" key={file.id}><FileText size={15}/><span>{file.name}</span></div>)}</div>:null}{message.content&&<span className="user-text">{message.content}</span>}</div></div></div>
              : <div className="message-group" data-msg={index} key={`${message.role}-${index}`}><div className={`ai-message ${message.content.includes("```")?"rich":""}`}><span className="message-ai-icon" aria-hidden="true"><BookOpen size={16}/></span><div className="ai-body"><span className="sr-only">LearnGPT</span><div className="markdown-content"><MessageContent content={message.content}/></div></div></div></div>)}
            {loading&&<div className="message-group"><div className="ai-message"><span className="message-ai-icon" aria-hidden="true"><BookOpen size={16}/></span><div className="ai-body"><span className="sr-only">LearnGPT</span><div className="markdown-content"><p className="thinking-text" role="status">{labels.thinking}</p></div></div></div></div>}
          </div>}
        </div>
        {status&&<div className={`chat-status ${statusGood?"ok":""}`} role="status">{statusGood?<Check size={16}/>:<AlertCircle size={16}/>}<span>{status}</span><button onClick={()=>setStatus("")} aria-label={labels.dismissMessage}><X size={15}/></button></div>}
        {showJump&&msgCount>0&&<button className="jump-bottom" onClick={()=>scrollToBottom(true)} aria-label={labels.scrollToLatest}><ArrowDown size={18}/></button>}
      </div>
      <div className="composer-zone">
        <div className={`composer ${images.length||files.length||attaching?"has-images":""} ${dragging?"dragging":""}`}>
          {(images.length>0||files.length>0||attaching)&&<div className="attachment-tray">
            {images.map((src,index)=><div className="attachment" key={`${index}-${src.length}`}><img src={src} alt={`Image attachment ${index+1}`}/><button className="attachment-remove" onClick={()=>setImages((items)=>items.filter((_,i)=>i!==index))} aria-label={`Remove image ${index+1}`}><X size={14}/></button></div>)}
            {files.map((file)=><div className="attachment-file" key={file.id}><FileText size={19}/><span title={file.name}>{file.name}</span><button className="attachment-remove" onClick={()=>setFiles((items)=>items.filter((item)=>item.id!==file.id))} aria-label={`Remove ${file.name}`}><X size={14}/></button></div>)}
            {attaching&&<div className="attachment attachment-loading" aria-label="Processing attachment"><i/></div>}
          </div>}
            <textarea ref={taRef} rows={1} aria-label={labels.messageLabel} value={input} onChange={(event)=>{if(listening)cancelDictation();const value=event.target.value;setInput(value);setSkillMenuOpen(/(?:^|\s)\/[a-z0-9-]*$/i.test(value))}} onFocus={()=>{if(listening)cancelDictation()}} onPaste={(event)=>{const pasted=Array.from(event.clipboardData.files).filter((file)=>file.type.startsWith("image/"));if(pasted.length){event.preventDefault();addImages(pasted)}}} onKeyDown={(event)=>{if(event.key==="Escape"&&skillMenuOpen){event.preventDefault();setSkillMenuOpen(false);return}if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(skillMenuOpen&&slashSkills[0])chooseSkill(slashSkills[0].slug);else send()}}} placeholder={listening?labels.listening:images.length||files.length?labels.addMessage:labels.askAnything}/>
            {skillMenuOpen&&slashMatch&&<div ref={skillMenuRef} className="skill-command-menu" role="listbox" aria-label="Skills">
              {slashSkills.map((skill)=><button key={skill.id} role="option" aria-selected="false" onMouseDown={(event)=>event.preventDefault()} onClick={()=>chooseSkill(skill.slug)}><span className="skill-command-icon"><Code size={16}/></span><span><strong>{skill.name}</strong><small>/{skill.slug}{skill.builtIn?" · Built in":" · Custom skill"}</small></span></button>)}
              <button className="skill-command-add" onMouseDown={(event)=>event.preventDefault()} onClick={()=>{setSkillMenuOpen(false);skillFileInputRef.current?.click()}}><Plus size={16}/><span><strong>{labels.addSkillFile}</strong><small>Upload a .md skill file</small></span></button>
            </div>}
            <input ref={skillFileInputRef} type="file" accept=".md,text/markdown,text/plain" hidden onChange={(event)=>{const file=event.target.files?.[0];if(file)void uploadSkill(file);event.target.value=""}}/>
          <div className="composer-bar">
            <div className="composer-tools">
            <div className="attach-menu-wrap" ref={attachMenuRef}>
              <button className="attach-button" aria-label={labels.attachFiles} title={labels.attachFiles} disabled={attaching||files.length>=MAX_FILES&&images.length>=MAX_IMAGES} aria-expanded={attachMenuOpen} onClick={()=>setAttachMenuOpen((open)=>!open)}><Plus size={21}/></button>
              {attachMenuOpen&&<div className="composer-menu attach-menu" role="menu">
                <button role="menuitem" onClick={()=>{setAttachMenuOpen(false);fileInputRef.current?.click()}}><FileText size={17}/><span><strong>{labels.documents}</strong><small>{labels.documentsHint}</small></span></button>
                <button role="menuitem" onClick={()=>{setAttachMenuOpen(false);imageInputRef.current?.click()}}><ImageIcon size={17}/><span><strong>{labels.images}</strong><small>{labels.imagesHint}</small></span></button>
                <button role="menuitem" onClick={()=>{setAttachMenuOpen(false);setCameraOpen(true)}}><Camera size={17}/><span><strong>{labels.camera}</strong><small>{labels.takePhoto}</small></span></button>
                <button role="menuitem" aria-pressed={webSearchOnce} onClick={()=>setWebSearchOnce((value)=>!value)}><Globe size={17}/><span><strong>{labels.webSearch}</strong><small>{webSearchOnce ? labels.webSearchArmed : labels.webSearchNext}</small></span>{webSearchOnce&&<Check size={15}/>}</button>
                <button role="menuitem" onClick={()=>{setAttachMenuOpen(false);setSettingsOpen(true)}}><Zap size={17}/><span><strong>{labels.skills}</strong><small>{labels.frontendDesignDescription}</small></span></button>
              </div>}
            </div>
            <input ref={fileInputRef} type="file" accept={ACCEPTED_FILE_TYPES} multiple hidden onChange={(event)=>{if(event.target.files?.length)addDocuments(event.target.files);event.target.value=""}}/>
            <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={(event)=>{if(event.target.files?.length)addImages(event.target.files);event.target.value=""}}/>
            <div className="model-picker-wrap" ref={modelMenuRef}>
              <button className="model-picker-trigger" aria-label={`${labels.chooseModel}, current model ${MODEL_LABELS[model]}`} aria-haspopup="listbox" aria-expanded={modelMenuOpen} onClick={()=>setModelMenuOpen((open)=>!open)}><span>{MODEL_LABELS[model]}</span><ChevronUp size={15}/></button>
              {modelMenuOpen&&<div className="composer-menu model-menu" role="listbox" aria-label={lang === "id" ? "Pilih model LearnGPT" : "Choose a LearnGPT model"}>
                {LEARN_MODELS.map((item)=><button className="model-option" key={item} role="option" aria-selected={model===item} onClick={()=>changeModel(item)}><span><strong>{MODEL_LABELS[item]}</strong><small>{item==="learn-1.0-smart"?labels.modelEveryday:item==="learn-1.0-study"?labels.modelStudy:labels.modelThinking}</small></span>{model===item&&<Check size={16}/>}</button>)}
              </div>}
            </div>
            </div>
            <div className="composer-actions">
              <button className={`mic-button ${listening?"listening":""}`} onClick={toggleDictation} disabled={loading||attaching} aria-pressed={listening} aria-label={listening?labels.stopDictation:labels.dictate} title={listening?labels.stopDictation:labels.dictate}><Mic size={19}/></button>
            <button className="send-button" disabled={(!input.trim()&&!images.length&&!files.length)||loading||attaching} onClick={()=>send()} aria-label={labels.sendMessage}><Send size={18}/></button>
            </div>
          </div>
          {dragging&&<div className="drop-hint"><Paperclip size={20}/>{labels.dragDrop}</div>}
        </div>
        <p>{labels.composerFooter}</p>
      </div>
    </section>{lightbox&&<div className="lightbox" role="dialog" aria-modal="true" aria-label={lang === "id" ? "Pratinjau gambar" : "Image preview"} onClick={()=>setLightbox(null)}><button className="lightbox-close" aria-label={labels.close} onClick={()=>setLightbox(null)}><X size={20}/></button><img src={lightbox} alt="Attachment preview" onClick={(event)=>event.stopPropagation()}/></div>}{settingsOpen&&<SettingsModal settings={settings} skills={skills} t={labels} onClose={()=>setSettingsOpen(false)} onSave={saveSettings} onUploadSkill={uploadSkill} onDeleteSkill={deleteSkill}/>}
    {projectModalOpen&&<ProjectModal t={labels} onClose={()=>setProjectModalOpen(false)} onCreate={createProject}/>}
    {projectToDelete&&<DeleteProjectModal t={labels} project={projectToDelete} chatCount={chats.filter((chat)=>chat.projectId===projectToDelete.id&&chat.messages.length).length} onClose={()=>setProjectToDelete(null)} onConfirm={()=>deleteProject(projectToDelete)}/>}
    {languageOpen&&<LanguageModal t={labels} lang={lang} onClose={()=>setLanguageOpen(false)} onSelect={changeLang}/>}
    {helpOpen&&<HelpModal t={labels} onClose={()=>setHelpOpen(false)}/>}
    {cameraOpen&&<CameraCapture t={labels} onCapture={(file)=>{void addImages([file]);}} onClose={()=>setCameraOpen(false)}/>}</main>;
}
