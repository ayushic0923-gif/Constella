import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import type { Engine, Frame } from "../world/Engine";
import type { World } from "../world/layout";
import { KIND_NAMES, formatSpan, formatStamp, formatWeekday, sayTags, tagKind, tagName, type Thought } from "../data/model";
import { KIND_COLOURS } from "../world/grade";
import {
  EMOTION_COLOURS,
  EMOTION_NAMES,
  NEED_COLOURS,
  NEED_NAMES,
  PATTERN_COLOURS,
  PATTERN_NAMES,
  lensLine,
  type Lens,
  type Logic,
} from "../data/lenses";
import { logicOf } from "../data/patterns";
import { thoughtQueries, topicQueries } from "../services/news";
import { NewsPopIn } from "./News";

function smooth(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** A topic's name under its star. Ahead it is a quiet name; on arrival it says what it holds and how you got here. */
function TopicLabel({ engine, world, index, from }: { engine: Engine; world: World; index: number; from: number | null }) {
  const node = world.topics[index];
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const opacity = useMotionValue(0);
  const scale = useMotionValue(0.45);
  const detail = useMotionValue(0);
  const detailY = useTransform(detail, (d) => (1 - d) * 10);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let shown = 0;
    let det = 0;
    return engine.subscribe((f: Frame) => {
      const k = index - f.p;
      const near = 1 - smooth(0, 0.7, Math.abs(k));
      let target = k >= 0 ? 1 - smooth(1.6, 2.8, k) : smooth(-1.1, -0.35, k);
      const o = index * 4;
      const sx = f.topicScreen[o];
      const sy = f.topicScreen[o + 1];
      const onScreen = f.topicScreen[o + 2] > 0 && sx > -200 && sx < f.width + 200 && sy > -100 && sy < f.height + 100;
      if (!onScreen || f.overview > 0.05 || (f.flying && Math.abs(k) > 0.5) || f.focus !== null) target = 0;
      // A topic further along gives way rather than write over the one you're at.
      if (index !== f.current) {
        const cx = f.topicScreen[f.current * 4];
        const cy = f.topicScreen[f.current * 4 + 1];
        if (Math.abs(sx - cx) < 320 && sy > cy - 100 && sy < cy + 190) target = 0;
      }
      const kk = 1 - Math.exp(-f.dt * 8);
      shown += (target - shown) * kk;
      det += (near * (f.flying ? 0 : 1) - det) * kk;
      opacity.set(shown < 0.004 ? 0 : shown);
      detail.set(det);
      scale.set(0.45 + 0.55 * det);
      x.set(sx);
      y.set(sy);
      const el = ref.current;
      if (el) {
        el.style.visibility = shown > 0.03 ? "visible" : "hidden";
        el.style.pointerEvents = shown > 0.4 && det < 0.5 ? "auto" : "none";
        el.tabIndex = shown > 0.03 && det < 0.5 ? 0 : -1;
      }
    });
  }, [engine, index, x, y, opacity, scale, detail]);

  const count = node.thoughts.length;
  const link = from !== null ? world.between(from, index) : undefined;
  const fromName = from !== null ? world.topics[from]?.topic.name : null;
  return (
    <motion.button
      ref={ref}
      type="button"
      className="topic-label"
      style={{ x, y, opacity, visibility: "hidden" }}
      tabIndex={-1}
      aria-label={`Go to ${node.topic.name}`}
      onClick={() => !engine.clickSuppressed() && engine.goToTopic(index)}
    >
      <motion.span className="topic-label__box" style={{ x: "-50%", scale }}>
        <span className="topic-label__title">{node.topic.name}</span>
        <motion.span className="topic-label__detail" style={{ opacity: detail, y: detailY }}>
          {node.topic.about && <span className="topic-label__about">{node.topic.about}</span>}
          <span className="topic-label__meta">
            {count} {count === 1 ? "thought" : "thoughts"} · {formatSpan(node.first, node.last)}
          </span>
          {link && fromName && (
            <span className="topic-label__from">
              From {fromName}, through {sayTags(link.shared)}
            </span>
          )}
        </motion.span>
      </motion.span>
    </motion.button>
  );
}

/** One thought on a topic's ring: its name and when, beside its star. */
function ThoughtLabel({
  engine,
  world,
  index,
  lens,
  logic,
  colour,
  onOpen,
}: {
  engine: Engine;
  world: World;
  index: number;
  lens: Lens;
  logic: Logic | undefined;
  colour: string;
  onOpen: (i: number) => void;
}) {
  const node = world.thoughts[index];
  const t = node.thought;
  // Under a lens, the second line says what that lens sees in this thought.
  const logicLine = lens === "logic" ? logicOf(logic, t.id)[0] : undefined;
  const second = logicLine
    ? `${logicLine.label} “${world.thoughtById.get(logicLine.other)?.thought.title ?? ""}”`
    : (lensLine(lens, t) ?? formatStamp(t.at));
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const opacity = useMotionValue(0);
  const ref = useRef<HTMLButtonElement>(null);
  const side = useRef<"left" | "right" | "below">("right");

  useEffect(() => {
    let shown = 0;
    return engine.subscribe((f: Frame) => {
      const o = index * 4;
      const open = f.thoughtScreen[o + 3];
      const sx = f.thoughtScreen[o];
      const sy = f.thoughtScreen[o + 1];
      const tsx = f.topicScreen[node.topic * 4];
      let target = smooth(0.55, 0.95, open) * (1 - f.overview);
      if (f.focus !== null) {
        // Around a thought in focus, the others stay faint and keep clear of its card.
        const fx = f.thoughtScreen[f.focus * 4];
        const fy = f.thoughtScreen[f.focus * 4 + 1];
        const overCard = sx > fx - 220 && sx < fx + 640 && sy > fy - 90 && sy < fy + 380;
        target *= f.focus === index || overCard ? 0 : 0.28;
      }
      if (f.flying && node.topic !== f.current) target = 0;
      if (!f.thoughtScreen[o + 2] || sx < -60 || sx > f.width + 60 || sy < -40 || sy > f.height + 40) target = 0;
      shown += (target - shown) * (1 - Math.exp(-f.dt * 8));
      opacity.set(shown < 0.004 ? 0 : shown);
      x.set(sx);
      y.set(sy);
      // Beside the star, away from the topic; on a phone, centred under it so it stays on screen.
      const want = f.width < 700 ? "below" : sx < tsx - 4 ? "left" : "right";
      if (want !== side.current) {
        side.current = want;
        ref.current?.setAttribute("data-side", want);
      }
      const el = ref.current;
      if (el) {
        el.style.visibility = shown > 0.03 ? "visible" : "hidden";
        el.style.pointerEvents = shown > 0.25 ? "auto" : "none";
        el.tabIndex = shown > 0.25 ? 0 : -1;
      }
    });
  }, [engine, index, node.topic, x, y, opacity]);

  return (
    <motion.button
      ref={ref}
      type="button"
      className="thought-label"
      data-side="right"
      style={{ x, y, opacity, visibility: "hidden", ["--kind" as string]: colour }}
      tabIndex={-1}
      aria-label={`${t.title}, ${formatStamp(t.at)}${second !== formatStamp(t.at) ? `, ${second}` : ""}`}
      onClick={() => !engine.clickSuppressed() && onOpen(index)}
      onPointerEnter={() => engine.setHover(index)}
      onPointerLeave={() => engine.setHover(null)}
      onFocus={() => engine.setHover(index)}
      onBlur={() => engine.setHover(null)}
    >
      <span className="thought-label__box">
        <span className="thought-label__title">{t.title}</span>
        <span className={`thought-label__stamp${lens !== "what" ? " is-lens" : ""}`}>{second}</span>
      </span>
    </motion.button>
  );
}

/** Close up on one thought: all of it, when, what it involves, and everything it connects to. */
/** The shape of a spoken thought's voice, as it was recorded. */
export function Waveform({ wave, className = "" }: { wave: number[]; className?: string }) {
  const n = Math.max(1, wave.length);
  return (
    <svg className={`waveform ${className}`} viewBox={`0 0 ${n * 4} 24`} preserveAspectRatio="none" aria-hidden="true">
      {wave.map((v, i) => {
        const h = Math.max(1.5, Math.min(1, v) * 22);
        return <rect key={i} x={i * 4} y={12 - h / 2} width={2.4} height={h} rx={1.2} />;
      })}
    </svg>
  );
}

function spokenLine(t: Thought): string | null {
  if (t.source === "flow") return "Spoken with Wispr Flow";
  if (t.source === "voice" && t.voice) {
    const s = Math.round(t.voice.seconds);
    return `Spoken · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  return null;
}

function FocusCard({
  engine,
  world,
  index,
  logic,
  onOpen,
}: {
  engine: Engine;
  world: World;
  index: number;
  logic: Logic | undefined;
  onOpen: (i: number) => void;
}) {
  const node = world.thoughts[index];
  const t = node.thought;
  const topic = world.topics[node.topic];
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const opacity = useMotionValue(0);
  const lift = useTransform(opacity, (o) => (1 - o) * 14);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let shown = 0;
    return engine.subscribe((f: Frame) => {
      const o = index * 4;
      const target = f.focus === index && !f.flying && f.overview < 0.05 && f.thoughtScreen[o + 2] ? 1 : 0;
      shown += (target - shown) * (1 - Math.exp(-f.dt * 7));
      opacity.set(shown < 0.004 ? 0 : shown);
      const sy = f.thoughtScreen[o + 1];
      // Keep the whole card on screen and clear of the lens bar (bottom on wide screens, top on narrow ones).
      const box = ref.current?.firstElementChild as HTMLElement | null;
      let shift = 0;
      if (box) {
        const wide = f.width > 1100;
        const floor = f.height - (wide ? 130 : f.width < 700 ? 120 : 24);
        const ceiling = wide ? 76 : 166;
        const top = sy + box.offsetTop;
        const bottom = top + box.offsetHeight;
        if (bottom > floor) shift = floor - bottom;
        if (top + shift < ceiling) shift = ceiling - top;
      }
      x.set(f.thoughtScreen[o]);
      y.set(sy + shift);
      if (ref.current) ref.current.style.visibility = shown > 0.03 ? "visible" : "hidden";
    });
  }, [engine, index, x, y, opacity]);

  const r = t.reading;
  const links = world.linksOf(index).slice(0, r ? 3 : 4);
  const about = t.tags.filter((g) => tagKind(g) !== "theme").map(tagName);
  const reasons = logicOf(logic, t.id);
  const spoken = spokenLine(t);
  return (
    <motion.div ref={ref} className="focus-card" style={{ x, y, opacity, visibility: "hidden", ["--kind" as string]: KIND_COLOURS[t.kind] }}>
      <motion.div className="focus-card__box" style={{ y: lift }}>
        <h2 className="focus-card__title">{t.title}</h2>
        <p className="focus-card__text">{t.text}</p>
        <p className="focus-card__meta">
          <span className="focus-card__when">
            {formatWeekday(t.at)}, {formatStamp(t.at)}
          </span>
          <span className="dot" aria-hidden="true" />
          <span>{t.own ? "Yours" : KIND_NAMES[t.kind]}</span>
          <span className="dot" aria-hidden="true" />
          <span>in {topic.topic.name}</span>
        </p>
        {about.length > 0 && <p className="focus-card__about">{about.join(" · ")}</p>}
        {spoken && (
          <p className="focus-card__voice">
            {t.voice && <Waveform wave={t.voice.wave} />}
            <span>{spoken}</span>
          </p>
        )}
        {r && (
          <dl className="readings">
            <div>
              <dt>Feeling</dt>
              <dd style={{ ["--c" as string]: EMOTION_COLOURS[r.emotion] }}>
                {EMOTION_NAMES[r.emotion]}
                <span className="readings__num">
                  {r.valence >= 0 ? "+" : "−"}
                  {Math.abs(r.valence).toFixed(1)} · {r.arousal > 0.55 ? "charged" : r.arousal < 0.25 ? "quiet" : "steady"}
                </span>
              </dd>
            </div>
            {r.needs.length > 0 && (
              <div>
                <dt>Need</dt>
                <dd style={{ ["--c" as string]: NEED_COLOURS[r.needs[0]] }}>{r.needs.map((n) => NEED_NAMES[n]).join(" · ")}</dd>
              </div>
            )}
            {r.patterns.length > 0 && (
              <div>
                <dt>Thinking</dt>
                <dd style={{ ["--c" as string]: PATTERN_COLOURS[r.patterns[0]] }}>{r.patterns.map((p) => PATTERN_NAMES[p]).join(" · ")}</dd>
              </div>
            )}
            {reasons.slice(0, 2).map((x) => {
              const other = world.thoughtById.get(x.other);
              if (!other) return null;
              return (
                <div key={x.label + x.other}>
                  <dt>{x.label}</dt>
                  <dd style={{ ["--c" as string]: x.colour }}>
                    <button type="button" className="inline-link" onClick={() => onOpen(other.index)}>
                      {other.thought.title}
                    </button>
                    <span className="readings__why">{x.why}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
        {links.length > 0 && (
          <div className="focus-card__links">
            <p className="focus-card__links-title">Connected to</p>
            <ul>
              {links.map((l) => {
                const other = l.a === index ? l.b : l.a;
                const o = world.thoughts[other];
                return (
                  <li key={other}>
                    <button
                      type="button"
                      className="link-row"
                      style={{ ["--kind" as string]: KIND_COLOURS[o.thought.kind] }}
                      onClick={() => onOpen(other)}
                      onPointerEnter={() => engine.setHover(other)}
                      onPointerLeave={() => engine.setHover(null)}
                    >
                      <span className="link-row__title">{o.thought.title}</span>
                      <span className="link-row__why">
                        {l.across ? `${world.topics[o.topic].topic.name} · ` : ""}
                        {formatStamp(o.thought.at)} · shares {sayTags(l.shared, 2)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export function JourneyLabels({
  engine,
  world,
  current,
  focus,
  lens,
  logic,
  colours,
  onOpen,
}: {
  engine: Engine;
  world: World;
  current: number;
  focus: number | null;
  lens: Lens;
  logic: Logic | undefined;
  colours: string[];
  onOpen: (thought: number) => void;
}) {
  const topics: number[] = [];
  for (let i = Math.max(0, current - 1); i <= Math.min(world.topics.length - 1, current + 2); i++) topics.push(i);
  const thoughts = world.topics.slice(Math.max(0, current - 1), current + 2).flatMap((t) => t.thoughts);

  // What's new: the focused thought's brands, or the topic's own searches and brands.
  let news: { query: string; anchor: number | null } | null = null;
  if (focus !== null) {
    const q = thoughtQueries(world.thoughts[focus].thought)[0];
    if (q) news = { query: q, anchor: focus };
  } else if (world.topics[current]) {
    const node = world.topics[current];
    const own = node.thoughts.map((i) => world.thoughts[i].thought);
    const q = topicQueries(node.topic, own)[0];
    if (q) {
      const by = node.thoughts.find((i) => thoughtQueries(world.thoughts[i].thought).includes(q));
      news = { query: q, anchor: by ?? null };
    }
  }

  return (
    <div className="labels">
      {thoughts.map((i) => (
        <ThoughtLabel
          key={world.thoughts[i].thought.id}
          engine={engine}
          world={world}
          index={i}
          lens={lens}
          logic={logic}
          colour={colours[i] ?? KIND_COLOURS[world.thoughts[i].thought.kind]}
          onOpen={onOpen}
        />
      ))}
      {topics.map((i) => (
        <TopicLabel key={world.topics[i].topic.id} engine={engine} world={world} index={i} from={i > 0 ? i - 1 : null} />
      ))}
      {focus !== null && <FocusCard key={focus} engine={engine} world={world} index={focus} logic={logic} onOpen={onOpen} />}
      {news && (
        <NewsPopIn
          key={`${news.query}-${focus ?? current}`}
          engine={engine}
          query={news.query}
          anchor={news.anchor}
          topic={current}
          focused={focus !== null}
        />
      )}
    </div>
  );
}
