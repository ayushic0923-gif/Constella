import { MONTH_TEXT, YEAR } from "./month";
import type { Logic, Reading } from "./lenses";

export type Kind = "noticed" | "memory" | "worry" | "plan" | "feeling" | "idea" | "question";

export const KIND_NAMES: Record<Kind, string> = {
  noticed: "Noticed",
  memory: "A memory",
  worry: "A worry",
  plan: "A plan",
  feeling: "A feeling",
  idea: "An idea",
  question: "A question",
};

const KIND_CODES: Record<string, Kind> = { n: "noticed", m: "memory", w: "worry", p: "plan", f: "feeling", i: "idea", q: "question" };
export const KINDS = Object.keys(KIND_NAMES) as Kind[];

/** "person:Mom", "place:Pune", "brand:Swiggy", "theme:sleep" */
export type Tag = string;
export type TagKind = "person" | "place" | "brand" | "theme";

export interface Thought {
  id: string;
  topicId: string;
  title: string;
  text: string;
  kind: Kind;
  /** ISO timestamp of when it happened. */
  at: string;
  tags: Tag[];
  own?: boolean;
  /** How it was written down: typed, spoken into the diary, or dictated (e.g. with Wispr Flow). */
  source?: "typed" | "voice" | "flow";
  /** For spoken thoughts: how long, and the shape of the voice. */
  voice?: { seconds: number; wave: number[] };
  /** What the lenses see in it. */
  reading?: Reading;
}

export interface Topic {
  id: string;
  name: string;
  about: string;
  /** Extra What's new searches for this topic, beyond its brands. */
  news: string[];
  own?: boolean;
}

export interface Mind {
  topics: Topic[];
  thoughts: Thought[];
  /** What led to what: causes, answers, kept intentions, tensions, loops. */
  logic?: Logic;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’'“”"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function tagKind(tag: Tag): TagKind {
  return tag.slice(0, tag.indexOf(":")) as TagKind;
}

export function tagName(tag: Tag): string {
  return tag.slice(tag.indexOf(":") + 1).replace(/_/g, " ");
}

/** How a list of shared tags reads in a sentence: "Mom, Pune and money". */
export function sayTags(tags: Tag[], max = 3): string {
  const names = tags.slice(0, max).map(tagName);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const PREFIX: Record<string, TagKind> = { "@": "person", "#": "place", $: "brand", "~": "theme" };

function parseTags(s: string): Tag[] {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((tok) => {
      const k = PREFIX[tok[0]];
      return k ? [`${k}:${tok.slice(1)}`] : [];
    });
}

/** The example month, parsed from its plain-text source. */
export function exampleMind(): Mind {
  const topics: Topic[] = [];
  const thoughts: Thought[] = [];
  const seen = new Set<string>();
  for (const line of MONTH_TEXT.split("\n")) {
    const l = line.trim();
    if (l.startsWith("## ")) {
      const [name, about, news] = l.slice(3).split("|").map((s) => s.trim());
      topics.push({
        id: slugify(name),
        name,
        about: about ?? "",
        news: news?.startsWith("news:") ? news.slice(5).split(";").map((s) => s.trim()).filter(Boolean) : [],
      });
    } else if (l.startsWith("- ") && topics.length) {
      const [when, title, code, text, tags] = l.slice(2).split("|").map((s) => s.trim());
      const [md, hm] = when.split(" ");
      const [mo, d] = md.split("-").map(Number);
      const [h, mi] = hm.split(":").map(Number);
      const topic = topics[topics.length - 1];
      let id = `${topic.id}/${slugify(title)}`;
      while (seen.has(id)) id += "-2";
      seen.add(id);
      thoughts.push({
        id,
        topicId: topic.id,
        title,
        text,
        kind: KIND_CODES[code] ?? "noticed",
        at: new Date(YEAR, mo - 1, d, h, mi).toISOString(),
        tags: parseTags(tags ?? ""),
      });
    }
  }
  return { topics, thoughts };
}

/** The last moment in the example month: "now" for its date filters. */
export function latestMoment(mind: Mind): Date {
  return mind.thoughts.reduce((m, t) => (new Date(t.at) > m ? new Date(t.at) : m), new Date(0));
}

/** Only what happened in the last `days` days before `until`. Topics with nothing left drop out. */
export function withinDays(mind: Mind, days: number | null, until: Date): Mind {
  if (!days) return mind;
  const from = until.getTime() - days * 86400000;
  const thoughts = mind.thoughts.filter((t) => {
    const at = new Date(t.at).getTime();
    return at >= from && at <= until.getTime() + 60000;
  });
  const live = new Set(thoughts.map((t) => t.topicId));
  const ids = new Set(thoughts.map((t) => t.id));
  const logic = mind.logic && {
    links: mind.logic.links.filter((l) => ids.has(l.a) && ids.has(l.b)),
    loops: mind.logic.loops.map((l) => ({ ...l, ids: l.ids.filter((i) => ids.has(i)) })).filter((l) => l.ids.length > 1),
    open: mind.logic.open.filter((o) => ids.has(o.id)),
  };
  return { topics: mind.topics.filter((t) => live.has(t.id)), thoughts, logic };
}

// ------------------------------------------------------------------ dates

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function formatDate(iso: string | Date): string {
  return DATE.format(new Date(iso));
}

export function formatTime(iso: string | Date): string {
  return TIME.format(new Date(iso)).toLowerCase().replace(/\s/g, " ");
}

export function formatWeekday(iso: string | Date): string {
  return WEEKDAY.format(new Date(iso));
}

/** "4 Oct · 7:30 am" */
export function formatStamp(iso: string | Date): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

/** "4 – 29 Oct" or "28 Sept – 3 Oct" */
export function formatSpan(a: string | Date, b: string | Date): string {
  const A = new Date(a);
  const B = new Date(b);
  if (A.toDateString() === B.toDateString()) return formatDate(A);
  if (A.getMonth() === B.getMonth()) return `${A.getDate()} – ${formatDate(B)}`;
  return `${formatDate(A)} – ${formatDate(B)}`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

// ------------------------------------------------------------------ reading tags out of someone's own words

const BRANDS = [
  "Swiggy", "Zomato", "Spotify", "Netflix", "Instagram", "WhatsApp", "Slack", "LinkedIn", "Figma", "Notion",
  "Uber", "Ola", "Rapido", "IndiGo", "Air India", "Airbnb", "Amazon", "Kindle", "Flipkart", "Apple", "iPhone",
  "Google", "YouTube", "Strava", "Decathlon", "Nike", "Adidas", "PhonePe", "Paytm", "Google Pay", "Maggi",
  "Britannia", "Amul", "Starbucks", "Blinkit", "Zepto", "Myntra", "Nykaa", "Tata", "Reliance", "Jio", "Airtel",
  "ChatGPT", "OpenAI", "Tesla", "Samsung", "Namma Metro", "DigiLocker", "Discord", "Reddit", "X", "Threads",
];
const PLACES = [
  "Bengaluru", "Bangalore", "Mumbai", "Delhi", "Pune", "Chennai", "Hyderabad", "Kolkata", "Goa", "Gokarna",
  "Ladakh", "Leh", "Kyoto", "Tokyo", "London", "New York", "Paris", "Dubai", "Singapore", "Indiranagar",
  "Koramangala", "Kerala", "Home", "Office",
];
const THEMES: Record<string, string[]> = {
  sleep: ["sleep", "slept", "tired", "insomnia", "awake", "nap", "bed"],
  money: ["money", "salary", "rent", "budget", "savings", "expensive", "price", "₹", "$", "loan", "emi"],
  work: ["work", "office", "meeting", "deadline", "boss", "manager", "project", "standup", "slack"],
  health: ["run", "ran", "gym", "back pain", "doctor", "health", "walk", "yoga", "sick"],
  food: ["food", "dinner", "lunch", "breakfast", "cook", "ate", "eat", "coffee", "chai", "order"],
  phone: ["phone", "scroll", "instagram", "notification", "screen"],
  family: ["mom", "mum", "dad", "mother", "father", "sister", "brother", "family", "grandma", "ajji"],
  love: ["love", "date", "ex", "breakup", "crush", "relationship"],
  travel: ["trip", "travel", "flight", "holiday", "vacation", "mountains", "beach"],
  future: ["future", "someday", "kids", "marriage", "plan"],
  worry: ["worried", "anxious", "scared", "stress", "nervous"],
  calm: ["calm", "peace", "quiet", "breathe", "grateful"],
  rain: ["rain", "monsoon", "umbrella", "wet"],
};

const word = (s: string) => new RegExp(`(^|[^\\p{L}])${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "iu");

/** Tags for a thought someone typed: explicit @/#/$/~ marks, known brands and places, names, themes. */
export function extractTags(text: string, knownPeople: string[] = []): Tag[] {
  const tags = new Set<Tag>();
  for (const m of text.matchAll(/([@#$~])([\p{L}\p{N}_]+)/gu)) tags.add(`${PREFIX[m[1]]}:${m[2]}`);
  for (const b of BRANDS) if (word(b).test(text)) tags.add(`brand:${b.replace(/ /g, "_")}`);
  for (const p of PLACES) if (word(p).test(text)) tags.add(`place:${p}`);
  for (const p of knownPeople) if (word(p).test(text)) tags.add(`person:${p}`);
  for (const [theme, words] of Object.entries(THEMES)) if (words.some((w) => word(w).test(text))) tags.add(`theme:${theme}`);
  return [...tags];
}
