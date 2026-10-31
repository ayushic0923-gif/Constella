import type { Kind } from "../data/model";

// The sky follows the day: warm at dawn, clear by day, amber at dusk, deep blue at night.
// Tints are linear multipliers applied before tone mapping.

interface Key {
  at: number; // minutes since midnight
  tint: [number, number, number];
  exposure: number;
}

const KEYS: Key[] = [
  { at: 6 * 60 + 30, tint: [1.12, 0.96, 0.86], exposure: 1.0 },
  { at: 9 * 60, tint: [1.0, 1.0, 1.02], exposure: 1.1 },
  { at: 16 * 60 + 30, tint: [1.02, 0.99, 0.98], exposure: 1.06 },
  { at: 18 * 60, tint: [1.14, 0.92, 0.9], exposure: 0.98 },
  { at: 20 * 60 + 15, tint: [0.9, 0.95, 1.12], exposure: 0.86 },
  { at: 24 * 60, tint: [0.82, 0.9, 1.16], exposure: 0.74 },
];

export function gradeAt(minutes: number): Key {
  const t = Math.min(KEYS[KEYS.length - 1].at, Math.max(KEYS[0].at, minutes));
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].at) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const k = (t - a.at) / (b.at - a.at);
  const s = k * k * (3 - 2 * k);
  const mix3 = (x: number[], y: number[]) => x.map((v, j) => v + (y[j] - v) * s) as [number, number, number];
  return { at: t, tint: mix3(a.tint, b.tint), exposure: a.exposure + (b.exposure - a.exposure) * s };
}

/** Each kind of thought shines in its own light, taken from real starlight and gas. */
export const KIND_COLOURS: Record<Kind, string> = {
  noticed: "#f4f1ea", // sunlike white
  memory: "#ffcb83", // an old, warm star
  worry: "#ff8a5b", // a red giant
  plan: "#a8c6ff", // a hot blue star
  feeling: "#ff9cbc", // hydrogen pink
  idea: "#79e2d3", // oxygen teal
  question: "#fff0b3", // pale yellow
};
