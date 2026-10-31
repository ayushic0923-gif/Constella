import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { World } from "../world/layout";
import { formatSpan, formatStamp, tagName } from "../data/model";
import { KIND_COLOURS } from "../world/grade";

type Hit = { kind: "topic"; index: number } | { kind: "thought"; index: number };

/** Go straight to any topic or thought instead of scrolling there one by one. */
export function JumpTo({
  open,
  world,
  current,
  onClose,
  onTopic,
  onThought,
}: {
  open: boolean;
  world: World;
  current: number;
  onClose: () => void;
  onTopic: (i: number) => void;
  onThought: (i: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return world.topics.map((t) => ({ kind: "topic", index: t.index }));
    const topics = world.topics
      .filter((t) => `${t.topic.name} ${t.topic.about} ${t.tags.map(tagName).join(" ")}`.toLowerCase().includes(q))
      .map<Hit>((t) => ({ kind: "topic", index: t.index }));
    const thoughts = world.thoughts
      .filter((t) => `${t.thought.title} ${t.thought.text} ${t.thought.tags.map(tagName).join(" ")}`.toLowerCase().includes(q))
      .slice(0, 14)
      .map<Hit>((t) => ({ kind: "thought", index: t.index }));
    return [...topics, ...thoughts];
  }, [query, world]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(Math.min(current, world.topics.length - 1));
    requestAnimationFrame(() => input.current?.focus());
  }, [open, current, world.topics.length]);

  useEffect(() => {
    if (query) setActive(0);
  }, [query]);

  useEffect(() => {
    document.getElementById(`jump-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (h: Hit | undefined) => {
    if (!h) return;
    onClose();
    if (h.kind === "topic") onTopic(h.index);
    else onThought(h.index);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="scrim scrim--top"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className="jump"
            role="dialog"
            aria-modal="true"
            aria-label="Jump to a topic or thought"
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <label className="jump__label" htmlFor="jump-input">
              Jump to a topic or thought
            </label>
            <input
              id="jump-input"
              ref={input}
              className="jump__input"
              value={query}
              placeholder="Try “Mom”, “Swiggy” or “sleep”"
              autoComplete="off"
              role="combobox"
              aria-expanded="true"
              aria-controls="jump-results"
              aria-activedescendant={hits[active] ? `jump-${active}` : undefined}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") setActive((a) => Math.min(hits.length - 1, a + 1));
                else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
                else if (e.key === "Enter") pick(hits[active]);
                else if (e.key === "Escape") onClose();
                else return;
                e.preventDefault();
                e.stopPropagation();
              }}
            />
            <ul className="jump__results" id="jump-results" role="listbox">
              {hits.length === 0 && <li className="jump__empty">Nothing by that name in these thoughts.</li>}
              {hits.map((h, i) => {
                if (h.kind === "topic") {
                  const t = world.topics[h.index];
                  return (
                    <li
                      key={`t-${t.topic.id}`}
                      id={`jump-${i}`}
                      role="option"
                      aria-selected={i === active}
                      className="jump__row"
                      onPointerEnter={() => setActive(i)}
                      onClick={() => pick(h)}
                    >
                      <span className="jump__num">{t.index + 1}</span>
                      <span className="jump__main">
                        <span className="jump__name">{t.topic.name}</span>
                        <span className="jump__sub">
                          {t.thoughts.length} thoughts · {formatSpan(t.first, t.last)}
                          {t.tags.length > 0 && ` · ${t.tags.slice(0, 3).map(tagName).join(", ")}`}
                        </span>
                      </span>
                      {t.index === current && <span className="jump__here">You are here</span>}
                    </li>
                  );
                }
                const n = world.thoughts[h.index];
                return (
                  <li
                    key={`h-${n.thought.id}`}
                    id={`jump-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className="jump__row"
                    style={{ ["--kind" as string]: KIND_COLOURS[n.thought.kind] }}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => pick(h)}
                  >
                    <span className="jump__dot" aria-hidden="true" />
                    <span className="jump__main">
                      <span className="jump__name jump__name--thought">{n.thought.title}</span>
                      <span className="jump__sub">
                        {world.topics[n.topic].topic.name} · {formatStamp(n.thought.at)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
