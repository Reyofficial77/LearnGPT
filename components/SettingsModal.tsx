"use client";
import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader, Settings as SettingsIcon, X } from "react-feather";
import type { Settings as AppSettings } from "../lib/types";

type Props = {
  settings: AppSettings;
  onClose: () => void;
  onSave: (next: AppSettings) => Promise<string | null>;
};

export default function SettingsModal({ settings, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const dirty = draft.systemPrompt !== settings.systemPrompt;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !dirty) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dirty]);

  const save = async () => {
    if (saving) return;
    setSaving(true); setSaveError("");
    const error = await onSave({ ...settings, systemPrompt: draft.systemPrompt });
    if (error) { setSaveError(error); setSaving(false); }
  };

  return (
    <div className="settings-overlay" role="presentation" onMouseDown={() => { if (!dirty) onClose(); }}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="settings-heading">
          <div>
            <span className="settings-icon"><SettingsIcon size={19} /></span>
            <div><h2 id="settings-title">AI settings</h2><p>Personalize the way LearnGPT helps you learn.</p></div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={19} /></button>
        </header>
        <div className="settings-body">
          <label className="settings-field">
            <span>Learning instructions</span>
            <textarea rows={6} value={draft.systemPrompt} onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })} placeholder="Describe how LearnGPT should respond..." />
            <small>These instructions apply to your conversations. Global learning behavior and your private memory are managed separately.</small>
          </label>
        </div>
        <footer className="settings-footer">
          {saveError && <p className="settings-save-error"><AlertCircle size={14} />{saveError}</p>}
          <button className="settings-cancel" onClick={onClose}>Cancel</button>
          <button className="settings-save" onClick={save} disabled={saving || !dirty}>{saving ? <Loader size={16} className="key-spin" /> : <Check size={17} />}{saving ? "Saving…" : "Save settings"}</button>
        </footer>
      </section>
    </div>
  );
}
