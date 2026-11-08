"use client";
import { Children, type ReactNode, isValidElement, memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Code, Copy, Download, Eye, FileText, Maximize2, Play, RefreshCw, X } from "react-feather";
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

function buildRunnerDoc(code: string, lang: string) {
  const encoded = JSON.stringify(code).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  const isPython = ["python", "py", "python3"].includes(lang);
  const script = isPython
    ? `const source=${encoded};const out=document.getElementById("output");const write=(value,error=false)=>{const line=document.createElement("div");line.className=error?"error":"";line.textContent=String(value);out.appendChild(line)};(async()=>{try{write("Loading Python runtime...");const pyodide=await loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.29.5/full/"});out.textContent="";pyodide.setStdout({batched:(value)=>write(value)});pyodide.setStderr({batched:(value)=>write(value,true)});await pyodide.runPythonAsync(source)}catch(error){write(error&&error.stack?error.stack:String(error),true)}})();`
    : `const source=${encoded};const out=document.getElementById("output");const write=(value,error=false)=>{const line=document.createElement("div");line.className=error?"error":"";line.textContent=String(value);out.appendChild(line)};const format=(value)=>typeof value==="string"?value:(value===undefined?"undefined":JSON.stringify(value));const original={log:console.log,info:console.info,warn:console.warn,error:console.error};for(const key of Object.keys(original)){console[key]=(...args)=>{write(args.map(format).join(" "),key==="error"||key==="warn");original[key].apply(console,args)}};window.onerror=(message,source,line,column,error)=>{write(error&&error.stack?error.stack:String(message)+" at "+line+":"+column,true)};window.onunhandledrejection=(event)=>write(event.reason&&event.reason.stack?event.reason.stack:String(event.reason),true);(async()=>{try{const execute=new Function("console","document","window","return (async function(){\\n"+source+"\\n})()");const result=await execute(console,document,window);if(result!==undefined)write(format(result))}catch(error){write(error&&error.stack?error.stack:String(error),true)}})();`;
  const pyScript = isPython ? '<script src="https://cdn.jsdelivr.net/pyodide/v0.29.5/full/pyodide.js"></script>' : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:14px;background:#11151c;color:#dbe5f2;font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}#output{white-space:pre-wrap;overflow-wrap:anywhere}.error{color:#ff9a9a;padding:3px 0}</style></head><body><div id="output"></div>${pyScript}<script>${script}</script></body></html>`;
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
  const fullHtmlDocument = info.previewKind === "html" && /<!doctype|<html[\s>]/i.test(code);
  const [tab, setTab] = useState<"preview" | "code">(info.previewKind && (fullHtmlDocument || info.previewKind === "svg" || info.isFile) ? "preview" : "code");
  const [copied, setCopied] = useState(false);
  const [fullPreview, setFullPreview] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [showOutput, setShowOutput] = useState(false);
  const html = useMemo(() => highlight(code, info.lang), [code, info.lang]);
  const isPython = ["python", "py", "python3"].includes(info.lang);
  const isJavaScript = ["js", "javascript", "mjs", "cjs"].includes(info.lang);
  const canRun = !info.isFile && (isPython || isJavaScript);
  const previewDoc = useMemo(() => info.previewKind ? buildPreviewDoc(code, info.previewKind) : "", [code, info.previewKind]);
  const runDoc = useMemo(() => canRun ? buildRunnerDoc(code, info.lang) : "", [canRun, code, info.lang]);
  const label = info.isFile ? info.filename : LANGUAGE_LABELS[info.lang] || (info.lang ? info.lang.charAt(0).toUpperCase() + info.lang.slice(1) : "Code");
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

  return <div className={`code-block ${info.isFile ? "is-file" : ""}`}>
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
        {canRun && <button type="button" className="code-btn run-code" onClick={onRun} title="Run code"><Play size={14}/><span>Run</span></button>}
        <button type="button" className="code-btn code-copy" onClick={onCopy} aria-label={copied ? "Copied" : "Copy code"} title={copied ? "Copied" : "Copy code"}>{copied ? <Check size={15}/> : <Copy size={15}/>}</button>
        {(info.isFile || info.previewKind) && <button type="button" className="code-btn code-download" onClick={() => downloadText(downloadName, code, downloadExt)} aria-label={`Download ${downloadName}`} title={`Download ${downloadName}`}><Download size={14}/></button>}
      </span>
    </div>
    {info.previewKind && tab === "preview"
      ? <PreviewFrame key={reloadKey} doc={previewDoc} className="preview-frame"/>
      : <div className="code-body"><pre><code className="hljs" dangerouslySetInnerHTML={{ __html: html }}/></pre></div>}
    {canRun && showOutput && <div className="run-output console-output">
      <div className="run-output-head"><strong>Output</strong><span className="run-output-actions"><button type="button" className="code-btn" onClick={() => setShowOutput(false)} aria-label="Close output" title="Close output"><X size={14}/></button></span></div>
      <iframe key={runKey} className="run-frame console" sandbox="allow-scripts" srcDoc={runDoc} title={`${label} output`} referrerPolicy="no-referrer"/>
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
