import { tagName } from "./model";
import { NEED_NAMES, type Logic, type LogicKind } from "./lenses";
import type { World } from "../world/layout";

// A thought's closest relations, strongest reason first: what led to what, then a shared
// need (nearest in time), then shared people, places and themes. These are what the
// filaments in the galaxy reach for, and what the "Linked by" chip names.

export interface Related {
  index: number;
  /** Reads after "Linked by:", e.g. "shared need for Autonomy". */
  reason: string;
}

// How a logic link reads from either end: [seen from the earlier thought, seen from the later one].
const SAYS: Record<LogicKind, [string, string]> = {
  cause: ["what it led to", "what set it off"],
  answer: ["its answer", "the question it answers"],
  kept: ["where it was kept", "the intention it keeps"],
  tension: ["a pull the other way", "a pull the other way"],
};

export function relatedOf(world: World, logic: Logic | undefined, index: number, max = 3): Related[] {
  const node = world.thoughts[index];
  if (!node) return [];
  const t = node.thought;
  const out: Related[] = [];
  const seen = new Set([index]);
  const add = (i: number | undefined, reason: string) => {
    if (i === undefined || seen.has(i) || out.length >= max) return;
    seen.add(i);
    out.push({ index: i, reason });
  };

  for (const l of logic?.links ?? []) {
    if (l.a === t.id) add(world.thoughtById.get(l.b)?.index, SAYS[l.kind][0]);
    else if (l.b === t.id) add(world.thoughtById.get(l.a)?.index, SAYS[l.kind][1]);
  }

  const need = t.reading?.needs[0];
  if (need) {
    const at = new Date(t.at).getTime();
    world.thoughts
      .filter((o) => o.index !== index && o.thought.reading?.needs[0] === need)
      .sort((a, b) => Math.abs(new Date(a.thought.at).getTime() - at) - Math.abs(new Date(b.thought.at).getTime() - at))
      .slice(0, 2)
      .forEach((o) => add(o.index, `shared need for ${NEED_NAMES[need]}`));
  }

  for (const l of world.linksOf(index)) {
    if (l.shared[0]) add(l.a === index ? l.b : l.a, tagName(l.shared[0]));
  }
  return out;
}
