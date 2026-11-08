"use client";
import { Children, type ReactNode, isValidElement, memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Code, Copy, Download, Eye, FileText, Maximize2, Play, RefreshCw, X } from "react-feather";
import type { Lang } from "../lib/i18n";
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

function buildRunnerDoc(code: string, lang: string, isIndonesian: boolean) {
  const encoded = JSON.stringify(code).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  const loading = isIndonesian ? "Menyiapkan runtime Python…" : "Loading Python runtime…";
  const script = lang === "python" || lang === "py" || lang === "python3"
    ? `const source=${encoded};const out=document.getElementById("output");const write=(value,error=false)=>{const line=document.createElement("div");line.className=error?"error":"";line.textContent=String(value);out.appendChild(line)};const format=(value)=>typeof value==="string"?value:(value===undefined?"undefined":JSON.stringify(value));(async()=>{try{write(${JSON.stringify(loading)});const pyodide=await loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.29.5/full/"});out.textContent="";pyodide.setStdout({batched:(value)=>write(value)});pyodide.setStderr({batched:(value)=>write(value,true)});await pyodide.runPythonAsync(source); }catch(error){write(error&&error.stack?error.stack:String(error),true)}})();`
    : `const source=${encoded};const out=document.getElementById("output");const write=(value,error=false)=>{const line=document.createElement("div");line.className=error?"error":"";line.textContent=String(value);out.appendChild(line)};const format=(value)=>typeof value==="string"?value:(value===undefined?"undefined":JSON.stringify(value));const original={log:console.log,info:console.info,warn:console.warn,error:console.error};for(const key of Object.keys(original)){console[key]=(...args)=>{write(args.map(format).join(" "),key==="error"||key==="warn");original[key].apply(console,args)}};window.onerror=(message,source,line,column,error)=>{write(error&&error.stack?error.stack:String(message)+" at "+line+":"+column,true)};window.onunhandledrejection=(event)=>write(event.reason&&event.reason.stack?event.reason.stack:String(event.reason),true);(async()=>{try{const execute=new Function("console","document","window","return (async function(){\\n"+source+"\\n})()");const result=await execute(console,document,window);if(result!==undefined)write(format(result))}catch(error){write(error&&error.stack?error.stack:String(error),true)}})();`;
  const pyScript = lang === "python" || lang === "py" || lang === "python3" ? '<script src="https://cdn.jsdelivr.net/pyodide/v0.29.5/full/pyodide.js"><\/script>' : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:14px;background:#11151c;color:#dbe5f2;font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}#output{white-space:pre-wrap;overflow-wrap:anywhere}.error{color:#ff9a9a;padding:3px 0}</style></head><body><div id="output"></div>${pyScript}<script>${script}<\/script></body></html>`;
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

function CodeBlock({ rawLang, code, lang }: { rawLang: string; code: string; lang: Lang }) {
  const info = useMemo(() => parseFenceLang(rawLang), [rawLang]);
  const fullDoc = info.previewKind === "html" && /<!doctype|<html[\s>]/i.test(code);
  const [tab, setTab] = useState<"preview" | "code">(info.previewKind && (fullDoc || info.previewKind === "svg" || info.isFile) ? "preview" : "code");
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [showOutput, setShowOutput] = useState(false);
  const html = useMemo(() => highlight(code, info.lang), [code, info.lang]);
  const doc = useMemo(() => (info.previewKind ? buildPreviewDoc(code, info.previewKind) : ""), [code, info.previewKind]);
  const label = info.isFile ? info.filename : info.lang || "code";
  const downloadName = info.isFile ? info.filename : `code.${DEFAULT_EXT[info.lang] || "txt"}`;
  const downloadExt = info.isFile ? info.ext : DEFAULT_EXT[info.lang] || "txt";
  const canRun = !info.isFile && ["js", "javascript", "mjs", "cjs", "node", "nodejs", "py", "python", "python3"].includes(info.lang);
  const runDoc = useMemo(() => buildRunnerDoc(code, info.lang, lang === "id"), [code, info.lang, lang]);

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
            <button role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")}><Eye size={12} />{lang === "id" ? "Pratinjau" : "Preview"}</button>
            <button role="tab" aria-selected={tab === "code"} className={tab === "code" ? "on" : ""} onClick={() => setTab("code")}><Code size={12} />{lang === "id" ? "Kode" : "Code"}</button>
          </span>}
          {info.previewKind && tab === "preview" && <>
            <button className="code-btn" onClick={() => setReloadKey((k) => k + 1)} aria-label={lang === "id" ? "Muat ulang preview" : "Reload preview"} title={lang === "id" ? "Muat ulang preview" : "Reload preview"}><RefreshCw size={13} /></button>
            <button className="code-btn" onClick={() => setFull(true)} aria-label={lang === "id" ? "Preview layar penuh" : "Fullscreen preview"} title={lang === "id" ? "Layar penuh" : "Fullscreen"}><Maximize2 size={13} /></button>
          </>}
          {canRun && <button className="code-btn run-code" onClick={() => { setShowOutput(true); setRunKey((key) => key + 1); }}><Play size={13} /><span>{lang === "id" ? "Jalankan" : "Run"}</span></button>}
          <button className="code-btn" onClick={onCopy} aria-label={lang === "id" ? "Salin kode" : "Copy code"} title={lang === "id" ? "Salin" : "Copy"}>{copied ? <Check size={13} /> : <Copy size={13} />}<span>{copied ? (lang === "id" ? "Disalin" : "Copied") : (lang === "id" ? "Salin" : "Copy")}</span></button>
          {(info.isFile || info.previewKind) && <button className={`code-btn ${info.isFile ? "primary" : ""}`} onClick={() => downloadText(downloadName, code, downloadExt)} aria-label={`Download ${downloadName}`} title={`Download ${downloadName}`}><Download size={13} /><span>{lang === "id" ? "Unduh" : "Download"}</span></button>}
        </span>
      </div>
      {info.previewKind && tab === "preview"
        ? <PreviewFrame key={reloadKey} doc={doc} className="preview-frame" />
        : <div className="code-body"><pre><code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /></pre></div>}
      {canRun && showOutput && <div className="run-output"><div className="run-output-head"><strong>{lang === "id" ? "Output" : "Output"}</strong><button className="code-btn" onClick={() => setShowOutput(false)} aria-label={lang === "id" ? "Tutup output" : "Close output"}><X size={13} /><span>{lang === "id" ? "Tutup" : "Close"}</span></button></div><iframe key={runKey} className="run-frame" sandbox="allow-scripts" srcDoc={runDoc} title={lang === "id" ? "Output eksekusi kode" : "Code execution output"} referrerPolicy="no-referrer" /></div>}
      {full && typeof document !== "undefined" && createPortal(<div className="preview-overlay" role="dialog" aria-modal="true" aria-label={lang === "id" ? "Pratinjau layar penuh" : "Fullscreen preview"}>
        <div className="preview-overlay-bar"><strong>{label}</strong><button className="code-btn" onClick={() => setFull(false)} aria-label={lang === "id" ? "Tutup preview" : "Close preview"}><X size={15} /><span>{lang === "id" ? "Tutup" : "Close"}</span></button></div>
        <PreviewFrame key={`full-${reloadKey}`} doc={doc} className="preview-frame full" />
      </div>, document.body)}
    </div>
  );
}

function PreBlock({ children, lang }: { children?: ReactNode; lang: Lang }) {
  const child = Children.toArray(children)[0];
  if (!isValidElement(child)) return <pre>{children}</pre>;
  const props = child.props as { className?: string; children?: ReactNode };
  const raw = /language-(\S+)/.exec(props.className || "")?.[1] || "";
  const code = (Array.isArray(props.children) ? props.children.join("") : String(props.children ?? "")).replace(/\n$/, "");
  return <CodeBlock rawLang={raw} code={code} lang={lang} />;
}

const components = {
  pre: (props: { children?: ReactNode }) => <PreBlock {...props} lang="en" />,
  table: ({ children }: { children?: ReactNode }) => <div className="table-wrap"><table>{children}</table></div>,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
};

function MessageContent({ content, lang = "en" }: { content: string; lang?: Lang }) {
  const localizedComponents = { ...components, pre: (props: { children?: ReactNode }) => <PreBlock {...props} lang={lang} /> };
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={localizedComponents}>{content}</ReactMarkdown>;
}
export default memo(MessageContent);
