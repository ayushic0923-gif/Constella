import { slugify, type Kind, type Mind, type Thought, type Topic } from "../data/model";
import type { Logic, LogicKind, Reading } from "../data/lenses";
import { supabase } from "./supabase";

// Where someone's own thoughts live: this browser for guests, the database once signed in.

export interface NewThought {
  topicName: string;
  title: string;
  text: string;
  kind: Kind;
  at: string;
  tags: string[];
  source: "typed" | "voice" | "flow";
  voice?: { seconds: number; wave: number[] };
}

export interface Store {
  kind: "device" | "account";
  load(): Promise<Mind>;
  /** `read` settles once Claude has read the new thought on the server (accounts only). */
  add(input: NewThought): Promise<{ mind: Mind; id: string; read?: Promise<Mind | null> }>;
}

const KEY = "inside-one-mind.mine.v1";
const empty = (): Mind => ({ topics: [], thoughts: [] });

export const deviceStore: Store = {
  kind: "device",
  async load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (raw && Array.isArray(raw.topics) && Array.isArray(raw.thoughts)) return raw as Mind;
    } catch {
      // Storage can be blocked; start empty.
    }
    return empty();
  },
  async add(input) {
    const mind = await this.load();
    let topic = mind.topics.find((t) => t.name.toLowerCase() === input.topicName.trim().toLowerCase());
    if (!topic) {
      topic = { id: `mine-${slugify(input.topicName) || "topic"}-${Date.now().toString(36)}`, name: input.topicName.trim(), about: "", news: [], own: true };
      mind.topics.push(topic);
    }
    const id = `mine-${Date.now().toString(36)}`;
    mind.thoughts.push({
      id,
      topicId: topic.id,
      title: input.title,
      text: input.text,
      kind: input.kind,
      at: input.at,
      tags: input.tags,
      own: true,
      source: input.source,
      voice: input.voice,
    });
    try {
      localStorage.setItem(KEY, JSON.stringify(mind));
    } catch {
      // Private windows can refuse storage; the thought still shows for this visit.
    }
    return { mind, id };
  },
};

interface TopicRow {
  id: string;
  name: string;
  about: string | null;
}
interface ThoughtRow {
  id: string;
  topic_id: string;
  title: string;
  body: string;
  kind: Kind;
  tags: string[];
  happened_at: string;
  source: "typed" | "voice" | "flow" | null;
  voice: { seconds: number; wave: number[] } | null;
  /** Claude's reading, and the links it found to earlier thoughts. */
  lens: (Reading & { links?: { to: string; kind: LogicKind; why: string }[] }) | null;
}

export function accountStore(): Store {
  const db = supabase!;
  const load = async (): Promise<Mind> => {
    const [topics, thoughts] = await Promise.all([
      db.from("topics").select("id, name, about").order("created_at"),
      db.from("thoughts").select("id, topic_id, title, body, kind, tags, happened_at, source, voice, lens").order("happened_at"),
    ]);
    if (topics.error) throw topics.error;
    if (thoughts.error) throw thoughts.error;
    const rows = thoughts.data as ThoughtRow[];
    // Claude's links to earlier thoughts become the mind's logic.
    const logic: Logic = { links: [], loops: [], open: [] };
    for (const r of rows) {
      for (const l of r.lens?.links ?? []) {
        if (l.kind === "answer" || l.kind === "cause" || l.kind === "kept") logic.links.push({ kind: l.kind, a: l.to, b: r.id, why: l.why });
        else if (l.kind === "tension") logic.links.push({ kind: "tension", a: l.to, b: r.id, why: l.why });
      }
    }
    return {
      topics: (topics.data as TopicRow[]).map<Topic>((t) => ({ id: t.id, name: t.name, about: t.about ?? "", news: [], own: true })),
      thoughts: rows.map<Thought>((t) => ({
        id: t.id,
        topicId: t.topic_id,
        title: t.title,
        text: t.body,
        kind: t.kind,
        at: t.happened_at,
        tags: t.tags ?? [],
        own: true,
        source: t.source ?? "typed",
        voice: t.voice ?? undefined,
        reading: t.lens
          ? { emotion: t.lens.emotion, valence: t.lens.valence, arousal: t.lens.arousal, needs: t.lens.needs ?? [], patterns: t.lens.patterns ?? [], by: "claude" }
          : undefined,
      })),
      logic,
    };
  };
  return {
    kind: "account",
    load,
    async add(input) {
      const name = input.topicName.trim();
      let { data: topic } = await db.from("topics").select("id").eq("name", name).maybeSingle();
      if (!topic) {
        const created = await db.from("topics").insert({ name }).select("id").single();
        if (created.error) throw created.error;
        topic = created.data;
      }
      const inserted = await db
        .from("thoughts")
        .insert({
          topic_id: topic!.id,
          title: input.title,
          body: input.text,
          kind: input.kind,
          tags: input.tags,
          happened_at: input.at,
          source: input.source,
          voice: input.voice ?? null,
        })
        .select("id")
        .single();
      if (inserted.error) throw inserted.error;
      const id = inserted.data.id as string;
      // Claude reads it through every lens on the server, after the page is kept, not before.
      // Until then (or if that isn't set up) the device's rules stand in.
      const read = db.functions
        .invoke("analyze", { body: { id, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } })
        .then(({ error }) => (error ? null : load()))
        .catch(() => null);
      return { mind: await load(), id, read };
    },
  };
}
