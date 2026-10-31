import type { Mind, Thought } from "./model";
import { formatDate, formatStamp, formatTime, sayTags, tagKind, tagName } from "./model";
import type { World } from "../world/layout";
import {
  EMOTION_COLOURS,
  EMOTION_NAMES,
  LOGIC_COLOURS,
  MOVES,
  NEED_COLOURS,
  NEED_NAMES,
  PATTERN_COLOURS,
  PATTERN_NAMES,
  TIME_COLOURS,
  TRAPS,
  exampleLogic,
  exampleReadings,
  readByRules,
  timeOfDay,
  type Emotion,
  type Lens,
  type Logic,
  type Need,
  type Pattern,
} from "./lenses";

// ------------------------------------------------------------------ readings on every thought

/** The example month with the author's readings and logic attached. */
export function readExample(mind: Mind): Mind {
  const readings = exampleReadings();
  return {
    ...mind,
    thoughts: mind.thoughts.map((t) => ({ ...t, reading: readings.get(t.id) ?? readByRules(t.text) })),
    logic: exampleLogic(),
  };
}

/** Someone's own mind: Claude's readings where they exist, the device's rules where not. */
export function readOwn(mind: Mind): Mind {
  return { ...mind, thoughts: mind.thoughts.map((t) => (t.reading ? t : { ...t, reading: readByRules(t.text) })) };
}

// ------------------------------------------------------------------ threads each lens draws

export interface LensLink {
  a: number;
  b: number;
  colour: string;
  strength: number;
  across: boolean;
}

function chain(world: World, groups: Map<string, number[]>, colour: (key: string) => string): LensLink[] {
  const out: LensLink[] = [];
  for (const [key, list] of groups) {
    const sorted = list.slice().sort((x, y) => world.thoughts[x].thought.at.localeCompare(world.thoughts[y].thought.at));
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      out.push({ a, b, colour: colour(key), strength: 0.7, across: world.thoughts[a].topic !== world.thoughts[b].topic });
    }
  }
  return out;
}

function group(world: World, key: (t: Thought) => string | null): Map<string, number[]> {
  const m = new Map<string, number[]>();
  world.thoughts.forEach((n) => {
    const k = key(n.thought);
    if (!k) return;
    const list = m.get(k) ?? [];
    list.push(n.index);
    m.set(k, list);
  });
  return m;
}

export function lensLinks(world: World, logic: Logic | undefined, lens: Lens): LensLink[] {
  const idx = (id: string) => world.thoughtById.get(id)?.index;
  switch (lens) {
    case "feeling":
      // A current of each feeling, running through the month in time order.
      return chain(world, group(world, (t) => t.reading?.emotion ?? null), (k) => EMOTION_COLOURS[k as Emotion]);
    case "need":
      return chain(world, group(world, (t) => t.reading?.needs[0] ?? null), (k) => NEED_COLOURS[k as Need]);
    case "thinking": {
      const out: LensLink[] = [];
      const all = [...TRAPS, ...MOVES] as Pattern[];
      for (const p of all) {
        out.push(...chain(world, group(world, (t) => (t.reading?.patterns.includes(p) ? p : null)), () => PATTERN_COLOURS[p]));
      }
      return out;
    }
    case "logic": {
      if (!logic) return [];
      const out: LensLink[] = [];
      for (const l of logic.links) {
        const a = idx(l.a);
        const b = idx(l.b);
        if (a === undefined || b === undefined) continue;
        out.push({ a, b, colour: LOGIC_COLOURS[l.kind], strength: 1, across: world.thoughts[a].topic !== world.thoughts[b].topic });
      }
      for (const loop of logic.loops) {
        const ids = loop.ids.map(idx).filter((i): i is number => i !== undefined);
        for (let i = 1; i < ids.length; i++) {
          out.push({ a: ids[i - 1], b: ids[i], colour: LOGIC_COLOURS.loop, strength: 0.8, across: world.thoughts[ids[i - 1]].topic !== world.thoughts[ids[i]].topic });
        }
      }
      return out;
    }
    case "time":
      // Each day's train of thought, in the order it happened, across topics.
      return chain(world, group(world, (t) => new Date(t.at).toDateString()), () => "#fff0d4").map((l) => ({
        ...l,
        colour: TIME_COLOURS[timeOfDay(world.thoughts[l.a].thought.at)],
      }));
    default:
      return world.links.map((l) => ({
        a: l.a,
        b: l.b,
        colour: l.across ? "#f9a3c0" : "#e6dcf0",
        strength: Math.min(1, l.weight / 5),
        across: l.across,
      }));
  }
}

/** Thoughts that take part in any piece of logic. */
export function inLogic(logic: Logic | undefined): Set<string> {
  const s = new Set<string>();
  if (!logic) return s;
  for (const l of logic.links) {
    s.add(l.a);
    s.add(l.b);
  }
  for (const l of logic.loops) l.ids.forEach((i) => s.add(i));
  for (const o of logic.open) s.add(o.id);
  return s;
}

/** Everything the logic says about one thought, for its card. */
export function logicOf(logic: Logic | undefined, id: string): { label: string; other: string; why: string; colour: string }[] {
  if (!logic) return [];
  const out: { label: string; other: string; why: string; colour: string }[] = [];
  for (const l of logic.links) {
    if (l.a === id) {
      const label = l.kind === "cause" ? "Led to" : l.kind === "answer" ? "Answered by" : l.kind === "kept" ? "Kept in" : "Pulls against";
      out.push({ label, other: l.b, why: l.why, colour: LOGIC_COLOURS[l.kind] });
    } else if (l.b === id) {
      const label = l.kind === "cause" ? "Set off by" : l.kind === "answer" ? "Answers" : l.kind === "kept" ? "Keeps" : "Pulls against";
      out.push({ label, other: l.a, why: l.why, colour: LOGIC_COLOURS[l.kind] });
    }
  }
  return out;
}

// ------------------------------------------------------------------ the insights

export interface Insight {
  id: string;
  lens: Lens;
  title: string;
  figure: string;
  line: string;
  evidence: string[];
  chart?: { kind: "hours"; values: number[]; colour: string } | { kind: "split"; parts: { label: string; value: number; colour: string }[] };
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const isHeavy = (t: Thought) => (t.reading?.valence ?? 0) < -0.15;
const isWorry = (t: Thought) => t.reading?.emotion === "worry" || ((t.reading?.valence ?? 0) <= -0.4 && (t.reading?.arousal ?? 0) >= 0.4);
const hour = (t: Thought) => new Date(t.at).getHours();
const atNight = (t: Thought) => hour(t) >= 22 || hour(t) < 3;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;

function topBy<T>(items: T[], key: (t: T) => string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) for (const k of key(it)) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function insights(mind: Mind, world: World): Insight[] {
  const ts = mind.thoughts.filter((t) => t.reading);
  if (ts.length < 3) return [];
  const out: Insight[] = [];
  const topicName = new Map(mind.topics.map((t) => [t.id, t.name]));
  const byId = new Map(ts.map((t) => [t.id, t]));
  const words = (t: Thought) => t.text.split(/\s+/).filter(Boolean).length;

  // ---------------- Feeling
  const heavy = ts.filter(isHeavy);
  const light = ts.filter((t) => (t.reading?.valence ?? 0) > 0.15);
  const emotions = topBy(ts, (t) => [t.reading!.emotion]);
  out.push({
    id: "weather",
    lens: "feeling",
    title: "The weather this month",
    figure: `${pct(heavy.length, ts.length)}%`,
    line: `of the moments weighed something down; ${pct(light.length, ts.length)}% lifted. The most common feeling was ${EMOTION_NAMES[emotions[0][0] as Emotion].toLowerCase()}, then ${EMOTION_NAMES[emotions[1][0] as Emotion].toLowerCase()}.`,
    evidence: ts.slice().sort((a, b) => a.reading!.valence - b.reading!.valence).slice(0, 3).map((t) => t.id),
    chart: { kind: "split", parts: emotions.slice(0, 6).map(([e, n]) => ({ label: EMOTION_NAMES[e as Emotion], value: n, colour: EMOTION_COLOURS[e as Emotion] })) },
  });

  const worries = ts.filter(isWorry);
  const nightWorries = worries.filter(atNight);
  const nightShare = ts.filter(atNight).length / ts.length;
  // Only when the night holds more than its share of worries.
  if (worries.length >= 3 && nightWorries.length / worries.length > nightShare + 0.05) {
    out.push({
      id: "night-worries",
      lens: "feeling",
      title: "Worries come out after dark",
      figure: `${nightWorries.length} of ${worries.length}`,
      line: `worries surfaced between 10 pm and 3 am, though only ${Math.round(nightShare * 100)}% of all thoughts did. Late hours make the same worries louder.`,
      evidence: nightWorries.slice(0, 4).map((t) => t.id),
    });
  }

  const byTopic = new Map<string, Thought[]>();
  for (const t of ts) byTopic.set(t.topicId, [...(byTopic.get(t.topicId) ?? []), t]);
  const topicMood = [...byTopic.entries()]
    .filter(([, list]) => list.length >= 3)
    .map(([id, list]) => ({ id, v: avg(list.map((t) => t.reading!.valence)), list }))
    .sort((a, b) => a.v - b.v);
  if (topicMood.length >= 2) {
    const heaviest = topicMood[0];
    const lightest = topicMood[topicMood.length - 1];
    out.push({
      id: "topic-mood",
      lens: "feeling",
      title: `Lightest: ${topicName.get(lightest.id)}. Heaviest: ${topicName.get(heaviest.id)}.`,
      figure: `${signed(lightest.v)} / ${signed(heaviest.v)}`,
      line: `On a scale from −1 (heavy) to +1 (light), ${topicName.get(lightest.id)} averages ${signed(lightest.v)} and ${topicName.get(heaviest.id)} ${signed(heaviest.v)}.`,
      evidence: [lightest.list[0].id, heaviest.list[heaviest.list.length - 1].id],
    });
  }

  const bright = ts.filter((t) => ["joy", "love", "wonder"].includes(t.reading!.emotion));
  const brightPeople = topBy(bright, (t) => t.tags.filter((g) => tagKind(g) === "person"));
  if (brightPeople.length >= 2) {
    const names = brightPeople.slice(0, 3).map(([g]) => g);
    const count = bright.filter((t) => t.tags.some((g) => names.includes(g))).length;
    out.push({
      id: "who-lifts",
      lens: "feeling",
      title: "Who lifts the light moments",
      figure: `${count} of ${bright.length}`,
      line: `moments of joy, love or wonder involve ${sayTags(names)}.`,
      evidence: bright.filter((t) => t.tags.some((g) => names.includes(g))).slice(0, 4).map((t) => t.id),
    });
  }

  const half = (a: Thought[]) => {
    const sorted = a.slice().sort((x, y) => x.at.localeCompare(y.at));
    const mid = Math.floor(sorted.length / 2);
    return [avg(sorted.slice(0, mid).map((t) => t.reading!.valence)), avg(sorted.slice(mid).map((t) => t.reading!.valence))];
  };
  const [early, late] = half(ts);
  if (ts.length >= 8 && Math.abs(late - early) >= 0.1) {
    // What the change is made of: the feeling that grew most from the first half to the second.
    const sorted = ts.slice().sort((x, y) => x.at.localeCompare(y.at));
    const mid = Math.floor(sorted.length / 2);
    const share = (list: Thought[], e: Emotion) => list.filter((t) => t.reading!.emotion === e).length / Math.max(1, list.length);
    const grew = (Object.keys(EMOTION_NAMES) as Emotion[])
      .map((e) => ({ e, d: share(sorted.slice(mid), e) - share(sorted.slice(0, mid), e) }))
      .sort((a, b) => b.d - a.d)[0];
    out.push({
      id: "drift",
      lens: "feeling",
      title: late > early ? "It got lighter" : "It got heavier",
      figure: `${signed(early)} → ${signed(late)}`,
      line: `Average feeling in the first half against the second.${grew && grew.d > 0 ? ` ${EMOTION_NAMES[grew.e]} grew the most.` : ""}`,
      evidence: sorted.slice(mid).filter((t) => t.reading!.emotion === grew?.e).slice(0, 3).map((t) => t.id),
    });
  }

  // ---------------- Need
  const needs = topBy(ts, (t) => t.reading!.needs);
  if (needs.length) {
    const [top, n] = needs[0];
    const topPeople = topBy(ts.filter((t) => t.reading!.needs.includes(top as Need)), (t) => t.tags.filter((g) => tagKind(g) === "person"))
      .slice(0, 3)
      .map(([g]) => g);
    out.push({
      id: "main-need",
      lens: "need",
      title: `${NEED_NAMES[top as Need]} sits underneath most of it`,
      figure: `${n}`,
      line: `thoughts reach for ${NEED_NAMES[top as Need].toLowerCase()}, more than ${needs
        .slice(1, 3)
        .map(([k]) => NEED_NAMES[k as Need].toLowerCase())
        .join(" or ")}.${topPeople.length ? ` ${sayTags(topPeople)} carry most of it.` : ""}`,
      evidence: ts.filter((t) => t.reading!.needs[0] === top).slice(0, 4).map((t) => t.id),
      chart: { kind: "split", parts: needs.map(([k, v]) => ({ label: NEED_NAMES[k as Need], value: v, colour: NEED_COLOURS[k as Need] })) },
    });
  }

  const tensions = mind.logic?.links.filter((l) => l.kind === "tension") ?? [];
  const tug = topBy(
    tensions.filter((l) => byId.get(l.a)?.reading && byId.get(l.b)?.reading),
    (l) => {
      const a = byId.get(l.a)!.reading!.needs[0];
      const b = byId.get(l.b)!.reading!.needs[0];
      return a && b && a !== b ? [[a, b].sort().join("|")] : [];
    },
  );
  if (tug.length) {
    const [a, b] = tug[0][0].split("|") as Need[];
    const pairs = tensions.filter((l) => {
      const x = byId.get(l.a)?.reading?.needs[0];
      const y = byId.get(l.b)?.reading?.needs[0];
      return (x === a && y === b) || (x === b && y === a);
    });
    out.push({
      id: "tug",
      lens: "need",
      title: `The tug of war: ${NEED_NAMES[a].toLowerCase()} against ${NEED_NAMES[b].toLowerCase()}`,
      figure: `${pairs.length}`,
      line: `times two thoughts pulled in opposite directions on these two needs. ${pairs[0]?.why ?? ""}.`,
      evidence: pairs.flatMap((l) => [l.a, l.b]).slice(0, 4),
    });
  }

  // ---------------- Thinking
  const traps = topBy(ts, (t) => t.reading!.patterns.filter((p) => (TRAPS as string[]).includes(p)));
  const moves = topBy(ts, (t) => t.reading!.patterns.filter((p) => (MOVES as string[]).includes(p)));
  const trapCount = traps.reduce((s, [, n]) => s + n, 0);
  const moveCount = moves.reduce((s, [, n]) => s + n, 0);
  if (traps.length) {
    const [p, n] = traps[0];
    out.push({
      id: "trap",
      lens: "thinking",
      title: `The most frequent trap: ${PATTERN_NAMES[p as Pattern].toLowerCase()}`,
      figure: `${n}×`,
      line: `${p === "rumination" ? "The same thought, replayed in new words." : p === "self-criticism" ? "Small slips, read as proof of something bigger." : "A habit of mind that shows up across topics."} Next: ${traps
        .slice(1, 3)
        .map(([k, v]) => `${PATTERN_NAMES[k as Pattern].toLowerCase()} (${v})`)
        .join(", ")}.`,
      evidence: ts.filter((t) => t.reading!.patterns.includes(p as Pattern)).slice(0, 4).map((t) => t.id),
      chart: { kind: "split", parts: traps.slice(0, 6).map(([k, v]) => ({ label: PATTERN_NAMES[k as Pattern], value: v, colour: PATTERN_COLOURS[k as Pattern] })) },
    });
  }
  if (moveCount) {
    const reframes = ts.filter((t) => t.reading!.patterns.some((p) => p === "reframe" || p === "self-compassion" || p === "acceptance"));
    out.push({
      id: "moves",
      lens: "thinking",
      title: moveCount >= trapCount * 0.8 ? "You talk yourself back up" : "The traps outnumber the way back",
      figure: `${moveCount} : ${trapCount}`,
      line: `healthy moves to traps. Reframes like “${reframes[0]?.text.split(/(?<=[.?!])\s/)[0] ?? ""}” answer the traps in their own words.`,
      evidence: reframes.slice(0, 4).map((t) => t.id),
      chart: { kind: "split", parts: moves.map(([k, v]) => ({ label: PATTERN_NAMES[k as Pattern], value: v, colour: PATTERN_COLOURS[k as Pattern] })) },
    });
  }
  const critical = topBy(ts.filter((t) => t.reading!.patterns.includes("self-criticism")), (t) => [t.topicId]);
  if (critical.length >= 2) {
    const names = critical.slice(0, 3).map(([id]) => topicName.get(id) ?? id);
    out.push({
      id: "where-critical",
      lens: "thinking",
      title: "Where self-criticism lives",
      figure: `${critical.slice(0, 3).reduce((s, [, n]) => s + n, 0)}`,
      line: `self-critical thoughts gather in ${sayTags(names.map((n) => `x:${n}`))}.`,
      evidence: ts.filter((t) => t.reading!.patterns.includes("self-criticism")).slice(0, 4).map((t) => t.id),
    });
  }

  // ---------------- Logic
  const logic = mind.logic;
  if (logic) {
    // Longest chain of one thing setting off the next.
    const next = new Map<string, string[]>();
    for (const l of logic.links) if (l.kind === "cause" || l.kind === "kept") next.set(l.a, [...(next.get(l.a) ?? []), l.b]);
    let best: string[] = [];
    const walk = (id: string, path: string[]) => {
      if (path.length > best.length) best = path;
      for (const n of next.get(id) ?? []) if (!path.includes(n)) walk(n, [...path, n]);
    };
    for (const id of next.keys()) walk(id, [id]);
    if (best.length >= 3) {
      out.push({
        id: "chain",
        lens: "logic",
        title: "A chain reaction",
        figure: `${best.length} steps`,
        line: best.map((id) => `“${byId.get(id)?.title ?? id}”`).join(" → ") + ".",
        evidence: best,
      });
    }
    const kept = logic.links.filter((l) => l.kind === "kept" && byId.has(l.a) && byId.has(l.b));
    if (kept.length) {
      const days = avg(kept.map((l) => (new Date(byId.get(l.b)!.at).getTime() - new Date(byId.get(l.a)!.at).getTime()) / 86400000));
      out.push({
        id: "kept",
        lens: "logic",
        title: "Promises kept",
        figure: `${kept.length}`,
        line: `intentions that turned into something done, ${Math.max(1, Math.round(days))} days later on average. ${kept[0].why}.`,
        evidence: kept.flatMap((l) => [l.a, l.b]).slice(0, 6),
      });
    }
    if (logic.open.length) {
      out.push({
        id: "open",
        lens: "logic",
        title: "Open loops",
        figure: `${logic.open.length}`,
        line: logic.open.map((o) => `“${byId.get(o.id)?.title ?? o.id}”: ${o.why.charAt(0).toLowerCase()}${o.why.slice(1)}`).join("; ") + ".",
        evidence: logic.open.map((o) => o.id),
      });
    }
    const questions = ts.filter((t) => t.kind === "question");
    const answered = new Set(logic.links.filter((l) => l.kind === "answer").map((l) => l.a));
    if (questions.length) {
      const got = questions.filter((q) => answered.has(q.id));
      out.push({
        id: "answers",
        lens: "logic",
        title: "Questions that found answers",
        figure: `${got.length} of ${questions.length}`,
        line: `questions asked this month were answered by a later thought${got[0] ? `, like “${got[0].title}”` : ""}. The rest are still open.`,
        evidence: logic.links.filter((l) => l.kind === "answer").flatMap((l) => [l.a, l.b]).slice(0, 6),
      });
    }
    const loops = logic.loops.slice().sort((a, b) => b.ids.length - a.ids.length);
    if (loops.length) {
      const l = loops[0];
      const first = byId.get(l.ids[0]);
      const last = byId.get(l.ids[l.ids.length - 1]);
      const span = first && last ? Math.round((new Date(last.at).getTime() - new Date(first.at).getTime()) / 86400000) : 0;
      out.push({
        id: "loop",
        lens: "logic",
        title: `The replay: ${l.name}`,
        figure: `${l.ids.length}×`,
        line: `${l.why}${span ? ` (${formatDate(first!.at)} to ${formatDate(last!.at)}, ${span} days)` : ""}. ${loops.length > 1 ? `Also replaying: ${loops.slice(1).map((x) => x.name).join(", ")}.` : ""}`,
        evidence: l.ids,
      });
    }
  }

  // ---------------- Time
  const hours = new Array(24).fill(0);
  ts.forEach((t) => hours[hour(t)]++);
  const peak = hours.indexOf(Math.max(...hours));
  out.push({
    id: "hours",
    lens: "time",
    title: "The hour of the mind",
    figure: formatTime(new Date(2026, 0, 1, peak, 0)),
    line: `is when the most thoughts arrived. ${pct(ts.filter(atNight).length, ts.length)}% came after 10 pm, ${pct(ts.filter((t) => hour(t) >= 5 && hour(t) < 10).length, ts.length)}% before 10 am.`,
    evidence: ts.filter((t) => hour(t) === peak).slice(0, 4).map((t) => t.id),
    chart: { kind: "hours", values: hours, colour: "#f9a3c0" },
  });
  const night = ts.filter(atNight);
  const morning = ts.filter((t) => hour(t) >= 5 && hour(t) < 11);
  if (night.length >= 3 && morning.length >= 3) {
    const nv = avg(night.map((t) => t.reading!.valence));
    const mv = avg(morning.map((t) => t.reading!.valence));
    out.push({
      id: "night-morning",
      lens: "time",
      title: nv < mv ? "Mornings are kinder than nights" : "Nights are kinder than mornings",
      figure: `${signed(mv)} / ${signed(nv)}`,
      line: `average feeling before 11 am against after 10 pm. The same mind, a different light.`,
      evidence: [...morning.slice(0, 2), ...night.slice(0, 2)].map((t) => t.id),
    });
  }
  const byDay = topBy(ts, (t) => [new Date(t.at).toDateString()]);
  if (byDay.length) {
    const [day, n] = byDay[0];
    const list = ts.filter((t) => new Date(t.at).toDateString() === day).sort((a, b) => a.at.localeCompare(b.at));
    out.push({
      id: "busiest",
      lens: "time",
      title: `The fullest day: ${formatDate(list[0].at)}`,
      figure: `${n}`,
      line: `thoughts in one day, from “${list[0].title}” at ${formatTime(list[0].at)} to “${list[list.length - 1].title}” at ${formatTime(list[list.length - 1].at)}.`,
      evidence: list.map((t) => t.id).slice(0, 6),
    });
  }

  // ---------------- What (the network)
  const peopleTopics = new Map<string, Set<string>>();
  for (const t of ts) for (const g of t.tags) if (tagKind(g) === "person") peopleTopics.set(g, new Set([...(peopleTopics.get(g) ?? []), t.topicId]));
  const bridge = [...peopleTopics.entries()].sort((a, b) => b[1].size - a[1].size)[0];
  if (bridge && bridge[1].size >= 2) {
    out.push({
      id: "bridge",
      lens: "what",
      title: `${tagName(bridge[0])} is the bridge`,
      figure: `${bridge[1].size}`,
      line: `topics meet through ${tagName(bridge[0])}: ${[...bridge[1]].map((id) => topicName.get(id)).join(", ")}.`,
      evidence: ts.filter((t) => t.tags.includes(bridge[0])).slice(0, 5).map((t) => t.id),
    });
  }
  const degree = new Map<number, number>();
  for (const l of world.links) {
    degree.set(l.a, (degree.get(l.a) ?? 0) + 1);
    degree.set(l.b, (degree.get(l.b) ?? 0) + 1);
  }
  const hub = [...degree.entries()].sort((a, b) => b[1] - a[1])[0];
  if (hub) {
    const node = world.thoughts[hub[0]];
    out.push({
      id: "hub",
      lens: "what",
      title: `The most connected thought: “${node.thought.title}”`,
      figure: `${hub[1]}`,
      line: `threads meet here, from ${formatStamp(node.thought.at)}. More of the rest connects through it than through any other thought.`,
      evidence: [node.thought.id, ...world.linksOf(hub[0]).slice(0, 3).map((l) => world.thoughts[l.a === hub[0] ? l.b : l.a].thought.id)],
    });
  }
  const linkCount = new Map<number, number>();
  world.topicLinks.forEach((l) => {
    linkCount.set(l.a, (linkCount.get(l.a) ?? 0) + l.strength);
    linkCount.set(l.b, (linkCount.get(l.b) ?? 0) + l.strength);
  });
  const island = world.topics.slice().sort((a, b) => (linkCount.get(a.index) ?? 0) - (linkCount.get(b.index) ?? 0))[0];
  if (island && world.topics.length > 3) {
    out.push({
      id: "island",
      lens: "what",
      title: `The island: ${island.topic.name}`,
      figure: `${(linkCount.get(island.index) ?? 0).toFixed(1)}`,
      line: `total connection strength to every other topic, the lowest of all. It lives on its own, which can mean refuge or avoidance.`,
      evidence: island.thoughts.slice(0, 3).map((i) => world.thoughts[i].thought.id),
    });
  }

  // ---------------- Voice (only with real spoken entries)
  const spoken = mind.thoughts.filter((t) => t.source === "voice" || t.source === "flow");
  const typed = mind.thoughts.filter((t) => !t.source || t.source === "typed");
  if (spoken.length >= 2 && typed.length >= 2) {
    const sw = avg(spoken.map(words));
    const tw = avg(typed.map(words));
    out.push({
      id: "voice",
      lens: "feeling",
      title: "Spoken thoughts say more",
      figure: `${(sw / Math.max(1, tw)).toFixed(1)}×`,
      line: `the words of typed ones on average (${Math.round(sw)} against ${Math.round(tw)}).`,
      evidence: spoken.slice(0, 3).map((t) => t.id),
    });
  }

  return out;
}
