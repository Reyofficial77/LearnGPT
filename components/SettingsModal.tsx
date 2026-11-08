"use client";
import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader, Settings as SettingsIcon, X } from "react-feather";
import type { Settings as AppSettings } from "../lib/types";

type Props = {
  settings: AppSettings;
  onClose: () => void;
  /** Resolves to an error message, or null when everything was saved (the parent then closes the modal). */
  onSave: (next: AppSettings) => Promise<string | null>;
};

export default function SettingsModal({ settings, onClose, onSave }: Props) {
  // Edit a draft so "Cancel" really discards changes.
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
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

  return (
    <div className="settings-overlay" role="presentation" onMouseDown={() => { if (!dirty) onClose(); }}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="settings-heading">
          <div>
            <span className="settings-icon"><SettingsIcon size={19} /></span>
            <div><h2 id="settings-title">AI settings</h2><p>Customize how LearnGPT should respond.</p></div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={19} /></button>
        </header>

        <div className="settings-body">
          <label className="settings-field">
            <span>Learning instructions</span>
            <textarea rows={5} value={draft.systemPrompt} onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })} placeholder="Describe how the AI should respond..." />
            <small>Set the tone, response style, expertise, or rules the AI should follow.</small>
          </label>
        </div>

        <footer className="settings-footer">
          {saveError && <p className="settings-save-error"><AlertCircle size={14} />{saveError}</p>}
          <button className="settings-cancel" onClick={onClose}>Cancel</button>
          <button className="settings-save" onClick={save} disabled={saving}>{saving ? <Loader size={16} className="key-spin" /> : <Check size={17} />}{saving ? "Saving…" : "Save settings"}</button>
        </footer>
      </section>
    </div>
  );
}
