import { READINGS, LOGIC } from "./readings";
import { tagKind, tagName, type Thought } from "./model";

// The lenses: ways of reading the same thoughts. See README, "Connection framework".

export type Lens = "what" | "feeling" | "need" | "thinking" | "logic" | "time";

export const LENSES: { id: Lens; name: string; question: string }[] = [
  { id: "what", name: "What", question: "Who and what they share" },
  { id: "feeling", name: "Feeling", question: "How they feel" },
  { id: "need", name: "Need", question: "What they're reaching for" },
  { id: "thinking", name: "Thinking", question: "How the mind moves" },
  { id: "logic", name: "Logic", question: "What led to what" },
  { id: "time", name: "Time", question: "When they surface" },
];

export type Emotion = "joy" | "love" | "hope" | "calm" | "wonder" | "worry" | "sadness" | "guilt" | "irritation";
export type Need = "security" | "belonging" | "competence" | "autonomy" | "meaning" | "rest";
export type Trap =
  | "catastrophising"
  | "should"
  | "comparison"
  | "mind-reading"
  | "all-or-nothing"
  | "rumination"
  | "avoidance"
  | "self-criticism"
  | "fortune-telling";
export type Move = "reframe" | "self-compassion" | "gratitude" | "acceptance" | "action";
export type Pattern = Trap | Move;

export const TRAPS: Trap[] = ["catastrophising", "should", "comparison", "mind-reading", "all-or-nothing", "rumination", "avoidance", "self-criticism", "fortune-telling"];
export const MOVES: Move[] = ["reframe", "self-compassion", "gratitude", "acceptance", "action"];

export interface Reading {
  emotion: Emotion;
  /** -1 heavy … 1 light */
  valence: number;
  /** 0 calm … 1 charged */
  arousal: number;
  needs: Need[];
  patterns: Pattern[];
  /** Who read it: the author of the example, Claude, or the on-device rules. */
  by: "author" | "claude" | "rules";
}

export type LogicKind = "cause" | "answer" | "kept" | "tension";
export interface LogicLink {
  kind: LogicKind;
  a: string;
  b: string;
  why: string;
}
export interface Loop {
  name: string;
  ids: string[];
  why: string;
}
export interface Logic {
  links: LogicLink[];
  loops: Loop[];
  open: { id: string; why: string }[];
}

// ------------------------------------------------------------------ names and colours

export const EMOTION_NAMES: Record<Emotion, string> = {
  joy: "Joy",
  love: "Love",
  hope: "Hope",
  calm: "Calm",
  wonder: "Wonder",
  worry: "Worry",
  sadness: "Sadness",
  guilt: "Guilt",
  irritation: "Irritation",
};
export const EMOTION_COLOURS: Record<Emotion, string> = {
  joy: "#ffd27a",
  love: "#ff9fbf",
  hope: "#a8c6ff",
  calm: "#8fe3cf",
  wonder: "#cbb9ff",
  worry: "#ff8a5b",
  sadness: "#7f93d6",
  guilt: "#d58fb4",
  irritation: "#ff5f5f",
};

export const NEED_NAMES: Record<Need, string> = {
  security: "Security",
  belonging: "Belonging",
  competence: "Competence",
  autonomy: "Autonomy",
  meaning: "Meaning",
  rest: "Rest",
};
export const NEED_COLOURS: Record<Need, string> = {
  security: "#ffcb83",
  belonging: "#ff9fbf",
  competence: "#a8c6ff",
  autonomy: "#79e2d3",
  meaning: "#cbb9ff",
  rest: "#9fdc8f",
};

export const PATTERN_NAMES: Record<Pattern, string> = {
  catastrophising: "Catastrophising",
  should: "“Should”",
  comparison: "Comparison",
  "mind-reading": "Mind-reading",
  "all-or-nothing": "All-or-nothing",
  rumination: "Rumination",
  avoidance: "Avoidance",
  "self-criticism": "Self-criticism",
  "fortune-telling": "Fortune-telling",
  reframe: "Reframe",
  "self-compassion": "Self-compassion",
  gratitude: "Gratitude",
  acceptance: "Acceptance",
  action: "Action",
};
export const PATTERN_COLOURS: Record<Pattern, string> = {
  catastrophising: "#ff5f5f",
  should: "#ff8a5b",
  comparison: "#ffb36b",
  "mind-reading": "#ffcb83",
  "all-or-nothing": "#ff7aa0",
  rumination: "#d58fb4",
  avoidance: "#b98fd8",
  "self-criticism": "#ff9fbf",
  "fortune-telling": "#ffa07a",
  reframe: "#79e2d3",
  "self-compassion": "#8fe3cf",
  gratitude: "#9fdc8f",
  acceptance: "#a8c6ff",
  action: "#cbe8ff",
};

export const LOGIC_NAMES: Record<LogicKind | "loop", string> = {
  cause: "Led to",
  answer: "Answered by",
  kept: "Kept in",
  tension: "Pulls against",
  loop: "Replays",
};
export const LOGIC_COLOURS: Record<LogicKind | "loop", string> = {
  cause: "#ffb36b",
  answer: "#a8c6ff",
  kept: "#79e2d3",
  tension: "#ff5f7e",
  loop: "#cbb9ff",
};

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export const TIME_NAMES: Record<TimeOfDay, string> = {
  morning: "Morning (5–12)",
  afternoon: "Afternoon (12–18)",
  evening: "Evening (18–22)",
  night: "Night (22–5)",
};
export const TIME_COLOURS: Record<TimeOfDay, string> = {
  morning: "#ffd27a",
  afternoon: "#f4f1ea",
  evening: "#ff9fbf",
  night: "#7f93d6",
};

export function timeOfDay(iso: string): TimeOfDay {
  const h = new Date(iso).getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  if (h >= 18 && h < 22) return "evening";
  return "night";
}

export const DIM = "#4c4f66";

// ------------------------------------------------------------------ the example month's readings

export function exampleReadings(): Map<string, Reading> {
  const out = new Map<string, Reading>();
  for (const line of READINGS.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const [id, feel, needs, patterns] = l.split("|").map((s) => s.trim());
    const [emotion, v, a] = feel.split(/\s+/);
    out.set(id, {
      emotion: emotion as Emotion,
      valence: Number(v),
      arousal: Number(a),
      needs: needs === "-" ? [] : (needs.split(/\s+/) as Need[]),
      patterns: patterns === "-" ? [] : (patterns.split(/\s+/) as Pattern[]),
      by: "author",
    });
  }
  return out;
}

export function exampleLogic(): Logic {
  const logic: Logic = { links: [], loops: [], open: [] };
  for (const line of LOGIC.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const [head, ...rest] = l.split("|").map((s) => s.trim());
    const kind = head.split(/\s+/)[0];
    const body = head.slice(kind.length).trim();
    if (kind === "loop") {
      logic.loops.push({ name: body, ids: rest[0].split(",").map((s) => s.trim()), why: rest[1] ?? "" });
    } else if (kind === "open") {
      logic.open.push({ id: body, why: rest[0] ?? "" });
    } else {
      const [a, b] = body.split(/\s*<?>\s*/);
      logic.links.push({ kind: kind as LogicKind, a: a.trim(), b: b.trim(), why: rest[0] ?? "" });
    }
  }
  return logic;
}

// ------------------------------------------------------------------ rules, for people's own thoughts without Claude

const FEELINGS: [Emotion, number, number, RegExp][] = [
  ["worry", -0.6, 0.6, /\b(worr|anxious|scared|afraid|panic|what if|deadline|stress|nervous|can'?t sleep|layoff)/i],
  ["sadness", -0.6, 0.3, /\b(miss|lonely|alone|sad|cried|cry|gone|grief|lost|far away|empty)/i],
  ["guilt", -0.4, 0.3, /\b(guilt|sorry|should have|again\b|failed|lazy|wasted|ashamed)/i],
  ["irritation", -0.5, 0.6, /\b(annoy|angry|irritat|hate|ugh|broken|refus|late again|why does)/i],
  ["love", 0.6, 0.4, /\b(love|hug|grateful for|my (mom|mum|dad|sister|brother|friend)|together|laughed)/i],
  ["joy", 0.7, 0.6, /\b(happy|proud|finally|great|best|won|laugh|excited|yay|did it)/i],
  ["hope", 0.5, 0.5, /\b(hope|plan|will|going to|someday|maybe i|idea|could)/i],
  ["calm", 0.5, 0.2, /\b(calm|quiet|peace|slow|breathe|rest|enough|okay)/i],
  ["wonder", 0.7, 0.4, /\b(stars?|sky|ocean|sea|mountain|beautiful|wonder|sunset|rain)/i],
];

const NEEDS: [Need, RegExp][] = [
  ["security", /\b(money|rent|salary|budget|job|layoff|savings|price|₹|\$|bill|loan|safe)/i],
  ["belonging", /\b(mom|mum|dad|friend|family|sister|brother|together|lonely|miss|call|team|partner)/i],
  ["competence", /\b(work|skill|learn|better|faster|fail|good at|project|presentation|exam|practice)/i],
  ["autonomy", /\b(choose|decide|my own|freedom|control|should i|allowed|on my terms)/i],
  ["meaning", /\b(why|matter|purpose|care about|meaning|future|someday|dream)/i],
  ["rest", /\b(sleep|tired|rest|bed|exhaust|break|weekend|phone|screen|run|body|back pain)/i],
];

const PATTERNS: [Pattern, RegExp][] = [
  ["catastrophising", /\b(what if|ruined|disaster|never recover|worst)/i],
  ["should", /\b(should|must|have to|supposed to)\b/i],
  ["comparison", /\b(everyone|other people|they all|better than me|used to)/i],
  ["mind-reading", /\b(they think|she thinks|he thinks|probably thinks|judg)/i],
  ["all-or-nothing", /\b(always|never|nothing|everything|ruined)\b/i],
  ["self-criticism", /\b(i'?m (so )?(bad|lazy|stupid|useless)|hypocrite|i failed)/i],
  ["avoidance", /\b(later|tomorrow|skip|avoid|put off|haven'?t (yet|played|called))/i],
  ["reframe", /\b(but (maybe|actually)|not .* just|it'?s okay|at least)/i],
  ["self-compassion", /\b(still counts|good enough|be kind|allowed to)/i],
  ["gratitude", /\b(grateful|thankful|lucky)/i],
  ["action", /\b(booked|did it|finished|sent|called|wrote|started)/i],
];

/** A first reading of someone's own thought, made on the device. Claude replaces it when connected. */
export function readByRules(text: string): Reading {
  const hit = FEELINGS.find(([, , , re]) => re.test(text));
  const [emotion, valence, arousal] = hit ?? (["calm", 0.1, 0.3] as [Emotion, number, number]);
  const needs = NEEDS.filter(([, re]) => re.test(text)).map(([n]) => n).slice(0, 2);
  const patterns = PATTERNS.filter(([, re]) => re.test(text)).map(([p]) => p).slice(0, 2);
  return { emotion, valence, arousal, needs: needs.length ? needs : ["meaning"], patterns, by: "rules" };
}

/** The thought's main colour under a lens. */
export function lensColour(lens: Lens, t: Thought, inLogic: boolean, kindColour: string): string {
  const r = t.reading;
  switch (lens) {
    case "feeling":
      return r ? EMOTION_COLOURS[r.emotion] : DIM;
    case "need":
      return r?.needs[0] ? NEED_COLOURS[r.needs[0]] : DIM;
    case "thinking":
      return r?.patterns[0] ? PATTERN_COLOURS[r.patterns[0]] : DIM;
    case "logic":
      return inLogic ? "#fff0d4" : DIM;
    case "time":
      return TIME_COLOURS[timeOfDay(t.at)];
    default:
      return kindColour;
  }
}

/** A short line saying what the lens sees in one thought. */
export function lensLine(lens: Lens, t: Thought): string | null {
  const r = t.reading;
  if (lens === "feeling" && r) return `${EMOTION_NAMES[r.emotion]}${r.arousal > 0.55 ? ", charged" : r.arousal < 0.25 ? ", quiet" : ""}`;
  if (lens === "need" && r?.needs.length) return r.needs.map((n) => NEED_NAMES[n]).join(" · ");
  if (lens === "thinking" && r?.patterns.length) return r.patterns.map((p) => PATTERN_NAMES[p]).join(" · ");
  if (lens === "time") return TIME_NAMES[timeOfDay(t.at)].replace(/ \(.*\)/, "");
  return null;
}

export function people(t: Thought): string[] {
  return t.tags.filter((g) => tagKind(g) === "person").map(tagName);
}
