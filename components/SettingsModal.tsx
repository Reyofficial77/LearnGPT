"use client";
import { useEffect, useState } from "react";
import { AlertCircle, Check, Code, Loader, Search, Settings as SettingsIcon, X } from "react-feather";
import type { Settings as AppSettings } from "../lib/types";
import type { Dict } from "../lib/i18n";

type Props = { settings: AppSettings; t: Dict; onClose: () => void; onSave: (next: AppSettings) => Promise<string | null> };

export default function SettingsModal({ settings, t, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const dirty = draft.theme !== settings.theme || draft.webSearchEnabled !== settings.webSearchEnabled || draft.dictationLanguage !== settings.dictationLanguage || JSON.stringify(draft.enabledSkills) !== JSON.stringify(settings.enabledSkills);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !dirty) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dirty]);

  const save = async () => {
    if (saving) return;
    setSaving(true); setSaveError("");
    const error = await onSave(draft);
    if (error) { setSaveError(error); setSaving(false); }
  };
  const toggleSkill = (skill: string) => setDraft((current) => ({ ...current, enabledSkills: current.enabledSkills.includes(skill) ? current.enabledSkills.filter((item) => item !== skill) : [...current.enabledSkills, skill] }));

  return <div className="settings-overlay" role="presentation" onMouseDown={() => { if (!dirty && !saving) onClose(); }}>
    <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="settings-heading">
        <div><span className="settings-icon"><SettingsIcon size={19} /></span><div><h2 id="settings-title">{t.settingsTitle}</h2><p>{t.settingsCopy}</p></div></div>
        <button className="icon-button" onClick={onClose} aria-label={t.close}><X size={19} /></button>
      </header>
      <div className="settings-body">
        <label className="settings-field">
          <span>{t.appearance}</span>
          <span className="settings-sub-label">{t.theme}</span>
          <select value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as AppSettings["theme"] })}>
            <option value="dark">{t.themeDark}</option><option value="light">{t.themeLight}</option><option value="system">{t.themeSystem}</option>
          </select>
          <small>{t.themeHint}</small>
        </label>
        <section className="settings-section">
          <div className="settings-section-heading"><span><Code size={17}/>{t.skills}</span><small>{t.skillsHint}</small></div>
          <label className="settings-choice">
            <span className="settings-choice-icon"><Code size={17}/></span>
            <span className="settings-choice-copy"><strong>{t.frontendDesignSkill}</strong><small>{t.frontendDesignDescription}</small></span>
            <input type="checkbox" checked={draft.enabledSkills.includes("frontend-design")} onChange={() => toggleSkill("frontend-design")} />
          </label>
        </section>
        <section className="settings-section">
          <div className="settings-section-heading"><span><Search size={17}/>{t.webSearch}</span><small>{t.webSearchDescription}</small></div>
          <label className="settings-choice">
            <span className="settings-choice-icon"><Search size={17}/></span>
            <span className="settings-choice-copy"><strong>{t.webSearch}</strong><small>{t.webSearchHint}</small></span>
            <input type="checkbox" checked={draft.webSearchEnabled} onChange={(event) => setDraft({ ...draft, webSearchEnabled: event.target.checked })} />
          </label>
        </section>
        <label className="settings-field">
          <span>{t.dictationLanguage}</span>
          <select value={draft.dictationLanguage} onChange={(event) => setDraft({ ...draft, dictationLanguage: event.target.value })}>
            <option value="auto">{t.dictationAuto}</option>
            <option value="id-ID">{t.dictationId}</option>
            <option value="en-US">{t.dictationEn}</option>
            <option value="es-ES">Español</option><option value="fr-FR">Français</option><option value="de-DE">Deutsch</option>
            <option value="pt-BR">Português (Brasil)</option><option value="ja-JP">日本語</option><option value="ko-KR">한국어</option>
            <option value="zh-CN">简体中文</option><option value="hi-IN">हिन्दी</option><option value="ar-SA">العربية</option>
          </select>
          <small>{t.dictationLanguageHint}</small>
        </label>
      </div>
      <footer className="settings-footer">
        {saveError && <p className="settings-save-error" role="alert"><AlertCircle size={14} />{saveError}</p>}
        <button className="settings-cancel" onClick={onClose} disabled={saving}>{t.settingsCancel}</button>
        <button className="settings-save" onClick={save} disabled={saving || !dirty}>{saving ? <Loader size={16} className="key-spin" /> : <Check size={17} />}{saving ? t.saving : t.save}</button>
      </footer>
    </section>
  </div>;
}
