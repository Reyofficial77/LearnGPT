"use client";
import { useEffect, useMemo, useState } from "react";
import { Code, Play, RotateCcw, Terminal, Trash2, X } from "react-feather";
import type { Lang } from "../lib/i18n";

type RunnerLanguage = "javascript" | "python" | "html" | "css";
const STARTERS: Record<RunnerLanguage, string> = {
  javascript: `// Tulis JavaScript di sini\nconst name = "LearnGPT";\nconsole.log("Halo dari", name);\nconsole.log("2 + 3 =", 2 + 3);`,
  python: `# Tulis Python di sini\nname = "LearnGPT"\nprint(f"Halo dari {name}")\nprint("2 + 3 =", 2 + 3)`,
  html: `<!doctype html>\n<html lang="id">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Preview LearnGPT</title>\n  <style>body{font-family:system-ui;padding:24px}h1{color:#1677ec}</style>\n</head>\n<body>\n  <h1>Halo, LearnGPT!</h1>\n  <p>Ubah HTML ini lalu tekan Preview.</p>\n  <button onclick="document.querySelector('p').textContent='Tombol berhasil diklik!'">Coba klik</button>\n</body>\n</html>`,
  css: `body {\n  font-family: system-ui, sans-serif;\n  background: #eef4ff;\n}\n.preview-card {\n  max-width: 420px;\n  margin: 48px auto;\n  padding: 28px;\n  border-radius: 18px;\n  background: white;\n  box-shadow: 0 8px 30px #1d4ed822;\n}\n.preview-card h1 { color: #176fd1; }`
};

function safeJsString(value: string) { return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026"); }
export function createExecutionDocument(code: string, language: RunnerLanguage, isIndonesian: boolean) {
  const source = safeJsString(code);
  if (language === "html") return code;
  if (language === "css") {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:24px;background:#eef2f8;font-family:system-ui,sans-serif}.preview-card{max-width:460px;margin:24px auto;padding:28px;border-radius:18px;background:white}.preview-card h1{margin-top:0}.preview-card button{padding:10px 14px;border:0;border-radius:9px;background:#176fd1;color:white}</style><script>const style=document.createElement('style');style.textContent=${source};document.head.appendChild(style)<\/script></head><body><main class="preview-card"><h1>CSS Live Preview</h1><p>Pratinjau ini memakai CSS yang sedang kamu tulis.</p><button>Contoh tombol</button></main></body></html>`;
  }
  const outputLabel = isIndonesian ? "Output program" : "Program output";
  const loadingLabel = isIndonesian ? "Memuat runtime Python dari CDN…" : "Loading Python runtime from CDN…";
  const runScript = language === "python"
    ? `const out=document.getElementById('output');const write=(value,error=false)=>{const line=document.createElement('div');line.className=error?'error':'';line.textContent=String(value);out.appendChild(line)};(async()=>{try{write(${JSON.stringify(loadingLabel)});const pyodide=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.29.5/full/'});out.textContent='';pyodide.setStdout({batched:value=>write(value)});pyodide.setStderr({batched:value=>write(value,true)});await pyodide.runPythonAsync(${source});}catch(error){write(error&&error.stack?error.stack:String(error),true)}})();`
    : `const source=${source};const out=document.getElementById('output');const write=(value,error=false)=>{const line=document.createElement('div');line.className=error?'error':'';line.textContent=String(value);out.appendChild(line)};const format=value=>typeof value==='string'?value:value===undefined?'undefined':JSON.stringify(value);const original={log:console.log,info:console.info,warn:console.warn,error:console.error};for(const key of Object.keys(original)){console[key]=(...args)=>{write(args.map(format).join(' '),key==='error'||key==='warn');original[key].apply(console,args)}}window.onerror=(message,source,line,column,error)=>{write(error&&error.stack?error.stack:String(message)+' at '+line+':'+column,true)};window.onunhandledrejection=event=>write(event.reason&&event.reason.stack?event.reason.stack:String(event.reason),true);(async()=>{try{const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;const result=await new AsyncFunction('console','document','window','write',source)(console,document,window,write);if(result!==undefined)write(format(result))}catch(error){write(error&&error.stack?error.stack:String(error),true)}})();`;
  const pyScript = language === "python" ? `<script src="https://cdn.jsdelivr.net/pyodide/v0.29.5/full/pyodide.js"><\/script>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${outputLabel}</title><style>*{box-sizing:border-box}body{margin:0;padding:14px;background:#10151d;color:#dbe5f2;font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}#output{white-space:pre-wrap;overflow-wrap:anywhere}.error{color:#ff9a9a;padding:3px 0}</style></head><body><div id="output"></div>${pyScript}<script>${runScript}<\/script></body></html>`;
}

export default function CodeRunnerModal({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const [language, setLanguage] = useState<RunnerLanguage>("javascript");
  const [code, setCode] = useState(STARTERS.javascript);
  const [resultDoc, setResultDoc] = useState("");
  const [runKey, setRunKey] = useState(0);
  const [ran, setRan] = useState(false);
  const isId = lang === "id";
  const isPreview = language === "html" || language === "css";
  const resultTitle = useMemo(() => isPreview ? (isId ? "Pratinjau" : "Preview") : (isId ? "Output & Debug" : "Output & Debug"), [isPreview, isId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);

  const chooseLanguage = (next: RunnerLanguage) => { setLanguage(next); setCode(STARTERS[next]); setResultDoc(""); setRan(false); };
  const execute = () => { setResultDoc(createExecutionDocument(code, language, isId)); setRunKey((key) => key + 1); setRan(true); };
  const clear = () => { setResultDoc(""); setRan(false); };

  return <div className="code-runner-overlay" role="dialog" aria-modal="true" aria-labelledby="code-runner-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="code-runner-modal">
      <header className="code-runner-heading">
        <div className="code-runner-title-wrap"><span className="code-runner-icon"><Terminal size={19}/></span><div><h2 id="code-runner-title">Code Runner</h2><p>{isId ? "Tulis, jalankan, dan periksa kode secara langsung." : "Write, run, and inspect your code instantly."}</p></div></div>
        <button className="icon-button" onClick={onClose} aria-label={isId ? "Tutup Code Runner" : "Close Code Runner"}><X size={19}/></button>
      </header>
      <div className="code-runner-toolbar">
        <label className="code-runner-language"><Code size={15}/><span>{isId ? "Bahasa" : "Language"}</span><select value={language} onChange={(event) => chooseLanguage(event.target.value as RunnerLanguage)} aria-label={isId ? "Pilih bahasa pemrograman" : "Choose programming language"}><option value="javascript">JavaScript</option><option value="python">Python</option><option value="html">HTML</option><option value="css">CSS</option></select></label>
        <div className="code-runner-toolbar-actions"><button className="code-runner-clear" onClick={clear}><Trash2 size={15}/><span>{isId ? "Bersihkan output" : "Clear output"}</span></button><button className="code-runner-execute" onClick={execute} disabled={!code.trim()}><Play size={15}/><span>{isPreview ? (isId ? "Preview" : "Preview") : (isId ? "Jalankan" : "Run code")}</span></button></div>
      </div>
      <div className="code-runner-workspace">
        <section className="code-runner-editor"><div className="code-runner-panel-head"><strong>{isId ? "Editor" : "Editor"}<span>{language === "javascript" ? "script.js" : language === "python" ? "main.py" : language === "html" ? "index.html" : "styles.css"}</span></strong><button onClick={() => setCode(STARTERS[language])} title={isId ? "Reset contoh kode" : "Reset starter code"}><RotateCcw size={14}/>{isId ? "Reset" : "Reset"}</button></div><textarea spellCheck={false} autoCapitalize="off" autoCorrect="off" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); execute(); } }} aria-label={isId ? "Editor kode" : "Code editor"} /></section>
        <section className="code-runner-result"><div className="code-runner-panel-head"><strong><Terminal size={14}/>{resultTitle}</strong><span className={`runner-status ${ran ? "ran" : "idle"}`}>{ran ? (isId ? "Dijalankan" : "Executed") : (isId ? "Menunggu" : "Ready")}</span></div>{ran ? <iframe key={runKey} className={`code-runner-frame ${isPreview ? "visual" : "console"}`} sandbox="allow-scripts allow-forms allow-modals" srcDoc={resultDoc} title={resultTitle} referrerPolicy="no-referrer"/> : <div className="code-runner-empty"><Terminal size={24}/><strong>{isId ? "Output akan muncul di sini" : "Your output will appear here"}</strong><span>{isId ? "Tekan Jalankan untuk mengeksekusi kode." : "Press Run code to execute your program."}</span></div>}</section>
      </div>
      <footer className="code-runner-footer"><span>{isId ? "Kode dijalankan di iframe sandbox browser. Python memuat Pyodide dari CDN saat pertama kali digunakan." : "Code runs inside a sandboxed browser iframe. Python loads Pyodide from a CDN on first use."}</span><button className="settings-cancel" onClick={onClose}>{isId ? "Selesai" : "Done"}</button></footer>
    </section>
  </div>;
}
