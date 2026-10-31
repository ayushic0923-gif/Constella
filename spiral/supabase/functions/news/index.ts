// GET /functions/v1/news?q=Swiggy — real headlines from Google News, last two weeks.
// Public (no sign-in), cached for 15 minutes. Same parsing as server/news.ts.
import { cors, json } from "../_shared/util.ts";

interface NewsItem {
  title: string;
  link: string;
  source: string;
  published: string;
}

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

function parseFeed(xml: string, limit = 6): NewsItem[] {
  const items: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const source = pick(block, "source");
    let title = pick(block, "title");
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const link = pick(block, "link");
    if (!title || !/^https?:\/\//.test(link)) continue;
    const date = new Date(pick(block, "pubDate"));
    items.push({ title, link, source, published: isNaN(date.getTime()) ? "" : date.toISOString() });
    if (items.length >= limit) break;
  }
  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) return json({ query: q, items: [] });
  const region = Deno.env.get("NEWS_REGION") ?? "IN:en";
  const [gl, lang] = region.split(":");
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:14d`)}&hl=${lang}-${gl}&gl=${gl}&ceid=${gl}:${lang}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; InsideOneMind/1.0)" } });
    if (!res.ok) return json({ query: q, items: [] }, 502);
    return json({ query: q, items: parseFeed(await res.text()) }, 200, { "Cache-Control": "public, max-age=900" });
  } catch {
    return json({ query: q, items: [] }, 502);
  }
});
