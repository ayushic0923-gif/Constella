import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatDate, formatTime, formatWeekday } from "../data/model";
import { PRICE } from "../services/pricing";

const ease = [0.22, 1, 0.36, 1] as const;

export type Range = 7 | 15 | 30 | null;
export const RANGES: { value: Range; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 15, label: "15 days" },
  { value: 30, label: "30 days" },
  { value: null, label: "Everything" },
];

export function TopBar({
  account,
  mine,
  source,
  onHome,
  onJump,
  onNews,
  onPatterns,
  onCompose,
  onAccount,
  onSource,
}: {
  account: { label: string } | null;
  mine: boolean;
  source: "example" | "mine";
  onHome: () => void;
  onJump: () => void;
  onNews: () => void;
  onPatterns: () => void;
  onCompose: () => void;
  onAccount: () => void;
  onSource: (s: "example" | "mine") => void;
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const pick = (fn: () => void) => () => {
    setMenu(false);
    fn();
  };

  const switcher = mine && (
    <div className="switch" role="group" aria-label="Whose thoughts">
      <button type="button" aria-pressed={source === "example"} onClick={() => onSource("example")}>
        Example month
      </button>
      <button type="button" aria-pressed={source === "mine"} onClick={() => onSource("mine")}>
        My mind
      </button>
    </div>
  );

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button type="button" className="wordmark" onClick={onHome} aria-label="Inside one mind, back to the start">
          Inside one mind
        </button>
        {switcher}
      </div>
      <nav className="topbar__actions" aria-label="Main">
        <button type="button" className="textbtn wide-only" onClick={onJump} aria-keyshortcuts="/">
          Jump to
        </button>
        <button type="button" className="textbtn wide-only" onClick={onPatterns}>
          Patterns
        </button>
        <button type="button" className="textbtn wide-only" onClick={onNews}>
          What’s new
        </button>
        <button type="button" className="textbtn wide-only" onClick={onCompose} aria-keyshortcuts="N">
          Write a thought
        </button>
        {/* Narrow screens: one menu, with the diary first. */}
        <div className="menu-wrap narrow-only" ref={menuRef}>
          <button type="button" className="textbtn" aria-expanded={menu} aria-controls="topbar-menu" onClick={() => setMenu((m) => !m)}>
            Menu
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div
                id="topbar-menu"
                className="menu"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                transition={{ duration: 0.22, ease }}
              >
                <button type="button" className="menu__primary" onClick={pick(onCompose)}>
                  Write a thought
                </button>
                <button type="button" onClick={pick(onJump)}>
                  Jump to
                </button>
                <button type="button" onClick={pick(onPatterns)}>
                  Patterns
                </button>
                <button type="button" onClick={pick(onNews)}>
                  What’s new
                </button>
                {switcher && <div className="menu__switch">{switcher}</div>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button type="button" className={account ? "textbtn" : "primary primary--small"} onClick={onAccount}>
          {account ? account.label : "Sign up"}
        </button>
      </nav>
    </header>
  );
}

/** The first screen: the whole galaxy, one sentence, one action. */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function Intro({
  mine,
  topics,
  thoughts,
  span,
  onBegin,
  onJump,
  onCompose,
  write,
}: {
  mine: boolean;
  topics: number;
  thoughts: number;
  span: string;
  onBegin: () => void;
  onJump: () => void;
  onCompose: () => void;
  /** The phone's write button, at the end of the row. */
  write: ReactNode;
}) {
  return (
    <motion.section className="intro" initial={false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12, transition: { duration: 0.45 } }}>
      {mine ? (
        <>
          <h1 className="intro__title">
            <span className="intro__muted">Your mind,</span> mapped as a galaxy.
          </h1>
          <p className="intro__line">
            {thoughts === 0
              ? "Nothing here yet. Add a thought and it becomes the first star."
              : `Moments that mattered, joined by what they share: ${plural(thoughts, "thought", "thoughts")} in ${plural(topics, "topic", "topics")} from ${span}. Scroll or drag to travel through them.`}
          </p>
        </>
      ) : (
        <>
          <h1 className="intro__title">
            <span className="intro__muted">A month,</span> inside one mind.
          </h1>
          <p className="intro__line">Moments that mattered, joined by what they share. Scroll or drag to travel through them, or tap below to start your own.</p>
          <div className="demo-indicator">
            <span>
              Exploring the example galaxy ({thoughts} thoughts, {topics} topics)
            </span>
            <button type="button" className="inline-link" onClick={onCompose}>
              Start my diary →
            </button>
          </div>
        </>
      )}
      <div className="intro__actions">
        {thoughts === 0 ? (
          <button type="button" className="primary" onClick={onCompose}>
            Add your first thought
          </button>
        ) : (
          <>
            <button type="button" className="primary" onClick={onBegin}>
              Begin
            </button>
            <button type="button" className="textbtn" onClick={onJump}>
              Jump to a topic
            </button>
          </>
        )}
        {write}
      </div>
      <p className="intro__note">
        {mine ? "Only you can see these." : `A made-up person’s month. Keep your own: free for 7 days, then ${PRICE}.`}
      </p>
    </motion.section>
  );
}

const HOLD_MS = 420;

/**
 * Phones and tablets: a thumb-sized way to write, bottom right above the topic count (or in the
 * intro's row on the landing page). Tap to write; hold, and the diary opens already listening.
 */
export function WriteButton({ inline, onCompose, onTalk }: { inline: boolean; onCompose: () => void; onTalk: () => void }) {
  const [held, setHeld] = useState(false);
  const hold = useRef<{ timer: number; held: boolean } | null>(null);
  const skipClick = useRef(false);
  const cancel = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
    setHeld(false);
  };
  useEffect(() => cancel, []);
  return (
    <button
      type="button"
      className={`fab narrow-only${inline ? " fab--inline" : ""}${held ? " is-held" : ""}`}
      aria-label="Write a thought (hold to talk)"
      onPointerDown={() => {
        cancel();
        const h = { timer: 0, held: false };
        h.timer = window.setTimeout(() => {
          h.held = true;
          setHeld(true);
          navigator.vibrate?.(12);
        }, HOLD_MS);
        hold.current = h;
      }}
      onPointerUp={() => {
        const wasHeld = hold.current?.held ?? false;
        cancel();
        // Letting go is the tap the browser needs before it will listen.
        if (wasHeld) {
          skipClick.current = true;
          onTalk();
        }
      }}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (skipClick.current) {
          skipClick.current = false;
          return;
        }
        onCompose();
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {held ? (
          <>
            <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </>
        ) : (
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}

/** In the overview once the journey has begun: the date range, and the way back in. */
export function OverviewHeader({
  title,
  range,
  onRange,
  backTo,
  onBack,
}: {
  title: string;
  range: Range;
  onRange: (r: Range) => void;
  backTo: string | null;
  onBack: () => void;
}) {
  return (
    <motion.section
      className="overview-head"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.9, ease } }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <h2 className="overview-head__title">{title}</h2>
      <div className="range" role="group" aria-label="How far back">
        {RANGES.map((r) => (
          <button key={r.label} type="button" aria-pressed={range === r.value} onClick={() => onRange(r.value)}>
            {r.label}
          </button>
        ))}
      </div>
      <p className="overview-head__line">Each star is a topic; the threads between them are what they share. Click any topic to go there.</p>
      {backTo && (
        <button type="button" className="primary" onClick={onBack}>
          Back to {backTo}
        </button>
      )}
    </motion.section>
  );
}

/** Pinned while everything else moves: the date and time of what you're looking at. */
export function Stamp({ iso, where }: { iso: string | null; where: string }) {
  if (!iso) return null;
  const date = formatDate(iso);
  return (
    <div className="stamp">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={date}
          className="stamp__date"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.45, ease }}
        >
          {date}
        </motion.p>
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={`${iso}-${where}`}
          className="stamp__line"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {formatWeekday(iso)}, {formatTime(iso)} · {where}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

export function Progress({ current, total, hint }: { current: number; total: number; hint: boolean }) {
  return (
    <div className="progress">
      <AnimatePresence>
        {hint && (
          <motion.p
            className="progress__hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 2.8, duration: 0.6 } }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          >
            Scroll for the next topic. Click a thought to open it.
          </motion.p>
        )}
      </AnimatePresence>
      <p className="progress__count">
        Topic {current + 1} <span className="progress__of">of {total}</span>
      </p>
    </div>
  );
}

export function BackChip({ title, onBack }: { title: string | null; onBack: () => void }) {
  return (
    <AnimatePresence>
      {title && (
        <motion.button
          type="button"
          className="back-chip"
          onClick={onBack}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease }}
          aria-keyshortcuts="B"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to {title}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export function Announcer({ text }: { text: string }) {
  return (
    <p className="sr-only" aria-live="polite">
      {text}
    </p>
  );
}

/** A short line that confirms something happened, then goes. */
export function Toast({ text }: { text: string | null }) {
  return (
    <AnimatePresence>
      {text && (
        <motion.p
          className="toast"
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3, ease }}
        >
          {text}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
