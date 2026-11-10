import Link from "next/link";
import { ArrowRight, BookOpen, Code, Download, Globe, Search } from "react-feather";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LearnGPT",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web browser",
  description: "LearnGPT is an AI learning and coding assistant for explanations, web research, code execution, and downloadable project creation."
};

export default function PublicLanding() {
  return <main className="public-landing">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <header className="public-nav"><Link href="/" className="public-brand"><span><BookOpen size={20}/></span>LearnGPT</Link><Link href="/auth/login" className="public-signin">Sign in</Link></header>
    <section className="public-hero">
      <div className="public-hero-copy"><p className="public-kicker">LEARN · BUILD · CREATE</p><h1>Learn faster. Build with confidence.</h1><p className="public-lede">LearnGPT is an AI assistant for learning, coding, researching, and turning ideas into complete projects you can download.</p><div className="public-cta-row"><Link href="/auth/login" className="public-cta">Start with LearnGPT <ArrowRight size={17}/></Link><span>Free to explore · Your chats stay in your account</span></div></div>
      <div className="public-preview" aria-label="LearnGPT example workspace"><div className="public-preview-top"><span className="preview-book"><BookOpen size={16}/></span><strong>LearnGPT</strong><span className="preview-live">AI workspace</span></div><div className="public-prompt">Help me understand this code and build a small project.</div><div className="public-answer"><span className="answer-mark"><BookOpen size={15}/></span><div><strong>Let’s build it step by step.</strong><p>Explore concepts, run Python or JavaScript, and export your project as a ZIP file.</p><div className="public-code-line"><i></i><i></i><i></i><i></i></div></div></div><div className="public-preview-actions"><span><Code size={14}/> Run code</span><span><Download size={14}/> Download project</span></div></div>
    </section>
    <section className="public-features"><article><span><BookOpen size={19}/></span><h2>Learn clearly</h2><p>Get explanations, examples, and guided help across different subjects and skill levels.</p></article><article><span><Code size={19}/></span><h2>Write and run code</h2><p>Work with Python, JavaScript, HTML, and other languages directly in your conversation.</p></article><article><span><Search size={19}/></span><h2>Research with context</h2><p>Use web search for current information and follow source links in your answers.</p></article><article><span><Globe size={19}/></span><h2>Work in your language</h2><p>Choose from more than 20 interface languages and configure voice input language separately.</p></article><article><span><Download size={19}/></span><h2>Download your work</h2><p>Create individual files or complete multi-file projects packaged as ZIP downloads.</p></article></section>
    <footer className="public-footer"><span>LearnGPT · An AI workspace for learning and building</span><Link href="/auth/login">Open LearnGPT <ArrowRight size={14}/></Link></footer>
  </main>;
}
