import { tagKind, tagName, type Thought, type Topic } from "../data/model";

// Real headlines from Google News, fetched through a small server function
// (browsers can't read the feed directly). Nothing here is ever made up: if the
// fetch fails, there is simply nothing new to show.

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  published: string;
}

const ENDPOINT = (import.meta.env.VITE_NEWS_URL as string | undefined) || "/api/news";
const cache = new Map<string, Promise<NewsItem[]>>();

export function fetchNews(query: string): Promise<NewsItem[]> {
  const key = query.trim().toLowerCase();
  if (!key) return Promise.resolve([]);
  let p = cache.get(key);
  if (!p) {
    p = fetch(`${ENDPOINT}?q=${encodeURIComponent(query.trim())}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => (Array.isArray(d?.items) ? (d.items as NewsItem[]).filter((i) => i.title && i.link) : []))
      .catch(() => [] as NewsItem[]);
    cache.set(key, p);
  }
  return p;
}

/** Brands a thought mentions, as search terms. */
export function thoughtQueries(t: Thought): string[] {
  return t.tags.filter((tag) => tagKind(tag) === "brand").map(tagName);
}

/** What a topic is worth looking up: its own searches first, then the brands its thoughts mention. */
export function topicQueries(topic: Topic, thoughts: Thought[]): string[] {
  const out = [...topic.news];
  for (const t of thoughts) for (const q of thoughtQueries(t)) if (!out.includes(q)) out.push(q);
  return out;
}
