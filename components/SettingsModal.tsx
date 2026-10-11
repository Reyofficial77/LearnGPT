"use client";
import { useEffect, useState } from "react";
import { AlertCircle, Check, CheckCircle, ExternalLink, Eye, EyeOff, Key, Loader, Lock, Settings as SettingsIcon, Trash2, X, Zap } from "react-feather";
import type { LearnModel, Provider, Settings as AppSettings } from "../lib/types";
import { LEARN_MODELS, MODEL_REGISTRY } from "../lib/models";
import { PROVIDER_LIST, PROVIDER_META, checkKey } from "../lib/providers";

type TestState = { status: "idle" | "testing" | "ok" | "error"; message?: string };
const byProvider = <T,>(value: T): Record<Provider, T> => ({ gemini: value, openai: value, anthropic: value });

type Props = {
  settings: AppSettings;
  onClose: () => void;
  /** Resolves to an error message, or null when everything was saved (the parent then closes the modal). */
  onSave: (next: AppSettings) => Promise<string | null>;
};

export default function SettingsModal({ settings, onClose, onSave }: Props) {
  // Edit a draft so "Cancel" really discards changes (including keys that were typed but not saved).
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [visible, setVisible] = useState<Record<Provider, boolean>>(byProvider(false));
  const [tests, setTests] = useState<Record<Provider, TestState>>(byProvider<TestState>({ status: "idle" }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Clicking the backdrop / pressing Esc only closes when nothing is unsaved, so a pasted key is never lost by accident.
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !dirty) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dirty]);

  const keyOf = (provider: Provider) => (draft.keys[provider] || "").trim();
  const issues = { gemini: checkKey("gemini", draft.keys.gemini || ""), openai: checkKey("openai", draft.keys.openai || ""), anthropic: checkKey("anthropic", draft.keys.anthropic || "") };
  const hasBlockingIssue = PROVIDER_LIST.some((provider) => issues[provider]?.level === "error");
  const hasAnyKey = PROVIDER_LIST.some((provider) => keyOf(provider));
  const selectedMissing = !keyOf(draft.provider);

  const setKey = (provider: Provider, value: string) => {
    setDraft((current) => ({ ...current, keys: { ...current.keys, [provider]: value } }));
    setTests((current) => ({ ...current, [provider]: { status: "idle" } }));
    setSaveError("");
  };

  const testKey = async (provider: Provider) => {
    const apiKey = keyOf(provider);
    if (!apiKey) return;
    setTests((current) => ({ ...current, [provider]: { status: "testing" } }));
    try {
      const response = await fetch("/api/settings/test-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, apiKey }) });
      const data = await response.json().catch(() => ({}));
      const next: TestState = response.ok && data.ok ? { status: "ok", message: "Connected. This key works." } : { status: "error", message: data.error || `Test failed (${response.status}).` };
      setTests((current) => ({ ...current, [provider]: next }));
    } catch {
      setTests((current) => ({ ...current, [provider]: { status: "error", message: "Could not reach the server. Check your connection and try again." } }));
    }
  };

  const save = async () => {
    if (saving || hasBlockingIssue) return;
    setSaving(true); setSaveError("");
    const keys = { gemini: keyOf("gemini"), openai: keyOf("openai"), anthropic: keyOf("anthropic") };
    const error = await onSave({ ...draft, keys });
    if (error) { setSaveError(error); setSaving(false); }
  };

  return (
    <div className="settings-overlay" role="presentation" onMouseDown={() => { if (!dirty) onClose(); }}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="settings-heading">
          <div>
            <span className="settings-icon"><SettingsIcon size={19} /></span>
            <div><h2 id="settings-title">AI settings</h2><p>Choose a provider and connect your own API key.</p></div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={19} /></button>
        </header>

        <div className="settings-body">
          <label className="settings-field">
            <span>Default AI provider</span>
            <select value={draft.provider} onChange={(event) => setDraft({ ...draft, provider: event.target.value as Provider })}>
              {PROVIDER_LIST.map((provider) => <option key={provider} value={provider}>{PROVIDER_META[provider].label}</option>)}
            </select>
            <small>LearnGPT will use this provider, with your own key, for new responses.</small>
          </label>
          {selectedMissing && <p className="key-alert"><AlertCircle size={15} /><span>You haven&apos;t added a {PROVIDER_META[draft.provider].label} API key yet. Add one below to start chatting.</span></p>}

          <label className="settings-field">
            <span>LearnGPT model</span>
            <select value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value as LearnModel })}>
              {LEARN_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
            <small>API model: {MODEL_REGISTRY[draft.provider][draft.model]}</small>
          </label>

          <div className="api-section">
            <div className="section-label"><strong>Your API keys</strong><span>Stored only in this browser</span></div>
            <p className="key-privacy"><Lock size={13} /><span>Your keys are saved in this browser only and are never stored on LearnGPT&apos;s server or database. When you chat, your key is sent over HTTPS with that request, used once to call your provider, and then discarded. Usage is billed to your own account.</span></p>

            {PROVIDER_LIST.map((provider) => {
              const meta = PROVIDER_META[provider];
              const value = draft.keys[provider] || "";
              const hasKey = Boolean(value.trim());
              const issue = issues[provider];
              const test = tests[provider];
              return (
                <div className={`key-card ${draft.provider === provider ? "is-default" : ""}`} key={provider}>
                  <div className="key-card-head">
                    <label htmlFor={`api-key-${provider}`}><Key size={14} />{meta.label}{draft.provider === provider && <em>Default</em>}</label>
                    <span className={`key-badge ${hasKey ? "on" : ""}`}>{hasKey ? "Key added" : "Not set"}</span>
                  </div>
                  <div className="key-input-row">
                    <input
                      id={`api-key-${provider}`}
                      type={visible[provider] ? "text" : "password"}
                      value={value}
                      placeholder={meta.placeholder}
                      onChange={(event) => setKey(provider, event.target.value)}
                      autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                      data-1p-ignore="true" data-lpignore="true"
                    />
                    <button type="button" className="key-icon-button" onClick={() => setVisible((current) => ({ ...current, [provider]: !current[provider] }))} aria-label={visible[provider] ? `Hide ${meta.label} key` : `Show ${meta.label} key`} title={visible[provider] ? "Hide key" : "Show key"}>
                      {visible[provider] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {issue && <p className={`key-note ${issue.level}`}><AlertCircle size={13} /><span>{issue.message}</span></p>}
                  <div className="key-card-actions">
                    <a href={meta.getKeyUrl} target="_blank" rel="noopener noreferrer">Get a key at {meta.getKeyHost}<ExternalLink size={11} /></a>
                    <span className="key-action-group">
                      <button type="button" disabled={!hasKey || issue?.level === "error" || test.status === "testing"} onClick={() => testKey(provider)}>
                        {test.status === "testing" ? <Loader size={13} className="key-spin" /> : <Zap size={13} />}{test.status === "testing" ? "Testing…" : "Test"}
                      </button>
                      <button type="button" className="danger" disabled={!hasKey} onClick={() => setKey(provider, "")}><Trash2 size={13} />Remove</button>
                    </span>
                  </div>
                  {test.status === "ok" && <p className="key-note success"><CheckCircle size={13} /><span>{test.message}</span></p>}
                  {test.status === "error" && <p className="key-note error"><AlertCircle size={13} /><span>{test.message}</span></p>}
                </div>
              );
            })}

            {hasAnyKey && <button type="button" className="key-clear-all" onClick={() => PROVIDER_LIST.forEach((provider) => setKey(provider, ""))}><Trash2 size={13} />Remove all keys from this browser</button>}
          </div>

          <label className="settings-field">
            <span>Learning instructions</span>
            <textarea rows={5} value={draft.systemPrompt} onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })} placeholder="Describe how the AI should respond..." />
            <small>Set the tone, response style, expertise, or rules the AI should follow.</small>
          </label>
        </div>

        <footer className="settings-footer">
          {saveError && <p className="settings-save-error"><AlertCircle size={14} />{saveError}</p>}
          <button className="settings-cancel" onClick={onClose}>Cancel</button>
          <button className="settings-save" onClick={save} disabled={saving || hasBlockingIssue}>{saving ? <Loader size={16} className="key-spin" /> : <Check size={17} />}{saving ? "Saving…" : "Save settings"}</button>
        </footer>
      </section>
    </div>
  );
}
