import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  EMOTION_COLOURS,
  EMOTION_NAMES,
  LENSES,
  LOGIC_COLOURS,
  LOGIC_NAMES,
  NEED_COLOURS,
  NEED_NAMES,
  PATTERN_COLOURS,
  PATTERN_NAMES,
  TIME_COLOURS,
  TIME_NAMES,
  type Lens,
} from "../data/lenses";
import type { Insight } from "../data/patterns";
import { MIRROR_COLOURS, type Forming, type Mirror } from "../data/mirrors";
import type { World } from "../world/layout";

function legend(lens: Lens): { label: string; colour: string }[] {
  const from = <K extends string>(names: Record<K, string>, colours: Record<K, string>) =>
    (Object.keys(names) as K[]).map((k) => ({ label: names[k], colour: colours[k] }));
  switch (lens) {
    case "feeling":
      return from(EMOTION_NAMES, EMOTION_COLOURS);
    case "need":
      return from(NEED_NAMES, NEED_COLOURS);
    case "thinking":
      return (["rumination", "self-criticism", "avoidance", "comparison", "catastrophising", "reframe", "self-compassion", "action"] as const).map((k) => ({
        label: PATTERN_NAMES[k],
        colour: PATTERN_COLOURS[k],
      }));
    case "logic":
      return from(LOGIC_NAMES, LOGIC_COLOURS);
    case "time":
      return from(TIME_NAMES, TIME_COLOURS);
    default:
      return [
        { label: "Same topic", colour: "#e6dcf0" },
        { label: "Across topics", colour: "#f9a3c0" },
      ];
  }
}

/** Switch how the threads are read: what thoughts share, how they feel, what they need… */
export function LensBar({ lens, onLens }: { lens: Lens; onLens: (l: Lens) => void }) {
  const active = LENSES.find((l) => l.id === lens)!;
  return (
    <div className="lensbar">
      <div className="lensbar__tabs" role="radiogroup" aria-label="Read the connections by">
        {LENSES.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={lens === l.id} onClick={() => onLens(l.id)}>
            {l.name}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={lens}
          className="lensbar__legend"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
        >
          <span className="lensbar__question">{active.question}</span>
          {legend(lens).map((x) => (
            <span key={x.label} className="lensbar__key" style={{ ["--c" as string]: x.colour }}>
              {x.label}
            </span>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Chart({ chart }: { chart: NonNullable<Insight["chart"]> }) {
  if (chart.kind === "hours") {
    const max = Math.max(1, ...chart.values);
    return (
      <svg className="pattern__hours" viewBox="0 0 240 48" role="img" aria-label="Thoughts by hour of the day">
        {chart.values.map((v, h) => (
          <rect key={h} x={h * 10 + 1} y={48 - (v / max) * 44} width={8} height={Math.max(1, (v / max) * 44)} rx={2} fill={h >= 22 || h < 5 ? "#7f93d6" : chart.colour} />
        ))}
      </svg>
    );
  }
  const total = chart.parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="pattern__split">
      <div className="pattern__bar" aria-hidden="true">
        {chart.parts.map((p) => (
          <span key={p.label} style={{ flexGrow: p.value, background: p.colour }} />
        ))}
      </div>
      <p className="pattern__keys">
        {chart.parts.map((p) => (
          <span key={p.label} style={{ ["--c" as string]: p.colour }}>
            {p.label} {Math.round((p.value / total) * 100)}%
          </span>
        ))}
      </p>
    </div>
  );
}

/** Until there are enough thoughts for the mirrors: how far along. The First Spark follows it. */
function FormingCard({ forming }: { forming: Forming }) {
  return (
    <article className="pattern">
      <h3 className="pattern__title">Constellation forming</h3>
      <p className="forming">
        <span className="forming__dots" aria-hidden="true">
          {Array.from({ length: forming.needed }, (_, i) => (
            <span key={i} className={i < forming.count ? "is-lit" : undefined} />
          ))}
        </span>
        <span>
          {forming.count} of {forming.needed} thoughts
        </span>
      </p>
      {forming.count === 0 && <p className="pattern__line">Record your first thought to start your constellation.</p>}
    </article>
  );
}

/** What the lenses found: the three mirrors first, then each pattern with its number, a line of reasoning and the thoughts behind it. */
export function PatternsPanel({
  open,
  insights,
  mirrors,
  forming,
  world,
  readBy,
  onClose,
  onEvidence,
  onShare,
}: {
  open: boolean;
  insights: Insight[];
  mirrors: Mirror[];
  forming: Forming | null;
  world: World;
  readBy: string;
  onClose: () => void;
  onEvidence: (lens: Lens, thoughtId: string) => void;
  onShare: (() => void) | null;
}) {
  const [filter, setFilter] = useState<Lens | "all">("all");
  const shown = insights.filter((i) => filter === "all" || i.lens === filter);
  // Each mirror also shows under the lens that reads it best.
  const mirrorsShown = mirrors.filter((m) => filter === "all" || m.lens === filter);
  const evidence = (lens: Lens, ids: string[]) =>
    ids.length > 0 && (
      <p className="pattern__evidence">
        {ids.map((id) => {
          const n = world.thoughtById.get(id);
          if (!n) return null;
          return (
            <button key={id} type="button" className="evidence" onClick={() => onEvidence(lens, id)}>
              {n.thought.title}
            </button>
          );
        })}
      </p>
    );
  const mirror = (m: Mirror, i: number) => (
    <motion.article
      key={m.id}
      className="pattern pattern--mirror"
      style={{ ["--c" as string]: MIRROR_COLOURS[m.id] }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0, transition: { delay: 0.06 + i * 0.05, duration: 0.4 } }}
    >
      <h3 className="pattern__title">{m.title}</h3>
      <p className="pattern__line">{m.body}</p>
      {evidence(m.lens, m.evidence)}
    </motion.article>
  );
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="scrim scrim--side"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.aside
            className="drawer drawer--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patterns-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
          >
            <div className="drawer__head">
              <h2 id="patterns-title" className="drawer__title">
                Patterns
              </h2>
              <button type="button" className="textbtn" onClick={onClose} autoFocus>
                Close
              </button>
            </div>
            <p className="drawer__line">
              What the lenses found in {world.thoughts.length === 1 ? "this thought" : `these ${world.thoughts.length} thoughts`}. {readBy}
            </p>
            {onShare && (
              <p className="patterns__share">
                <button type="button" className="inline-link" onClick={onShare}>
                  Share constellation
                </button>
                <span>A picture of the stars alone, without a word of what you wrote.</span>
              </p>
            )}
            <div className="range patterns__filter" role="group" aria-label="Show patterns for">
              <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                All
              </button>
              {LENSES.map((l) => (
                <button key={l.id} type="button" aria-pressed={filter === l.id} onClick={() => setFilter(l.id)}>
                  {l.name}
                </button>
              ))}
            </div>
            <div className="drawer__body">
              {forming && <FormingCard forming={forming} />}
              {forming?.spark && mirror(forming.spark, 0)}
              {mirrorsShown.length > 0 && (
                <>
                  <h3 className="patterns__heading">Three mirrors</h3>
                  {mirrorsShown.map(mirror)}
                  {shown.length > 0 && (
                    <h3 className="patterns__heading">{filter === "all" ? "Every lens" : LENSES.find((l) => l.id === filter)?.name}</h3>
                  )}
                </>
              )}
              {shown.length === 0 && mirrorsShown.length === 0 && !forming && (
                <p className="news-section__state">Not enough thoughts here yet for this lens.</p>
              )}
              {shown.map((ins, i) => (
                <motion.article
                  key={ins.id}
                  className="pattern"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: 0.06 + i * 0.035, duration: 0.4 } }}
                >
                  <h3 className="pattern__title">{ins.title}</h3>
                  <p className="pattern__line">
                    <span className="pattern__figure">{ins.figure}</span> {ins.line}
                  </p>
                  {ins.chart && <Chart chart={ins.chart} />}
                  {evidence(ins.lens, ins.evidence)}
                </motion.article>
              ))}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
