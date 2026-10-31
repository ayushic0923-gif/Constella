import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

// /api/news?q=Swiggy during `vite` and `vite preview`: real headlines from the
// Google News RSS feed for the last two weeks. Production uses the matching
// Supabase Edge Function (supabase/functions/news).

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  published: string;
}

const TTL = 30 * 60 * 1000;
const cache = new Map<string, { at: number; items: NewsItem[] }>();

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .trim();
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decode(m[1]) : "";
}

export function parseFeed(xml: string, limit = 6): NewsItem[] {
  const items: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const source = pick(block, "source");
    let title = pick(block, "title");
    // Google appends " - Source" to every headline.
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const link = pick(block, "link");
    if (!title || !/^https?:\/\//.test(link)) continue;
    const date = new Date(pick(block, "pubDate"));
    items.push({ title, link, source, published: isNaN(date.getTime()) ? "" : date.toISOString() });
    if (items.length >= limit) break;
  }
  return items;
}

export async function fetchNews(query: string, region = process.env.NEWS_REGION || "IN:en"): Promise<NewsItem[]> {
  const q = query.trim().slice(0, 80);
  if (!q) return [];
  const key = `${region}|${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.items;
  const [gl, lang] = region.split(":");
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:14d`)}&hl=${lang}-${gl}&gl=${gl}&ceid=${gl}:${lang}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; InsideOneMind/1.0)" } });
  if (!res.ok) throw new Error(`news feed ${res.status}`);
  const items = parseFeed(await res.text());
  cache.set(key, { at: Date.now(), items });
  return items;
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "", "http://local");
  const q = url.searchParams.get("q") ?? "";
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const items = await fetchNews(q);
    res.setHeader("Cache-Control", "public, max-age=900");
    res.end(JSON.stringify({ query: q, items }));
  } catch {
    res.statusCode = 502;
    res.end(JSON.stringify({ query: q, items: [] }));
  }
}

export function newsPlugin(): Plugin {
  return {
    name: "inside-one-mind:news",
    configureServer(server) {
      server.middlewares.use("/api/news", (req, res) => void handle(req, res));
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/news", (req, res) => void handle(req, res));
    },
  };
}
