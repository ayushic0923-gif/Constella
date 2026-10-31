import { tagName, type Mind, type Thought } from "./model";
import { EMOTION_NAMES, NEED_NAMES, PATTERN_NAMES, type Emotion, type Lens, type Need, type Pattern } from "./lenses";

// The Three Mirrors: the Patterns drawer's answer to three questions, worked out from the readings.
//   1. What was my mind running in the background?   The Invisible Thread
//   2. What drained me, and what gave me life?         The Energy Audit (the drain, the lift)
//   3. What should I release, and what should I keep?  The Gentle Shift (release, incubate)
// Every sentence is built from the thoughts themselves, and every mirror lists the thoughts behind it.

export type MirrorKind = "thread" | "drain" | "lift" | "release" | "incubate";

export const MIRROR_COLOURS: Record<MirrorKind, string> = {
  thread: "#a8c6ff",
  drain: "#ff8a5b",
  lift: "#8fe3cf",
  release: "#ff8a5b",
  incubate: "#ffd27a",
};

export interface Mirror {
  id: MirrorKind;
  /** The lens that shows this mirror best in the galaxy, for when a thought behind it is opened. */
  lens: Lens;
  title: string;
  body: string;
  evidence: string[];
}

/** Before the mirrors appear: how far along, and a first reading of what's there. */
export interface Forming {
  count: number;
  needed: number;
  tone: Emotion | null;
  need: Need | null;
}

export const MIRRORS_NEED = 5;

const LOOP_TRAPS: Pattern[] = ["catastrophising", "should", "comparison", "rumination", "all-or-nothing", "self-criticism"];
const hourOf = (t: Thought) => new Date(t.at).getHours();
const atNight = (t: Thought) => hourOf(t) >= 22 || hourOf(t) < 3;
const valence = (t: Thought) => t.reading?.valence ?? 0;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const times = (n: number) => (n === 2 ? "twice" : `${n} times`);

/** The most frequent value, and how often it appears. */
function most<T>(xs: T[]): [T, number] | null {
  const counts = new Map<T, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best: [T, number] | null = null;
  for (const [k, n] of counts) if (!best || n > best[1]) best = [k, n];
  return best;
}

/** Readings so far, until there are enough for the mirrors. Null once there are. */
export function forming(mind: Mind): Forming | null {
  const read = mind.thoughts.filter((t) => t.reading);
  if (read.length >= MIRRORS_NEED) return null;
  return {
    count: read.length,
    needed: MIRRORS_NEED,
    tone: most(read.map((t) => t.reading!.emotion))?.[0] ?? null,
    need: most(read.flatMap((t) => t.reading!.needs.slice(0, 1)))?.[0] ?? null,
  };
}

export function mirrors(mind: Mind): Mirror[] {
  const ts = mind.thoughts.filter((t) => t.reading).sort((a, b) => a.at.localeCompare(b.at));
  if (ts.length < MIRRORS_NEED) return [];
  const topicName = new Map(mind.topics.map((t) => [t.id, t.name]));
  const out: Mirror[] = [];

  // ---------------- 1. The Invisible Thread: one theme under the last few entries
  const recent = ts.slice(-10);
  const keys = recent.flatMap((t) => [...new Set([...t.tags, ...t.reading!.needs.map((n) => `need:${n}`)])]);
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  // People, places and themes say more than a need, so they win a tie.
  const key = [...counts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1] || Number(a[0].startsWith("need:")) - Number(b[0].startsWith("need:")))[0]?.[0];
  if (key) {
    const isNeed = key.startsWith("need:");
    const cluster = recent.filter((t) => (isNeed ? t.reading!.needs.includes(key.slice(5) as Need) : t.tags.includes(key)));
    const need = (isNeed ? (key.slice(5) as Need) : most(cluster.flatMap((t) => t.reading!.needs.slice(0, 1)))?.[0]) ?? null;
    const topics = [...new Set(cluster.map((t) => topicName.get(t.topicId) ?? ""))].filter(Boolean);
    const surface =
      topics.length > 2
        ? `${topics[0]}, ${topics[1]} and ${topics.length - 2} other ${topics.length - 2 === 1 ? "topic" : "topics"}`
        : topics.length === 2
          ? `${topics[0]} and ${topics[1]}`
          : (topics[0] ?? "different things");
    const sharing = need ? cluster.filter((t) => t.reading!.needs.includes(need)).length : 0;
    const theme = isNeed ? NEED_NAMES[key.slice(5) as Need] : tagName(key);
    out.push({
      id: "thread",
      lens: "need",
      title: `The Invisible Thread: ${theme}`,
      body: need
        ? `On the surface, these entries were about ${surface}. Beneath the surface, ${sharing === cluster.length ? "all of them carry" : `${sharing} of the ${cluster.length} carry`} a quiet need for ${NEED_NAMES[need].toLowerCase()}.`
        : `On the surface, these entries were about ${surface}. ${theme} runs through ${cluster.length} of your last ${recent.length}.`,
      evidence: cluster.slice(-5).map((t) => t.id),
    });
  }

  // ---------------- 2a. The drain: heavy thoughts running on a thinking trap
  const loopers = ts.filter((t) => valence(t) < 0 && t.reading!.patterns.some((p) => LOOP_TRAPS.includes(p)));
  if (loopers.length >= 2) {
    const night = loopers.filter(atNight);
    const pool = night.length >= 2 ? night : loopers;
    const trap = most(pool.flatMap((t) => t.reading!.patterns.filter((p) => LOOP_TRAPS.includes(p))))![0];
    const trapName = PATTERN_NAMES[trap].replace(/[“”]/g, "").toLowerCase();
    out.push(
      night.length >= 2
        ? {
            id: "drain",
            lens: "thinking",
            title: "The Loop to Release: Midnight Spiralling",
            body: `${night.length} heavy thoughts after 10 pm ran on ${trapName}. Night-time thoughts are tired thoughts: label them as chemistry, not truth.`,
            evidence: night.slice(-4).map((t) => t.id),
          }
        : {
            id: "drain",
            lens: "thinking",
            title: `The Loop to Release: ${PATTERN_NAMES[trap].replace(/[“”]/g, "")}`,
            body: `${loopers.length} heavy thoughts ran on ${trapName}. Noticing the pattern is the first step out of it.`,
            evidence: loopers.slice(-4).map((t) => t.id),
          },
    );
  }

  // ---------------- 2b. The lift: what raised the mood
  const lifts = ts.filter((t, i) => {
    const r = t.reading!;
    const jump = i > 0 && valence(t) - valence(ts[i - 1]) > 0.3;
    return r.valence > 0.3 || jump || r.emotion === "wonder" || r.emotion === "calm" || t.tags.includes("theme:innovation");
  });
  if (lifts.length >= 2) {
    const [topicId] = most(lifts.map((t) => t.topicId))!;
    const where = topicName.get(topicId) ?? "it";
    const creative = lifts.filter((t) => t.kind === "idea" || t.reading!.emotion === "wonder").length * 3 >= lifts.length;
    const raised = avg(lifts.map(valence)) - avg(ts.map(valence)) >= 0.3;
    const [emotion] = most(lifts.map((t) => t.reading!.emotion))!;
    out.push({
      id: "lift",
      lens: "feeling",
      title: `The Energy Lift: ${creative ? "Creative Flow" : where}`,
      body: `Your mood lifted${raised ? " noticeably" : ""} when you wrote about ${where}. ${
        creative ? "Novelty and creative action seem to energise you." : `${EMOTION_NAMES[emotion]} showed up most in those moments.`
      }`,
      evidence: [...lifts.filter((t) => t.topicId === topicId).reverse(), ...lifts.filter((t) => t.topicId !== topicId).reverse()].slice(0, 4).map((t) => t.id),
    });
  }

  // ---------------- 3a. Release: a concern circled again and again
  const loop = (mind.logic?.loops ?? []).slice().sort((a, b) => b.ids.length - a.ids.length)[0];
  if (loop && loop.ids.length >= 2) {
    out.push({
      id: "release",
      lens: "logic",
      title: `The Gentle Shift: Release “${loop.name}”`,
      body: `You've circled around ${loop.name.toLowerCase()} ${times(loop.ids.length)}. If there's nothing you can act on right now, gently set this thought down.`,
      evidence: loop.ids.slice(-4),
    });
  } else {
    const circling = ts.filter((t) => t.reading!.patterns.includes("rumination"));
    const top = most(circling.map((t) => t.topicId));
    if (top && top[1] >= 2) {
      const name = topicName.get(top[0]) ?? "one thing";
      out.push({
        id: "release",
        lens: "thinking",
        title: `The Gentle Shift: Release “${name}”`,
        body: `You've circled around ${name} ${times(top[1])}. If there's nothing you can act on right now, gently set this thought down.`,
        evidence: circling.filter((t) => t.topicId === top[0]).slice(-4).map((t) => t.id),
      });
    }
  }

  // ---------------- 3b. Incubate: the latest idea not yet acted on
  const kept = new Set((mind.logic?.links ?? []).filter((l) => l.kind === "kept").map((l) => l.a));
  const idea = ts.filter((t) => t.kind === "idea" && !kept.has(t.id)).pop();
  if (idea) {
    out.push({
      id: "incubate",
      lens: "what",
      title: `The Gentle Shift: Keep “${idea.title}”`,
      body: `You logged “${idea.title}”. It has creative momentum: consider scheduling 15 minutes to sketch the first step.`,
      evidence: [idea.id],
    });
  }

  return out;
}
