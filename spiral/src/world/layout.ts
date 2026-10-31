import * as THREE from "three";
import type { Connections } from "../data/connect";
import type { Mind, Tag, Thought, Topic } from "../data/model";

// Topics lie along one spiral arm in journey order, from just outside the bright
// core outward. Each topic's thoughts sit on a ring around it and open out as
// you arrive. The rest of the galaxy is built from the same spiral.

export const DISC_RADIUS = 9500;
export const ARM_START_R = 900;
export const ARM_END_R = 8200;
export const TOPIC_STEP = 1300; // world units between topics along the arm

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rand: () => number): number {
  const u = Math.max(1e-7, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export interface Spiral {
  wind: number;
  angle(r: number, arm: number): number;
  tangent(theta: number): number;
}

/** The galaxy's spiral. Fixed, so the sky looks the same whatever is in it. */
export function makeSpiral(): Spiral {
  const sinPitch = 0.234;
  const wind = Math.sqrt(1 - sinPitch * sinPitch) / sinPitch;
  return {
    wind,
    angle: (r, arm) => arm * Math.PI + Math.log(Math.max(r, 1) / ARM_START_R) * wind,
    tangent: (theta) =>
      Math.atan2(Math.sin(theta) + wind * Math.cos(theta), Math.cos(theta) - wind * Math.sin(theta)),
  };
}

export interface TopicNode {
  topic: Topic;
  index: number;
  pos: THREE.Vector3;
  /** The way the journey runs through this topic, and the frame its ring sits in. */
  fwd: THREE.Vector3;
  side: THREE.Vector3;
  up: THREE.Vector3;
  thoughts: number[];
  first: string;
  last: string;
  /** What this topic is mostly about, from its thoughts' tags. */
  tags: Tag[];
}

export interface ThoughtNode {
  thought: Thought;
  index: number;
  topic: number;
  rest: THREE.Vector3;
}

export interface WorldLink {
  a: number;
  b: number;
  shared: Tag[];
  weight: number;
  across: boolean;
}

export interface WorldTopicLink {
  a: number;
  b: number;
  shared: Tag[];
  strength: number;
  pair: [number, number];
}

export interface World {
  spiral: Spiral;
  topics: TopicNode[];
  thoughts: ThoughtNode[];
  topicById: Map<string, TopicNode>;
  thoughtById: Map<string, ThoughtNode>;
  links: WorldLink[];
  topicLinks: WorldTopicLink[];
  /** Links of one thought, strongest first. */
  linksOf: (thought: number) => WorldLink[];
  between: (a: number, b: number) => WorldTopicLink | undefined;
}

const UP = new THREE.Vector3(0, 0, 1);

export function buildWorld(mind: Mind, conn: Connections, spiral: Spiral): World {
  const rand = mulberry32(42);
  const sinPitch = 1 / Math.sqrt(1 + spiral.wind * spiral.wind);
  const topicsById = new Map(mind.topics.map((t) => [t.id, t]));
  const ordered = conn.order.map((id) => topicsById.get(id)!).filter(Boolean);
  const n = ordered.length;
  // Fewer topics spread out further, so a small mind still travels.
  const step = n > 1 ? Math.min(TOPIC_STEP * 2.2, ((ARM_END_R - ARM_START_R) / sinPitch) / (n - 1)) : TOPIC_STEP;

  const centres = ordered.map((_, i) => {
    const s = i * Math.min(step, TOPIC_STEP * 1.6);
    const r = ARM_START_R + s * sinPitch;
    const theta = spiral.angle(r, 0);
    const tan = spiral.tangent(theta);
    const lateral = (rand() - 0.5) * 300;
    return new THREE.Vector3(
      Math.cos(theta) * r + Math.cos(tan + Math.PI / 2) * lateral,
      Math.sin(theta) * r + Math.sin(tan + Math.PI / 2) * lateral,
      (rand() - 0.5) * 140,
    );
  });

  const byTopic = new Map<string, Thought[]>();
  for (const t of mind.thoughts) {
    const list = byTopic.get(t.topicId) ?? [];
    list.push(t);
    byTopic.set(t.topicId, list);
  }

  const topics: TopicNode[] = [];
  const thoughts: ThoughtNode[] = [];
  ordered.forEach((topic, i) => {
    const pos = centres[i];
    const prev = centres[Math.max(0, i - 1)];
    const next = centres[Math.min(n - 1, i + 1)];
    const fwd = next.clone().sub(prev);
    if (fwd.lengthSq() < 1) fwd.set(Math.cos(i), Math.sin(i), 0);
    fwd.z *= 0.3;
    fwd.normalize();
    const side = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    const up = new THREE.Vector3().crossVectors(side, fwd).normalize();

    const own = (byTopic.get(topic.id) ?? []).slice().sort((a, b) => a.at.localeCompare(b.at));
    const node: TopicNode = {
      topic,
      index: i,
      pos,
      fwd,
      side,
      up,
      thoughts: [],
      first: own[0]?.at ?? new Date().toISOString(),
      last: own[own.length - 1]?.at ?? new Date().toISOString(),
      tags: topTags(own),
    };
    // A ring around the topic, wider than tall, like the screen it opens onto.
    const count = own.length;
    const offset = -Math.PI / 2 + Math.PI / Math.max(2, count) + 0.35;
    own.forEach((t, k) => {
      const inner = count > 10 && k % 2 === 1;
      const a = offset + (k / count) * Math.PI * 2 + (rand() - 0.5) * 0.12;
      const r = (inner ? 0.62 : 1) * (1 + (rand() - 0.5) * 0.12);
      const rest = pos
        .clone()
        .addScaledVector(side, Math.cos(a) * 225 * r)
        .addScaledVector(up, Math.sin(a) * 150 * r)
        .addScaledVector(fwd, (rand() - 0.5) * 70);
      node.thoughts.push(thoughts.length);
      thoughts.push({ thought: t, index: thoughts.length, topic: i, rest });
    });
    topics.push(node);
  });

  const topicById = new Map(topics.map((t) => [t.topic.id, t]));
  const thoughtById = new Map(thoughts.map((t) => [t.thought.id, t]));
  const links: WorldLink[] = conn.links.flatMap((l) => {
    const a = thoughtById.get(l.a);
    const b = thoughtById.get(l.b);
    return a && b ? [{ a: a.index, b: b.index, shared: l.shared, weight: l.weight, across: l.across }] : [];
  });
  const topicLinks: WorldTopicLink[] = conn.topicLinks.flatMap((l) => {
    const a = topicById.get(l.a);
    const b = topicById.get(l.b);
    const pa = thoughtById.get(l.pair[0]);
    const pb = thoughtById.get(l.pair[1]);
    return a && b && pa && pb ? [{ a: a.index, b: b.index, shared: l.shared, strength: l.strength, pair: [pa.index, pb.index] as [number, number] }] : [];
  });

  const byThought = new Map<number, WorldLink[]>();
  for (const l of links) {
    for (const i of [l.a, l.b]) {
      const list = byThought.get(i) ?? [];
      list.push(l);
      byThought.set(i, list);
    }
  }
  for (const list of byThought.values()) list.sort((x, y) => y.weight - x.weight);

  return {
    spiral,
    topics,
    thoughts,
    topicById,
    thoughtById,
    links,
    topicLinks,
    linksOf: (i) => byThought.get(i) ?? [],
    between: (a, b) => topicLinks.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a)),
  };
}

function topTags(thoughts: Thought[]): Tag[] {
  const counts = new Map<Tag, number>();
  for (const t of thoughts) for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

/** How far a topic's ring has opened, given where the journey is. Mirrors the shaders. */
export function openness(topic: number, p: number, overview: number): number {
  const d = Math.abs(topic - p);
  const t = Math.min(1, Math.max(0, (d - 0.25) / 0.6));
  const o = 1 - t * t * (3 - 2 * t);
  return o + (1 - o) * overview;
}

/** Where a thought sits while its ring opens. Mirrors the shaders. */
export function openPosition(node: ThoughtNode, centre: THREE.Vector3, open: number, out: THREE.Vector3): THREE.Vector3 {
  const e = 1 - Math.pow(1 - open, 3);
  return out.copy(centre).lerp(node.rest, e);
}
