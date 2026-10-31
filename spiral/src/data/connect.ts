import { tagKind, type Mind, type Tag, type Thought } from "./model";

// What connects two thoughts is what they share: the same person, place,
// brand or theme. People weigh most, themes least.

const WEIGHT: Record<string, number> = { person: 3, place: 2, brand: 2, theme: 1 };
const weightOf = (tag: Tag) => WEIGHT[tagKind(tag)] ?? 1;

export interface ThoughtLink {
  a: string;
  b: string;
  shared: Tag[];
  weight: number;
  across: boolean;
}

export interface TopicLink {
  a: string;
  b: string;
  /** What the two topics have in common, strongest first. */
  shared: Tag[];
  /** 0..1, relative to the strongest pair of topics. */
  strength: number;
  /** The single pair of thoughts that joins them most strongly. */
  pair: [string, string];
}

export interface Connections {
  links: ThoughtLink[];
  topicLinks: TopicLink[];
  /** Topic ids in journey order: each topic leads to the one it connects to most. */
  order: string[];
  linksOf: (thoughtId: string) => ThoughtLink[];
  between: (a: string, b: string) => TopicLink | undefined;
}

function sharedTags(a: Thought, b: Thought): Tag[] {
  const set = new Set(b.tags);
  return a.tags.filter((t) => set.has(t)).sort((x, y) => weightOf(y) - weightOf(x));
}

export function connect(mind: Mind, start?: string): Connections {
  const { thoughts, topics } = mind;
  const all: ThoughtLink[] = [];
  for (let i = 0; i < thoughts.length; i++) {
    for (let j = i + 1; j < thoughts.length; j++) {
      const shared = sharedTags(thoughts[i], thoughts[j]);
      if (!shared.length) continue;
      const weight = shared.reduce((s, t) => s + weightOf(t), 0);
      all.push({ a: thoughts[i].id, b: thoughts[j].id, shared, weight, across: thoughts[i].topicId !== thoughts[j].topicId });
    }
  }

  // Keep each thought's strongest few links, so the picture shows structure, not a hairball.
  const keep = new Set<ThoughtLink>();
  const per = new Map<string, ThoughtLink[]>();
  for (const l of all) {
    if (l.across && l.weight < 2) continue;
    for (const id of [l.a, l.b]) {
      const list = per.get(id) ?? [];
      list.push(l);
      per.set(id, list);
    }
  }
  for (const list of per.values()) {
    list.sort((x, y) => y.weight - x.weight);
    list.filter((l) => !l.across).slice(0, 2).forEach((l) => keep.add(l));
    list.filter((l) => l.across).slice(0, 2).forEach((l) => keep.add(l));
  }
  const links = [...keep];

  // Topic to topic: sum every shared tag across their thoughts.
  const topicOf = new Map(thoughts.map((t) => [t.id, t.topicId]));
  const agg = new Map<string, { tags: Map<Tag, number>; total: number; best: ThoughtLink }>();
  for (const l of all) {
    if (!l.across) continue;
    const [ta, tb] = [topicOf.get(l.a)!, topicOf.get(l.b)!].sort();
    const key = `${ta}|${tb}`;
    const entry = agg.get(key) ?? { tags: new Map(), total: 0, best: l };
    for (const t of l.shared) entry.tags.set(t, (entry.tags.get(t) ?? 0) + weightOf(t));
    entry.total += l.weight;
    if (l.weight > entry.best.weight) entry.best = l;
    agg.set(key, entry);
  }
  const counts = new Map<string, number>();
  for (const t of thoughts) counts.set(t.topicId, (counts.get(t.topicId) ?? 0) + 1);
  const raw = [...agg.entries()].map(([key, e]) => {
    const [a, b] = key.split("|");
    const norm = e.total / Math.sqrt((counts.get(a) ?? 1) * (counts.get(b) ?? 1));
    return {
      a,
      b,
      norm,
      shared: [...e.tags.entries()].sort((x, y) => y[1] - x[1]).map(([t]) => t),
      pair: [e.best.a, e.best.b] as [string, string],
    };
  });
  const top = Math.max(1e-6, ...raw.map((r) => r.norm));
  const topicLinks: TopicLink[] = raw
    .filter((r) => r.norm / top > 0.12)
    .map((r) => ({ a: r.a, b: r.b, shared: r.shared, strength: r.norm / top, pair: r.pair }));

  const between = (a: string, b: string) => topicLinks.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));

  // Journey order: from the first topic, always on to the one it connects to most strongly.
  const ids = topics.map((t) => t.id);
  const order: string[] = [];
  const left = new Set(ids);
  let cur = start && left.has(start) ? start : ids[0];
  while (cur) {
    order.push(cur);
    left.delete(cur);
    let best: string | undefined;
    let bestS = -1;
    for (const id of ids) {
      if (!left.has(id)) continue;
      const s = between(cur, id)?.strength ?? 0;
      if (s > bestS) {
        bestS = s;
        best = id;
      }
    }
    cur = best!;
  }

  const byThought = new Map<string, ThoughtLink[]>();
  for (const l of links) {
    for (const id of [l.a, l.b]) {
      const list = byThought.get(id) ?? [];
      list.push(l);
      byThought.set(id, list);
    }
  }
  for (const list of byThought.values()) list.sort((x, y) => y.weight - x.weight);

  return { links, topicLinks, order, linksOf: (id) => byThought.get(id) ?? [], between };
}
