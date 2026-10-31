import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue } from "motion/react";
import type { Engine, Frame } from "../world/Engine";
import { fetchNews, type NewsItem } from "../services/news";
import { timeAgo } from "../data/model";

const spring = { type: "spring", stiffness: 260, damping: 24 } as const;

/**
 * News about something a thought mentions, springing out of its star once you
 * have settled there. Real headlines only; nothing shows if none come back.
 */
export function NewsPopIn({
  engine,
  query,
  anchor,
  topic,
  focused,
}: {
  engine: Engine;
  query: string;
  anchor: number | null;
  topic: number;
  focused: boolean;
}) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [visible, setVisible] = useState(false);
  const [at, setAt] = useState(0);
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const settledFor = useRef(0);

  useEffect(() => {
    let live = true;
    const t = window.setTimeout(() => fetchNews(query).then((r) => live && setItems(r)), 700);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    let shown = false;
    return engine.subscribe((f: Frame) => {
      const right = focused ? f.focus === anchor : f.focus === null && f.current === topic;
      const settled = right && !f.flying && f.overview < 0.05 && Math.abs(f.p - topic) < 0.05;
      settledFor.current = settled ? settledFor.current + f.dt : 0;
      // On a phone an open thought's card fills the screen; headlines wait for the topic view.
      const want = settledFor.current > 1.1 && !(focused && f.width < 700);
      if (want !== shown) {
        shown = want;
        setVisible(want);
      }
      let sx: number;
      let sy: number;
      if (anchor !== null) {
        sx = f.thoughtScreen[anchor * 4];
        sy = f.thoughtScreen[anchor * 4 + 1];
      } else {
        sx = f.topicScreen[topic * 4];
        sy = f.topicScreen[topic * 4 + 1];
      }
      // Beside the star, on the side away from the words already there, kept on screen.
      const w = Math.min(320, f.width - 32);
      let px = focused ? sx - w - 40 : sx + (sx > f.width / 2 ? -w - 24 : 24);
      let py = focused ? sy + 30 : sy + 42;
      px = Math.min(f.width - w - 16, Math.max(16, px));
      // Clear of the pinned date, the topic count and the lens bar (bottom on wide screens, top on narrow ones).
      py = Math.min(f.height - (f.width <= 900 ? 330 : f.width < 1100 ? 190 : 310), Math.max(f.width < 1100 ? 150 : 80, py));
      x.set(px);
      y.set(py);
    });
  }, [engine, anchor, topic, focused, x, y]);

  useEffect(() => {
    if (!visible || !items || items.length < 2) return;
    const id = window.setInterval(() => setAt((a) => (a + 1) % Math.min(3, items.length)), 6500);
    return () => window.clearInterval(id);
  }, [visible, items]);

  const item = items?.[at];
  return (
    <motion.div className="news-pop" style={{ x, y }}>
      <AnimatePresence>
        {visible && item && (
          <motion.aside
            key="card"
            className="news-card"
            aria-live="polite"
            initial={{ opacity: 0, scale: 0.55, filter: "blur(10px)", y: 18 }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: 0 }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(6px)", y: 8, transition: { duration: 0.25 } }}
            transition={spring}
          >
            <p className="news-card__label">
              <span className="news-card__pulse" aria-hidden="true" />
              What’s new about {query}
            </p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={item.link}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <a className="news-card__title" href={item.link} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
                <p className="news-card__meta">
                  {item.source}
                  {item.published && ` · ${timeAgo(item.published)}`}
                </p>
              </motion.div>
            </AnimatePresence>
            {items && items.length > 1 && (
              <div className="news-card__dots" aria-hidden="true">
                {items.slice(0, 3).map((_, i) => (
                  <span key={i} className={i === at ? "is-on" : ""} />
                ))}
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export interface NewsGroup {
  query: string;
  topics: { index: number; name: string }[];
}

function NewsSection({ group, onTopic }: { group: NewsGroup; onTopic: (i: number) => void }) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  useEffect(() => {
    let live = true;
    fetchNews(group.query).then((r) => live && setItems(r));
    return () => {
      live = false;
    };
  }, [group.query]);
  return (
    <section className="news-section">
      <h3 className="news-section__title">{group.query}</h3>
      <p className="news-section__where">
        In{" "}
        {group.topics.map((t, i) => (
          <span key={t.index}>
            {i > 0 && (i === group.topics.length - 1 ? " and " : ", ")}
            <button type="button" className="inline-link" onClick={() => onTopic(t.index)}>
              {t.name}
            </button>
          </span>
        ))}
      </p>
      {items === null && <p className="news-section__state">Looking for news…</p>}
      {items && items.length === 0 && <p className="news-section__state">Nothing new in the last two weeks.</p>}
      {items && items.length > 0 && (
        <ul className="news-section__list">
          {items.slice(0, 3).map((n) => (
            <li key={n.link}>
              <a href={n.link} target="_blank" rel="noopener noreferrer">
                {n.title}
              </a>
              <span className="news-section__meta">
                {n.source}
                {n.published && ` · ${timeAgo(n.published)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Everything new about the brands and places in these thoughts. */
export function WhatsNewPanel({
  open,
  groups,
  onClose,
  onTopic,
}: {
  open: boolean;
  groups: NewsGroup[];
  onClose: () => void;
  onTopic: (i: number) => void;
}) {
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
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="news-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
          >
            <div className="drawer__head">
              <h2 id="news-title" className="drawer__title">
                What’s new
              </h2>
              <button type="button" className="textbtn" onClick={onClose} autoFocus>
                Close
              </button>
            </div>
            <p className="drawer__line">
              Recent news about the brands and places these thoughts mention, from Google News, last two weeks.
            </p>
            <div className="drawer__body">
              {groups.length === 0 && <p className="news-section__state">No brands or places in these thoughts yet.</p>}
              {groups.map((g, i) => (
                <motion.div
                  key={g.query}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: 0.08 + i * 0.04, duration: 0.4 } }}
                >
                  <NewsSection group={g} onTopic={onTopic} />
                </motion.div>
              ))}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
