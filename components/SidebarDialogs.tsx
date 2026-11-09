"use client";
import { type FormEvent, type ReactNode, useEffect, useId, useState } from "react";
import { AlertCircle, Check, Folder, Globe, HelpCircle, Loader, Trash2, X } from "react-feather";
import type { ProjectSummary } from "../lib/types";
import { SUPPORTED_LANGUAGES, type Dict, type Lang } from "../lib/i18n";
import { isReservedSlug, slugify } from "../lib/slug";

// Shared shell: same overlay / card / bottom-sheet look as the AI settings dialog.
function Dialog({ t, icon, title, copy, onClose, locked = false, children }: { t: Dict; icon: ReactNode; title: string; copy: string; onClose: () => void; locked?: boolean; children: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !locked) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, locked]);
  return <div className="settings-overlay" role="presentation" onMouseDown={() => { if (!locked) onClose(); }}>
    <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
      <header className="settings-heading">
        <div><span className="settings-icon">{icon}</span><div><h2 id={titleId}>{title}</h2><p>{copy}</p></div></div>
        <button className="icon-button" onClick={onClose} aria-label={t.close}><X size={19} /></button>
      </header>
      {children}
    </section>
  </div>;
}

const NAME_MAX = 60;
const GOAL_MAX = 300;

export function ProjectModal({ t, onClose, onCreate }: { t: Dict; onClose: () => void; onCreate: (name: string, goal: string) => Promise<string | null> }) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewSlug = name.trim() ? (() => { const s = slugify(name); return isReservedSlug(s) ? `${s}-2` : s; })() : "";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!name.trim() || !goal.trim()) { setError(t.projectRequired); return; }
    setSaving(true); setError("");
    const failure = await onCreate(name.trim(), goal.trim());
    if (failure) { setError(failure); setSaving(false); }
  };

  return <Dialog t={t} icon={<Folder size={19} />} title={t.projectCreateTitle} copy={t.projectCreateCopy} onClose={onClose} locked={saving || !!(name || goal)}>
    <form onSubmit={submit} noValidate>
      <div className="settings-body">
        <label className="settings-field">
          <span>{t.projectName}</span>
          <input autoFocus value={name} maxLength={NAME_MAX} onChange={(event) => setName(event.target.value)} placeholder={t.projectNamePlaceholder} autoComplete="off" />
          {previewSlug && <small className="slug-preview">{t.projectAddress}: /{previewSlug}/…</small>}
        </label>
        <label className="settings-field">
          <span>{t.projectGoal}</span>
          <textarea rows={4} value={goal} maxLength={GOAL_MAX} onChange={(event) => setGoal(event.target.value)} placeholder={t.projectGoalPlaceholder} />
          <small className="field-line"><span>{t.projectGoalHint}</span><span>{goal.length}/{GOAL_MAX}</span></small>
        </label>
      </div>
      <footer className="settings-footer">
        {error && <p className="settings-save-error" role="alert"><AlertCircle size={14} />{error}</p>}
        <button type="button" className="settings-cancel" onClick={onClose}>{t.cancel}</button>
        <button type="submit" className="settings-save" disabled={saving || !name.trim() || !goal.trim()}>{saving ? <Loader size={16} className="key-spin" /> : <Check size={17} />}{saving ? t.projectCreating : t.projectCreate}</button>
      </footer>
    </form>
  </Dialog>;
}

export function DeleteProjectModal({ t, project, chatCount, onClose, onConfirm }: { t: Dict; project: ProjectSummary; chatCount: number; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => { if (busy) return; setBusy(true); try { await onConfirm(); } finally { setBusy(false); } };
  return <Dialog t={t} icon={<Trash2 size={19} />} title={t.projectDeleteTitle} copy={project.name} onClose={onClose} locked={busy}>
    <div className="settings-body"><p className="dialog-copy">{t.projectDeleteBody(project.name, chatCount)}</p></div>
    <footer className="settings-footer">
      <button className="settings-cancel" onClick={onClose} disabled={busy}>{t.cancel}</button>
      <button className="settings-save danger" onClick={confirm} disabled={busy}>{busy ? <Loader size={16} className="key-spin" /> : <Trash2 size={16} />}{t.deleteProject}</button>
    </footer>
  </Dialog>;
}

export function LanguageModal({ t, lang, onClose, onSelect }: { t: Dict; lang: Lang; onClose: () => void; onSelect: (lang: Lang) => void }) {
  return <Dialog t={t} icon={<Globe size={19} />} title={t.languageTitle} copy={t.languageCopy} onClose={onClose}>
    <div className="lang-list" role="radiogroup" aria-label={t.languageTitle}>
      {SUPPORTED_LANGUAGES.map(([code, label]) => <button key={code} className="lang-option" role="radio" aria-checked={lang === code} onClick={() => onSelect(code)}><span>{label}</span>{lang === code && <Check size={17} />}</button>)}
    </div>
  </Dialog>;
}

export function HelpModal({ t, onClose }: { t: Dict; onClose: () => void }) {
  return <Dialog t={t} icon={<HelpCircle size={19} />} title={t.helpTitle} copy={t.helpCopy} onClose={onClose}>
    <dl className="help-list">{t.helpItems.map(([term, text]) => <div key={term}><dt>{term}</dt><dd>{text}</dd></div>)}</dl>
  </Dialog>;
}
