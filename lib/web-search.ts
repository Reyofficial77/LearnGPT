type SearchResult = { title: string; url: string; snippet: string };

function decodeEntities(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}
function cleanText(value: string) {
  return decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}
function resultUrl(raw: string) {
  try {
    const url = new URL(decodeEntities(raw), "https://duckduckgo.com");
    const target = url.searchParams.get("uddg");
    const resolved = target ? new URL(target) : url;
    return /^https?:$/.test(resolved.protocol) ? resolved.toString() : "";
  } catch { return ""; }
}
function parseResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const anchors = html.match(/<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*>[\s\S]*?<\/a>/gi) || [];
  const snippets = html.match(/<a\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>[\s\S]*?<\/a>|<div\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>[\s\S]*?<\/div>/gi) || [];
  for (let index = 0; index < anchors.length && results.length < 6; index++) {
    const anchor = anchors[index];
    const href = /\bhref=["']([^"']+)["']/i.exec(anchor)?.[1] || "";
    const title = cleanText(anchor);
    const url = resultUrl(href);
    const snippet = snippets[index] ? cleanText(snippets[index]) : "";
    if (title && url && !url.includes("duckduckgo.com")) results.push({ title, url, snippet });
  }
  return results;
}

/** Search the public DuckDuckGo HTML results page without exposing a search key to the browser. */
export async function webSearch(query: string): Promise<SearchResult[]> {
  const safeQuery = query.trim().slice(0, 240);
  if (!safeQuery) return [];
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(safeQuery)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LearnGPT/1.0; +https://www.learngpt.my.id)" },
    signal: AbortSignal.timeout(9000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Web search returned HTTP ${response.status}.`);
  return parseResults(await response.text());
}

export function needsWebSearch(prompt: string) {
  return /\b(search (the )?web|look up|latest|newest|current|today|tonight|this week|recent|news|price|pricing|release date|version|official documentation|right now|as of 20\d\d)\b|\b(cari di internet|telusuri|terbaru|sekarang|hari ini|minggu ini|berita|harga|versi terbaru|dokumentasi resmi)\b/i.test(prompt);
}

export function formatSearchContext(results: SearchResult[]) {
  if (!results.length) return "";
  return `## Fresh web search results\nUse these results as evidence where relevant. Cite the original links in your response using Markdown links. Do not claim that a result proves more than its title/snippet supports.\n\n${results.map((item, index) => `${index + 1}. ${item.title}\nURL: ${item.url}\nSnippet: ${item.snippet || "No snippet available."}`).join("\n\n")}`;
}
