"use client";
import { Children, type ReactNode, isValidElement, memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Code, Copy, Download, Eye, FileText, Folder, Maximize2, Play, RefreshCw, X } from "react-feather";
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

const MIME: Record<string, string> = { html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript", json: "application/json", md: "text/markdown", csv: "text/csv", svg: "image/svg+xml", xml: "application/xml", yml: "text/yaml", yaml: "text/yaml" };
const DEFAULT_EXT: Record<string, string> = { javascript: "js", js: "js", jsx: "jsx", typescript: "ts", ts: "ts", tsx: "tsx", python: "py", py: "py", html: "html", css: "css", json: "json", bash: "sh", sh: "sh", sql: "sql", java: "java", c: "c", cpp: "cpp", csharp: "cs", php: "php", go: "go", rust: "rs", kotlin: "kt", yaml: "yml", yml: "yml", markdown: "md", md: "md", xml: "xml", svg: "svg" };
const LANGUAGE_LABELS: Record<string, string> = { js: "JavaScript", javascript: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", jsx: "JavaScript JSX", ts: "TypeScript", typescript: "TypeScript", tsx: "TypeScript JSX", py: "Python", python: "Python", python3: "Python", html: "HTML", htm: "HTML", css: "CSS", svg: "SVG", json: "JSON", bash: "Bash", sh: "Shell", sql: "SQL", java: "Java", c: "C", cpp: "C++", csharp: "C#", php: "PHP", go: "Go", rust: "Rust", kotlin: "Kotlin", yaml: "YAML", yml: "YAML", markdown: "Markdown", md: "Markdown", xml: "XML" };

export function parseFenceLang(raw: string) {
  const lower = raw.toLowerCase();
  const isFile = lower.startsWith("file:");
  const isProject = lower.startsWith("project:");
  const filename = isFile ? raw.slice(5).trim().replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "") || "file.txt" : "";
  const projectName = isProject ? raw.slice(8).trim().replace(/[^\w.\-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "learngpt-project" : "";
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  const lang = isFile ? ext : isProject ? "json" : lower;
  const previewKind: "html" | "svg" | null = lang === "html" || lang === "htm" ? "html" : lang === "svg" ? "svg" : null;
  return { isFile, isProject, filename, projectName, ext, lang, previewKind };
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

function buildRunnerDoc(code: string, lang: string) {
  const encoded = JSON.stringify(code).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  const isPython = ["python", "py", "python3"].includes(lang);
  const script = isPython
    ? `const source=${encoded};const out=document.getElementById("output");const started=performance.now();const write=(value,type="output")=>{const line=document.createElement("div");line.className=type;line.textContent=String(value);out.appendChild(line);out.scrollTop=out.scrollHeight};const withTimeout=(promise,ms,message)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(message)),ms);promise.then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})});const loadScript=()=>new Promise((resolve,reject)=>{if(typeof loadPyodide==="function"){resolve();return}const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.js";script.crossOrigin="anonymous";script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error("Could not download Pyodide. Check your internet connection or allow cdn.jsdelivr.net."));document.head.appendChild(script)});(async()=>{try{write("Execution started","status");write("Loading Python runtime (Pyodide 314.0.7)…","status");await withTimeout(loadScript(),30000,"Timed out while downloading Pyodide. Retry after checking your internet connection.");if(typeof loadPyodide!=="function")throw new Error("Pyodide loaded, but its runtime could not be initialized.");const pyodide=await withTimeout(loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v314.0.7/full/"}),90000,"Timed out while initializing Python. Retry the run.");pyodide.setStdout({batched:value=>write(value,"output")});pyodide.setStderr({batched:value=>write(value,"error")});write("Running Python…","status");await withTimeout(pyodide.runPythonAsync(source),90000,"Python code exceeded the 90-second execution limit.");write("Execution completed in "+Math.round(performance.now()-started)+" ms","status success")}catch(error){write(error&&error.stack?error.stack:String(error),"error");write("Execution failed","status error")}})();`
    : `const source=${encoded};const out=document.getElementById("output");const started=performance.now();const write=(value,type="output")=>{const line=document.createElement("div");line.className=type;line.textContent=String(value);out.appendChild(line);out.scrollTop=out.scrollHeight};const format=value=>typeof value==="string"?value:(value===undefined?"undefined":JSON.stringify(value));const capturedConsole={log:(...args)=>write(args.map(format).join(" ")),info:(...args)=>write(args.map(format).join(" ")),warn:(...args)=>write(args.map(format).join(" "),"warn"),error:(...args)=>write(args.map(format).join(" "),"error")};window.onerror=(message,source,line,column,error)=>{write(error&&error.stack?error.stack:String(message)+" at "+line+":"+column,"error")};window.onunhandledrejection=event=>write(event.reason&&event.reason.stack?event.reason.stack:String(event.reason),"error");(async()=>{try{write("Execution started","status");const execute=new Function("console","document","window","return (async function(){\n"+source+"\n})()");const result=await execute(capturedConsole,document,window);if(result!==undefined)write(format(result));write("Execution completed in "+Math.round(performance.now()-started)+" ms","status success")}catch(error){write(error&&error.stack?error.stack:String(error),"error");write("Execution failed","status error")}})();`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{color-scheme:dark}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;min-height:100%;background:#1b1b1b!important;color:#e7e9ed!important}body{padding:7px 0 10px;font:13px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace}#output{height:100%;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;color:#e7e9ed}.status{color:#a8b0bc;padding:1px 0}.success{color:#9ed7b0}.output{color:#f7f8fa;font-weight:600;padding:3px 0}.warn{color:#f2c879;padding:2px 0}.error{color:#ff9999;padding:2px 0}</style></head><body><div id="output" aria-live="polite"></div><script>${script}</script></body></html>`;
}

function parseProjectManifest(code: string): { files: Record<string, string>; error?: string } {
  try {
    const parsed = JSON.parse(code);
    const source = parsed && typeof parsed === "object" && parsed.files && typeof parsed.files === "object" && !Array.isArray(parsed.files) ? parsed.files : null;
    if (!source) return { files: {}, error: "Project manifest must contain a files object." };
    const entries = Object.entries(source);
    if (!entries.length || entries.some(([path, content]) => !path || typeof content !== "string")) return { files: {}, error: "Project manifest needs file paths and complete text contents." };
    return { files: Object.fromEntries(entries as [string, string][]) };
  } catch { return { files: {}, error: "The project manifest is not valid JSON." }; }
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try { const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok; } catch { return false; }
  }
}

function PreviewFrame({ doc, className }: { doc: string; className: string }) {
  return <iframe className={className} sandbox="allow-scripts allow-forms allow-modals allow-popups" srcDoc={doc} title="Code preview" referrerPolicy="no-referrer" />;
}

function CodeBlock({ rawLang, code }: { rawLang: string; code: string }) {
  const info = useMemo(() => parseFenceLang(rawLang), [rawLang]);
  const [tab, setTab] = useState<"preview" | "code">(info.previewKind ? "preview" : "code");
  const [copied, setCopied] = useState(false);
  const [fullPreview, setFullPreview] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [downloadState, setDownloadState] = useState<"idle" | "loading" | "error">("idle");
  const [downloadError, setDownloadError] = useState("");
  const html = useMemo(() => highlight(code, info.lang), [code, info.lang]);
  const isPython = ["python", "py", "python3"].includes(info.lang);
  const isJavaScript = ["js", "javascript", "mjs", "cjs"].includes(info.lang);
  const canRun = !info.isFile && !info.isProject && (isPython || isJavaScript);
  const previewDoc = useMemo(() => info.previewKind ? buildPreviewDoc(code, info.previewKind) : "", [code, info.previewKind]);
  const manifest = useMemo<{ files: Record<string, string>; error?: string }>(() => info.isProject ? parseProjectManifest(code) : { files: {} }, [code, info.isProject]);
  const runDoc = useMemo(() => canRun ? buildRunnerDoc(code, info.lang) : "", [canRun, code, info.lang]);
  const label = info.isProject ? info.projectName : info.isFile ? info.filename : LANGUAGE_LABELS[info.lang] || (info.lang ? info.lang.charAt(0).toUpperCase() + info.lang.slice(1) : "Code");
  const downloadName = info.isFile ? info.filename : `code.${DEFAULT_EXT[info.lang] || "txt"}`;
  const downloadExt = info.isFile ? info.ext : DEFAULT_EXT[info.lang] || "txt";

  useEffect(() => {
    if (!fullPreview) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setFullPreview(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullPreview]);

  const onCopy = async () => {
    if (await copyText(code)) { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
  };
  const onRun = () => { setShowOutput(true); setRunKey((key) => key + 1); };
  const onDownloadProject = async () => {
    if (downloadState === "loading" || Object.keys(manifest.files).length === 0) return;
    setDownloadState("loading"); setDownloadError("");
    try {
      const response = await fetch("/api/download/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: info.projectName, files: manifest.files }) });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || `Download failed (${response.status}).`); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${info.projectName}.zip`; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setDownloadState("idle");
    } catch (error) { setDownloadError(error instanceof Error ? error.message : "Could not create the ZIP archive."); setDownloadState("error"); }
  };

  if (info.isProject) {
    const paths = Object.keys(manifest.files);
    return <div className="code-block project-code-block">
      <div className="project-export-main">
        <span className="project-export-icon"><Folder size={21}/></span>
        <div className="project-export-copy"><strong>{label}</strong><span>{paths.length ? `${paths.length} files ready to download` : manifest.error}</span></div>
        <button type="button" className="project-download" onClick={onDownloadProject} disabled={!paths.length || downloadState === "loading"}>
          {downloadState === "loading" ? <RefreshCw size={15} className="spin"/> : <Download size={15}/>}<span>{downloadState === "loading" ? "Creating ZIP…" : "Download ZIP"}</span>
        </button>
      </div>
      {paths.length > 0 && <div className="project-file-list">{paths.slice(0, 5).map((path) => <span key={path}><FileText size={13}/>{path}</span>)}{paths.length > 5 && <span>+{paths.length - 5} more files</span>}</div>}
      {downloadError && <p className="project-download-error" role="alert">{downloadError}</p>}
    </div>;
  }

  return <div className={`code-block ${info.isFile ? "is-file" : ""}${canRun && showOutput ? " is-running" : ""}`}>
    <div className="code-head">
      <span className="code-label">{info.isFile ? <FileText size={15} aria-hidden="true"/> : <Code size={15} aria-hidden="true"/>}<span>{label}</span></span>
      <span className="code-actions">
        {info.previewKind && <span className="code-tabs" role="tablist" aria-label="HTML preview tabs">
          <button type="button" role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")}><Eye size={12}/>Preview</button>
          <button type="button" role="tab" aria-selected={tab === "code"} className={tab === "code" ? "on" : ""} onClick={() => setTab("code")}><Code size={12}/>Code</button>
        </span>}
        {info.previewKind && tab === "preview" && <>
          <button type="button" className="code-btn" onClick={() => setReloadKey((key) => key + 1)} aria-label="Reload preview" title="Reload preview"><RefreshCw size={14}/></button>
          <button type="button" className="code-btn" onClick={() => setFullPreview(true)} aria-label="Fullscreen preview" title="Fullscreen preview"><Maximize2 size={14}/></button>
        </>}
        {canRun && !showOutput && <button type="button" className="code-btn run-code" onClick={onRun} title="Run code"><Play size={14}/><span>Run</span></button>}
        <button type="button" className="code-btn code-copy" onClick={onCopy} aria-label={copied ? "Copied" : "Copy code"} title={copied ? "Copied" : "Copy code"}>{copied ? <Check size={15}/> : <Copy size={15}/>}</button>
        {canRun && showOutput && <button type="button" className="code-btn code-return" onClick={() => setShowOutput(false)} title="Show code"><Code size={14}/><span>Code</span></button>}
        {(info.isFile || info.previewKind) && <button type="button" className="code-btn code-download" onClick={() => downloadText(downloadName, code, downloadExt)} aria-label={`Download ${downloadName}`} title={`Download ${downloadName}`}><Download size={14}/></button>}
      </span>
    </div>
    {info.previewKind && tab === "preview"
      ? <PreviewFrame key={reloadKey} doc={previewDoc} className="preview-frame"/>
      : <div className={`code-body${canRun && showOutput ? " code-output-body" : ""}`}>
          {canRun && showOutput
            ? <iframe key={runKey} className="run-frame inline-run-frame" sandbox="allow-scripts" srcDoc={runDoc} title={`${label} execution output`} referrerPolicy="no-referrer"/>
            : <pre><code className="hljs" dangerouslySetInnerHTML={{ __html: html }}/></pre>}
        </div>}
    {fullPreview && typeof document !== "undefined" && createPortal(<div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Fullscreen preview">
      <div className="preview-overlay-bar"><strong>{label} Preview</strong><button type="button" className="code-btn" onClick={() => setFullPreview(false)} aria-label="Close preview" title="Close preview"><X size={16}/><span>Close</span></button></div>
      <PreviewFrame key={`full-${reloadKey}`} doc={previewDoc} className="preview-frame full"/>
    </div>, document.body)}
  </div>;
}

function PreBlock({ children }: { children?: ReactNode }) {
  const child = Children.toArray(children)[0];
  if (!isValidElement(child)) return <pre>{children}</pre>;
  const props = child.props as { className?: string; children?: ReactNode };
  const raw = /language-(\S+)/.exec(props.className || "")?.[1] || "";
  const code = (Array.isArray(props.children) ? props.children.join("") : String(props.children ?? "")).replace(/\n$/, "");
  return <CodeBlock rawLang={raw} code={code}/>;
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
