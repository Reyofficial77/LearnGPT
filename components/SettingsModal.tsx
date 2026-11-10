"use client";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Code, Loader, Plus, Search, Settings as SettingsIcon, Trash2, X } from "react-feather";
import type { Settings as AppSettings } from "../lib/types";
import type { Dict } from "../lib/i18n";

type Skill = { id: string; name: string; slug: string; builtIn: boolean };
type Props = {
  settings: AppSettings;
  skills: Skill[];
  t: Dict;
  onClose: () => void;
  onSave: (next: AppSettings) => Promise<string | null>;
  onUploadSkill: (file: File, name: string) => Promise<string | null>;
  onDeleteSkill: (slug: string) => Promise<string | null>;
};

const SPEECH_OPTIONS = ["id-ID", "en-US", "es-ES", "fr-FR", "de-DE", "pt-BR", "ja-JP", "ko-KR", "zh-CN", "hi-IN", "ar-SA"] as const;
const SPEECH_LABELS: Record<string, string> = { "id-ID": "Bahasa Indonesia", "en-US": "English (US)", "es-ES": "Español", "fr-FR": "Français", "de-DE": "Deutsch", "pt-BR": "Português (Brasil)", "ja-JP": "日本語", "ko-KR": "한국어", "zh-CN": "简体中文", "hi-IN": "हिन्दी", "ar-SA": "العربية" };

export default function SettingsModal({ settings, skills, t, onClose, onSave, onUploadSkill, onDeleteSkill }: Props) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [skillName, setSkillName] = useState("");
  const [skillBusy, setSkillBusy] = useState(false);
  const [skillError, setSkillError] = useState("");
  const [systemLight, setSystemLight] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = draft.theme !== settings.theme || draft.webSearchEnabled !== settings.webSearchEnabled || draft.speechLanguage !== settings.speechLanguage;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => setSystemLight(media.matches);
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !dirty && !saving && !skillBusy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dirty, saving, skillBusy]);

  const save = async () => {
    if (saving) return;
    setSaving(true); setSaveError("");
    const error = await onSave(draft);
    if (error) { setSaveError(error); setSaving(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setSkillBusy(true); setSkillError("");
    const error = await onUploadSkill(file, skillName);
    if (error) setSkillError(error);
    else setSkillName("");
    setSkillBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };
  const remove = async (skill: Skill) => {
    if (skill.builtIn || skillBusy) return;
    setSkillBusy(true); setSkillError("");
    const error = await onDeleteSkill(skill.slug);
    if (error) setSkillError(error);
    setSkillBusy(false);
  };
  const previewLight = draft.theme === "light" || (draft.theme === "system" && systemLight);

  return <div className="settings-overlay" role="presentation" onMouseDown={() => { if (!dirty && !saving && !skillBusy) onClose(); }}>
    <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="settings-heading">
        <div><span className="settings-icon"><SettingsIcon size={18} /></span><div><h2 id="settings-title">{t.settingsTitle}</h2><p>{t.settingsCopy}</p></div></div>
        <button className="icon-button" onClick={onClose} aria-label={t.close}><X size={18} /></button>
      </header>
      <div className="settings-body">
        <section className="settings-panel appearance-panel">
          <div className="settings-panel-title"><span>{t.appearance}</span><small>{t.themeHint}</small></div>
          <div className="appearance-controls">
            <label className="settings-field"><span>{t.theme}</span>
              <select value={draft.theme} onChange={(event) => setDraft((current) => ({ ...current, theme: event.target.value as AppSettings["theme"] }))}>
                <option value="dark">{t.themeDark}</option><option value="light">{t.themeLight}</option><option value="system">{t.themeSystem}</option>
              </select>
            </label>
            <div className={`theme-preview ${previewLight ? "preview-light" : "preview-dark"}`} aria-label={`${t.theme} ${draft.theme} preview`}>
              <div className="theme-preview-sidebar"><span /><i /><i /><i /></div>
              <div className="theme-preview-main"><div className="theme-preview-top" /><div className="theme-preview-message" /><div className="theme-preview-user" /><div className="theme-preview-input"><b /></div></div>
            </div>
          </div>
        </section>
        <section className="settings-panel">
          <div className="settings-panel-title"><span><Code size={16}/>{t.skills}</span><small>{t.skillsHint}</small></div>
          <div className="settings-skill-list">
            {skills.map((skill) => <div className="settings-skill-row" key={skill.id}>
              <span className="settings-skill-icon"><Code size={16}/></span>
              <span className="settings-skill-copy"><strong>{skill.name}</strong><small>/{skill.slug}</small></span>
              {skill.builtIn ? <span className="skill-state">{t.alwaysActive}</span> : <button className="skill-remove" onClick={() => void remove(skill)} disabled={skillBusy} aria-label={`${t.removeSkill}: ${skill.name}`}><Trash2 size={15}/></button>}
            </div>)}
          </div>
          <div className="skill-upload-form">
            <label className="settings-field"><span>{t.skillName}</span><input value={skillName} onChange={(event) => setSkillName(event.target.value)} maxLength={64} placeholder="e.g. study-notes" /><small>{t.skillNameHint}</small></label>
            <input ref={fileRef} type="file" accept=".md,text/markdown,text/plain" hidden onChange={(event) => void upload(event.target.files?.[0])}/>
            <button className="settings-add-skill" onClick={() => fileRef.current?.click()} disabled={skillBusy}><Plus size={16}/>{skillBusy ? t.saving : t.uploadSkill}</button>
          </div>
          {skillError && <p className="settings-inline-error" role="alert">{skillError}</p>}
        </section>
        <section className="settings-panel">
          <div className="settings-panel-title"><span><Search size={16}/>{t.webSearch}</span><small>{t.webSearchDescription}</small></div>
          <label className="settings-switch-row"><span><strong>{t.webSearch}</strong><small>{t.webSearchHint}</small></span><input type="checkbox" checked={draft.webSearchEnabled} onChange={(event) => setDraft((current) => ({ ...current, webSearchEnabled: event.target.checked }))}/></label>
        </section>
        <section className="settings-panel">
          <div className="settings-panel-title"><span>{t.speechLanguage}</span><small>{t.speechLanguageHint}</small></div>
          <label className="settings-field"><span>{t.speechLanguage}</span>
            <select value={draft.speechLanguage} onChange={(event) => setDraft((current) => ({ ...current, speechLanguage: event.target.value }))}>
              <option value="auto">{t.speechAuto}</option>
              {SPEECH_OPTIONS.map((code) => <option value={code} key={code}>{SPEECH_LABELS[code]}</option>)}
            </select>
          </label>
        </section>
      </div>
      <footer className="settings-footer">
        {saveError && <p className="settings-save-error" role="alert"><AlertCircle size={14} />{saveError}</p>}
        <button className="settings-cancel" onClick={onClose} disabled={saving || skillBusy}>{t.settingsCancel}</button>
        <button className="settings-save" onClick={save} disabled={saving || !dirty}>{saving ? <Loader size={15} className="key-spin" /> : <Check size={16} />}{saving ? t.saving : t.save}</button>
      </footer>
    </section>
  </div>;
}
