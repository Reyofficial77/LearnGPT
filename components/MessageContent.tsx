"use client";
import { Children, type ReactNode, isValidElement, memo, useEffect, useMemo, useState } from "react";
import { Check, Code, Copy, Download, Eye, FileText, Maximize2, RefreshCw, X } from "react-feather";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

Object.entries({ bash, c, cpp, csharp, css, go, java, javascript, json, kotlin, markdown, php, python, rust, sql, typescript, xml, yaml }).forEach(([name, def]) => hljs.registerLanguage(name, def));

const MIME: Record<string, string> = {
  html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript", json: "application/json",
  md: "text/markdown", csv: "text/csv", svg: "image/svg+xml", xml: "application/xml", yml: "text/yaml", yaml: "text/yaml"
};
const DEFAULT_EXT: Record<string, string> = {
  javascript: "js", js: "js", jsx: "jsx", typescript: "ts", ts: "ts", tsx: "tsx", python: "py", py: "py", html: "html", css: "css", json: "json",
  bash: "sh", sh: "sh", sql: "sql", java: "java", c: "c", cpp: "cpp", csharp: "cs", php: "php", go: "go", rust: "rs", kotlin: "kt",
  yaml: "yml", yml: "yml", markdown: "md", md: "md", xml: "xml", svg: "svg"
};

export function parseFenceLang(raw: string) {
  const isFile = raw.toLowerCase().startsWith("file:");
  const filename = isFile ? raw.slice(5).trim().replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "") || "file.txt" : "";
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  const lang = (isFile ? ext : raw).toLowerCase();
  const previewKind: "html" | "svg" | null = lang === "html" || lang === "htm" ? "html" : lang === "svg" ? "svg" : null;
  return { isFile, filename, ext, lang, previewKind };
}

export function buildPreviewDoc(code: string, kind: "html" | "svg"): string {
  if (kind === "svg") return `<!doctype html><meta charset="utf-8"><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#fff">${code}</body>`;
  if (/<!doctype|<html[\s>]/i.test(code)) return code;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:16px;color:#111;background:#fff}</style></head><body>${code}</body></html>`;
}

function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function highlight(code: string, lang: string): string {
  try { if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value; } catch { /* fall through */ }
  return escapeHtml(code);
}

function downloadText(filename: string, text: string, ext: string) {
  const blob = new Blob([text], { type: `${MIME[ext] || "text/plain"};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try { const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok; } catch { return false; }
  }
}

// Sandboxed WITHOUT allow-same-origin: generated code can run, but it cannot read cookies,
// storage, or call this app's API with the user's session.
function PreviewFrame({ doc, className }: { doc: string; className: string }) {
  return <iframe className={className} sandbox="allow-scripts allow-forms allow-modals allow-popups" srcDoc={doc} title="Live preview" referrerPolicy="no-referrer" />;
}

function CodeBlock({ rawLang, code }: { rawLang: string; code: string }) {
  const info = useMemo(() => parseFenceLang(rawLang), [rawLang]);
  const fullDoc = info.previewKind === "html" && /<!doctype|<html[\s>]/i.test(code);
  const [tab, setTab] = useState<"preview" | "code">(info.previewKind && (fullDoc || info.previewKind === "svg" || info.isFile) ? "preview" : "code");
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const html = useMemo(() => highlight(code, info.lang), [code, info.lang]);
  const doc = useMemo(() => (info.previewKind ? buildPreviewDoc(code, info.previewKind) : ""), [code, info.previewKind]);
  const label = info.isFile ? info.filename : info.lang || "code";
  const downloadName = info.isFile ? info.filename : `code.${DEFAULT_EXT[info.lang] || "txt"}`;
  const downloadExt = info.isFile ? info.ext : DEFAULT_EXT[info.lang] || "txt";

  useEffect(() => {
    if (!full) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  const onCopy = async () => { if (await copyText(code)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } };

  return (
    <div className={`code-block ${info.isFile ? "is-file" : ""}`}>
      <div className="code-head">
        <span className="code-label">{info.isFile ? <FileText size={13} /> : <Code size={13} />}<span>{label}</span></span>
        <span className="code-actions">
          {info.previewKind && <span className="code-tabs" role="tablist">
            <button role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")}><Eye size={12} />Preview</button>
            <button role="tab" aria-selected={tab === "code"} className={tab === "code" ? "on" : ""} onClick={() => setTab("code")}><Code size={12} />Code</button>
          </span>}
          {info.previewKind && tab === "preview" && <>
            <button className="code-btn" onClick={() => setReloadKey((k) => k + 1)} aria-label="Reload preview" title="Reload preview"><RefreshCw size={13} /></button>
            <button className="code-btn" onClick={() => setFull(true)} aria-label="Fullscreen preview" title="Fullscreen"><Maximize2 size={13} /></button>
          </>}
          <button className="code-btn" onClick={onCopy} aria-label="Copy code" title="Copy">{copied ? <Check size={13} /> : <Copy size={13} />}<span>{copied ? "Copied" : "Copy"}</span></button>
          {(info.isFile || info.previewKind) && <button className={`code-btn ${info.isFile ? "primary" : ""}`} onClick={() => downloadText(downloadName, code, downloadExt)} aria-label={`Download ${downloadName}`} title={`Download ${downloadName}`}><Download size={13} /><span>Download</span></button>}
        </span>
      </div>
      {info.previewKind && tab === "preview"
        ? <PreviewFrame key={reloadKey} doc={doc} className="preview-frame" />
        : <div className="code-body"><pre><code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /></pre></div>}
      {full && <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Preview">
        <div className="preview-overlay-bar"><strong>{label}</strong><button className="code-btn" onClick={() => setFull(false)} aria-label="Close preview"><X size={15} /><span>Close</span></button></div>
        <PreviewFrame key={`full-${reloadKey}`} doc={doc} className="preview-frame full" />
      </div>}
    </div>
  );
}

function PreBlock({ children }: { children?: ReactNode }) {
  const child = Children.toArray(children)[0];
  if (!isValidElement(child)) return <pre>{children}</pre>;
  const props = child.props as { className?: string; children?: ReactNode };
  const raw = /language-(\S+)/.exec(props.className || "")?.[1] || "";
  const code = (Array.isArray(props.children) ? props.children.join("") : String(props.children ?? "")).replace(/\n$/, "");
  return <CodeBlock rawLang={raw} code={code} />;
}

const components = {
  pre: PreBlock,
  table: ({ children }: { children?: ReactNode }) => <div className="table-wrap"><table>{children}</table></div>,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
};

function MessageContent({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>;
}
export default memo(MessageContent);
