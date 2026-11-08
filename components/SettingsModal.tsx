"use client";
import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader, Settings as SettingsIcon, X } from "react-feather";
import type { Settings as AppSettings } from "../lib/types";
import type { Dict } from "../lib/i18n";

type Props = { settings: AppSettings; t: Dict; onClose: () => void; onSave: (next: AppSettings) => Promise<string | null> };

export default function SettingsModal({ settings, t, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const dirty = draft.systemPrompt !== settings.systemPrompt || draft.theme !== settings.theme;

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
        <label className="settings-field">
          <span>{t.learningInstructions}</span>
          <textarea rows={6} value={draft.systemPrompt} onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })} placeholder={t.instructionsPlaceholder} />
          <small>{t.learningInstructionsHint}</small>
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
