import { useEffect, useRef } from "react";
import type { Engine, Frame } from "../world/Engine";
import type { World } from "../world/layout";
import { formatSpan, formatStamp } from "../data/model";

/** The whole galaxy from outside: every topic named where it sits. */
export function TopicNames({ engine, world, active, onPick }: { engine: Engine; world: World; active: boolean; onPick: (i: number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const here = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let shown = 0;
    const placed: [number, number][] = [];
    return engine.subscribe((f: Frame) => {
      const target = active && f.overview > 0.85 && !f.flying ? 1 : 0;
      shown += (target - shown) * (1 - Math.exp(-f.dt * 5));
      placed.length = 0;
      world.topics.forEach((_, i) => {
        const el = refs.current[i];
        if (!el) return;
        const x = f.topicScreen[i * 4];
        const y = f.topicScreen[i * 4 + 1];
        // Where names would collide, later ones give way.
        const clear = placed.every(([px, py]) => Math.abs(px - x) > 130 || Math.abs(py - y) > 40);
        const vis = f.topicScreen[i * 4 + 2] > 0 && clear;
        if (vis) placed.push([x, y]);
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        el.style.opacity = String(vis ? shown : 0);
        el.style.visibility = shown > 0.03 && vis ? "visible" : "hidden";
      });
      const h = here.current;
      if (h) {
        const i = f.current;
        h.style.transform = `translate3d(${f.topicScreen[i * 4]}px, ${f.topicScreen[i * 4 + 1]}px, 0)`;
        h.style.opacity = String(shown);
        h.style.visibility = shown > 0.03 ? "visible" : "hidden";
      }
    });
  }, [engine, world, active]);

  return (
    <div className="labels">
      {world.topics.map((t, i) => (
        <button
          key={t.topic.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          className="topic-name"
          style={{ visibility: "hidden", opacity: 0 }}
          onClick={() => !engine.clickSuppressed() && onPick(i)}
        >
          <span className="topic-name__name">{t.topic.name}</span>
          <span className="topic-name__meta">
            {t.thoughts.length} · {formatSpan(t.first, t.last)}
          </span>
        </button>
      ))}
      <div ref={here} className="you-are-here" style={{ visibility: "hidden" }} aria-hidden="true">
        <span>You are here</span>
      </div>
    </div>
  );
}

export function HoverCard({ world, hit, x, y }: { world: World; hit: { kind: "thought" | "topic"; index: number } | null; x: number; y: number }) {
  if (!hit) return null;
  let top: string;
  let main: string;
  if (hit.kind === "thought") {
    const node = world.thoughts[hit.index];
    if (!node) return null;
    top = `${formatStamp(node.thought.at)} · ${world.topics[node.topic].topic.name}`;
    main = node.thought.title;
  } else {
    const node = world.topics[hit.index];
    if (!node) return null;
    top = `${node.thoughts.length} thoughts · ${formatSpan(node.first, node.last)}`;
    main = node.topic.name;
  }
  return (
    <div className="hover-card" style={{ transform: `translate3d(${x + 16}px, ${y + 16}px, 0)` }} role="tooltip">
      <span className="hover-card__time">{top}</span>
      <span className="hover-card__title">{main}</span>
    </div>
  );
}
