"use client";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Edit3, Folder, Globe, HelpCircle, Link2Off, LogOut, MoreHorizontal, Pin, Plus, Share2, Settings as SettingsIcon, Trash2, User, X } from "react-feather";
import type { Chat, ProjectSummary } from "../lib/types";
import { type Dict } from "../lib/i18n";

export function Brand({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return <a className="brand" href="/" aria-label="LearnGPT" onClick={onNavigate ? (event) => { event.preventDefault(); onNavigate(); } : undefined}><span className="brand-mark"><BookOpen size={compact ? 18 : 21} /></span><span className="brand-name">LearnGPT</span></a>;
}

type Props = {
  t: Dict; open: boolean; user: { name: string; email?: string; avatar?: string };
  projects: ProjectSummary[]; chats: Chat[]; currentChatId: string | null; activeProjectId: string | null; titlingChatId: string | null;
  onClose: () => void; onNewChat: () => void; onCreateProject: () => void;
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
      {chat.pinned && <Pin size={13} className="pinned-marker" aria-label={t.pinChat} />}
      <span className={`row-label ${titling ? "is-titling" : ""}`}>{chat.title}</span>
    </button>
    <div className="chat-menu-wrap" ref={menuRef}>
      <button className="row-action more" onClick={() => setMenuOpen((open) => !open)} aria-label={t.chatActions} aria-haspopup="menu" aria-expanded={menuOpen}><MoreHorizontal size={17} /></button>
      {menuOpen && <div className="chat-actions-menu" role="menu">
        <button role="menuitem" onClick={action(onRename)}><Edit3 size={15} /><span>{t.renameChat}</span></button>
        <button role="menuitem" onClick={action(onPin)}><Pin size={15} /><span>{chat.pinned ? t.unpinChat : t.pinChat}</span></button>
        <button role="menuitem" onClick={action(onShare)}>{chat.isPublic ? <Link2Off size={15} /> : <Share2 size={15} />}<span>{chat.isPublic ? t.makePrivate : t.shareChat}</span></button>
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
  const accountRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const visibleChats = chats.filter((chat) => chat.messages.length);
  const plainChats = visibleChats.filter((chat) => !chat.projectId);

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

  return <aside className={`sidebar ${props.open ? "sidebar-open" : ""}`} aria-label={t.sidebarLabel}>
    <div className="sidebar-top"><Brand compact onNavigate={props.onNewChat} /><button className="icon-button close-sidebar" onClick={props.onClose} aria-label={t.closeMenu}><X size={20} /></button></div>
    <button className="new-chat" onClick={props.onNewChat}><Plus size={18} />{t.newChat}</button>
    <div className="sidebar-scroll">
      <section className="side-section" aria-labelledby="side-workspace">
        <div className="side-head"><p className="nav-label" id="side-workspace">{t.workspace}</p></div>
        <button className="side-add" onClick={props.onCreateProject} aria-haspopup="dialog"><Folder size={17} className="row-icon" /><span className="row-label">{t.project}</span><Plus size={15} className="add-plus" /></button>
        {projects.map((project) => {
          const isOpen = expanded.has(project.id);
          const pageActive = activeProjectId === project.id && !currentChatId;
          const projectChats = visibleChats.filter((chat) => chat.projectId === project.id);
          return <div className="project" key={project.id}>
            <div className={`side-row ${pageActive ? "active" : ""}`}>
              <button className="row-main" title={project.goal} aria-current={pageActive ? "page" : undefined} onClick={() => props.onOpenProject(project)}><Folder size={17} className="row-icon" /><span className="row-label">{project.name}</span></button>
              <button className="row-action danger" onClick={() => props.onDeleteProject(project)} aria-label={`${t.deleteProject}: ${project.name}`}><Trash2 size={14} /></button>
              <button className="row-action chevron" onClick={() => toggle(project.id)} aria-expanded={isOpen} aria-label={`${t.toggleProject}: ${project.name}`}><ChevronDown size={16} className={isOpen ? "" : "collapsed"} /></button>
            </div>
            {isOpen && <div className="project-chats">{projectChats.length ? projectChats.map(renderChat) : <p className="project-empty">{t.noProjectChats}</p>}</div>}
          </div>;
        })}
      </section>
      <section className="side-section" aria-labelledby="side-chat">
        <div className="side-head"><p className="nav-label" id="side-chat">{t.chat}</p><button className="history-clear" onClick={props.onClearChats} disabled={!plainChats.length}><Trash2 size={14} />{t.clearAll}</button></div>
        {plainChats.length ? plainChats.map(renderChat) : <div className="empty-history"><BookOpen size={18} /><span>{t.noChats}</span></div>}
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
  </aside>;
}
