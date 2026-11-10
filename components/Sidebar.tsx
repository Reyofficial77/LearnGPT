"use client";
import { type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Edit3, Folder, Globe, HelpCircle, Lock, LogOut, MoreHorizontal, Bookmark, MessageSquare, Plus, Search, Share2, Settings as SettingsIcon, Trash2, User, X } from "react-feather";
import type { Chat, ProjectSummary } from "../lib/types";
import { type Dict } from "../lib/i18n";

export function Brand({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return <a className="brand" href="/" aria-label="LearnGPT" onClick={onNavigate ? (event) => { event.preventDefault(); onNavigate(); } : undefined}><span className="brand-mark"><BookOpen size={compact ? 18 : 21} /></span><span className="brand-name">LearnGPT</span></a>;
}

type Props = {
  t: Dict; open: boolean; width: number; onResize: (width: number) => void; user: { name: string; email?: string; avatar?: string };
  projects: ProjectSummary[]; chats: Chat[]; currentChatId: string | null; activeProjectId: string | null; titlingChatId: string | null;
  onClose: () => void; onToggleSidebar: () => void; onNewChat: () => void; onCreateProject: () => void;
  onOpenProject: (project: ProjectSummary) => void; onDeleteProject: (project: ProjectSummary) => void;
  onOpenChat: (chat: Chat) => void; onDeleteChat: (id: string) => void; onRenameChat: (chat: Chat) => void;
  onPinChat: (chat: Chat) => void; onShareChat: (chat: Chat) => void;
  onClearChats: () => void; onOpenSettings: () => void; onOpenLanguage: () => void; onOpenHelp: () => void; onSignOut: () => void;
};

type ChatRowProps = { chat: Chat; active: boolean; titling: boolean; t: Dict; onOpen: () => void; onDelete: () => void; onRename: () => void; onPin: () => void; onShare: () => void };
function ChatRow({ chat, active, titling, t, onOpen, onDelete, onRename, onPin, onShare }: ChatRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", close); window.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", escape); };
  }, [menuOpen]);
  const action = (callback: () => void) => () => { setMenuOpen(false); callback(); };
  return <div className={`side-row chat-side-row ${active ? "active" : ""}`}>
    <button className="row-main" title={chat.title} aria-current={active ? "page" : undefined} onClick={onOpen}>
      <MessageSquare size={15} className="row-icon chat-row-icon" />
      {chat.pinned && <Bookmark size={13} className="pinned-marker" aria-label={t.pinChat} />}
      <span className={`row-label ${titling ? "is-titling" : ""}`}>{chat.title}</span>
    </button>
    <div className="chat-menu-wrap" ref={menuRef}>
      <button className="row-action more" onClick={() => setMenuOpen((open) => !open)} aria-label={t.chatActions} aria-haspopup="menu" aria-expanded={menuOpen}><MoreHorizontal size={17} /></button>
      {menuOpen && <div className="chat-actions-menu" role="menu">
        <button role="menuitem" onClick={action(onRename)}><Edit3 size={15} /><span>{t.renameChat}</span></button>
        <button role="menuitem" onClick={action(onPin)}><Bookmark size={15} /><span>{chat.pinned ? t.unpinChat : t.pinChat}</span></button>
        <button role="menuitem" onClick={action(onShare)}>{chat.isPublic ? <Lock size={15} /> : <Share2 size={15} />}<span>{chat.isPublic ? t.makePrivate : t.shareChat}</span></button>
        <div className="menu-sep" role="separator" />
        <button className="danger" role="menuitem" onClick={action(onDelete)}><Trash2 size={15} /><span>{t.delete}</span></button>
      </div>}
    </div>
  </div>;
}

export default function Sidebar(props: Props) {
  const { t, user, projects, chats, currentChatId, activeProjectId, titlingChatId } = props;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const resizePointer = useRef<number | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const visibleChats = chats.filter((chat) => chat.messages.length);
  const query = search.trim().toLocaleLowerCase();
  const matchesChat = (chat: Chat) => !query || chat.title.toLocaleLowerCase().includes(query) || chat.id.toLocaleLowerCase().includes(query);
  const plainChats = visibleChats.filter((chat) => !chat.projectId && matchesChat(chat));
  const visibleProjects = projects.filter((project) => !query || project.name.toLocaleLowerCase().includes(query) || visibleChats.some((chat) => chat.projectId === project.id && matchesChat(chat)));

  useEffect(() => {
    if (!activeProjectId) return;
    setExpanded((previous) => previous.has(activeProjectId) ? previous : new Set(previous).add(activeProjectId));
  }, [activeProjectId]);
  const toggle = (id: string) => setExpanded((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  useEffect(() => {
    if (!menuOpen) return;
    accountRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointerDown = (event: PointerEvent) => { if (!accountRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", onPointerDown); window.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); window.removeEventListener("keydown", onKeyDown); };
  }, [menuOpen]);
  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  };
  const run = (action: () => void) => () => { setMenuOpen(false); action(); };
  const renderChat = (chat: Chat) => <ChatRow key={chat.id} chat={chat} active={currentChatId === chat.id} titling={titlingChatId === chat.id} t={t}
    onOpen={() => props.onOpenChat(chat)} onDelete={() => props.onDeleteChat(chat.id)} onRename={() => props.onRenameChat(chat)}
    onPin={() => props.onPinChat(chat)} onShare={() => props.onShareChat(chat)} />;

  const handleResizeDown = (event: ReactPointerEvent<HTMLDivElement>) => { if (window.matchMedia("(max-width: 900px)").matches) return; event.preventDefault(); resizePointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); };
  const handleResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => { if (resizePointer.current === event.pointerId) props.onResize(event.clientX); };
  const handleResizeUp = (event: ReactPointerEvent<HTMLDivElement>) => { if (resizePointer.current === event.pointerId) resizePointer.current = null; };

  return <aside className={`sidebar ${props.open ? "sidebar-open" : "sidebar-collapsed"}`} style={{ width: props.open ? props.width : 76, flexBasis: props.open ? props.width : 76 }} aria-label={t.sidebarLabel}>
    <div className="sidebar-top"><Brand compact onNavigate={props.onNewChat} /><div className="sidebar-top-actions"><button className="icon-button sidebar-collapse-trigger" onClick={props.onToggleSidebar} aria-label={t.toggleSidebar} title={t.toggleSidebar}>{props.open ? <ChevronLeft size={19}/> : <ChevronRight size={19}/>}</button><button className="icon-button close-sidebar" onClick={props.onClose} aria-label={t.closeMenu}><X size={20} /></button></div></div>
    <button className="new-chat" onClick={props.onNewChat} title={t.newChat}><Plus size={18} /><span>{t.newChat}</span></button>
    <div className="sidebar-scroll">
      <label className="sidebar-search"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label={t.searchChats} placeholder={t.searchPlaceholder}/>{search && <button type="button" onClick={() => setSearch("")} aria-label={t.close}><X size={14}/></button>}</label>
      <section className="side-section" aria-labelledby="side-workspace">
        <div className="side-head"><p className="nav-label" id="side-workspace">{t.workspace}</p></div>
        <button className="side-add" onClick={props.onCreateProject} aria-haspopup="dialog"><Folder size={17} className="row-icon" /><span className="row-label">{t.project}</span><Plus size={15} className="add-plus" /></button>
        {visibleProjects.map((project) => {
          const isOpen = expanded.has(project.id);
          const pageActive = activeProjectId === project.id && !currentChatId;
          const projectChats = visibleChats.filter((chat) => chat.projectId === project.id && matchesChat(chat));
          return <div className="project" key={project.id}>
            <div className={`side-row ${pageActive ? "active" : ""}`}>
              <button className="row-main" title={project.goal} aria-current={pageActive ? "page" : undefined} onClick={() => props.onOpenProject(project)}><Folder size={17} className="row-icon" /><span className="row-label">{project.name}</span></button>
              <button className="row-action danger" onClick={() => props.onDeleteProject(project)} aria-label={`${t.deleteProject}: ${project.name}`}><Trash2 size={14} /></button>
              <button className="row-action chevron" onClick={() => toggle(project.id)} aria-expanded={isOpen} aria-label={`${t.toggleProject}: ${project.name}`}><ChevronDown size={16} className={isOpen ? "" : "collapsed"} /></button>
            </div>
            {isOpen && <div className="project-chats">{projectChats.length ? projectChats.map(renderChat) : <p className="project-empty">{query ? t.noSearchResults : t.noProjectChats}</p>}</div>}
          </div>;
        })}
      </section>
      <section className="side-section" aria-labelledby="side-chat">
        <div className="side-head"><p className="nav-label" id="side-chat">{t.chat}</p><button className="history-clear" onClick={props.onClearChats} disabled={!plainChats.length}><Trash2 size={14} />{t.clearAll}</button></div>
        {plainChats.length ? plainChats.map(renderChat) : <div className="empty-history"><BookOpen size={18} /><span>{query ? t.noSearchResults : t.noChats}</span></div>}
      </section>
    </div>
    <div className="sidebar-account" ref={accountRef}>
      {menuOpen && <div className="account-menu" role="menu" aria-label={t.accountMenu} onKeyDown={onMenuKeyDown}>
        {user.email && <p className="account-menu-email">{user.email}</p>}
        <button role="menuitem" onClick={run(props.onOpenSettings)}><SettingsIcon size={17} /><span>{t.settings}</span><kbd>Ctrl+Shift+,</kbd></button>
        <button role="menuitem" onClick={run(props.onOpenLanguage)}><Globe size={17} /><span>{t.language}</span></button>
        <button role="menuitem" onClick={run(props.onOpenHelp)}><HelpCircle size={17} /><span>{t.help}</span></button>
        <div className="menu-sep" role="separator" />
        <button role="menuitem" onClick={run(props.onSignOut)}><LogOut size={17} /><span>{t.signOut}</span></button>
      </div>}
      <button ref={triggerRef} className="account-trigger" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
        <span className="profile-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : <User size={16} />}</span>
        <span className="profile-copy"><strong>{user.name}</strong>{user.email && <small>{user.email}</small>}</span>
        <ChevronUp size={16} className="account-chevron" />
      </button>
    </div>
    <div className="sidebar-resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" aria-valuemin={190} aria-valuemax={380} aria-valuenow={props.width} tabIndex={0} onPointerDown={handleResizeDown} onPointerMove={handleResizeMove} onPointerUp={handleResizeUp} onPointerCancel={handleResizeUp} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); props.onResize(props.width - 12); } if (event.key === "ArrowRight") { event.preventDefault(); props.onResize(props.width + 12); } }} />
  </aside>;
}
