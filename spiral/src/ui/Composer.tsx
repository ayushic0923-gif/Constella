import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { KIND_NAMES, KINDS, extractTags, formatTime, formatWeekday, formatDate, tagKind, tagName, type Kind } from "../data/model";
import { EMOTION_COLOURS, EMOTION_NAMES, NEED_NAMES, readByRules } from "../data/lenses";
import { KIND_COLOURS } from "../world/grade";

// The diary: a night page that rises over the galaxy. Speak into it, let Wispr
// Flow type into it, or write. Whatever lands on the page becomes a star.

export interface ComposerInput {
  topicName: string;
  title: string;
  text: string;
  kind: Kind;
  at: string;
  tags: string[];
  source: "typed" | "voice" | "flow";
  voice?: { seconds: number; wave: number[] };
}

const SPEAK_WPM = 150; // typical conversational speech
const TYPE_WPM = 40; // typical typing on a keyboard
const FLOW_KEY = "inside-one-mind.uses-flow";

function localNow(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function prompt(now: Date): string {
  const h = now.getHours();
  if (h >= 5 && h < 12) return "What woke up with you this morning?";
  if (h >= 12 && h < 18) return "What’s taking up room in your head today?";
  if (h >= 18 && h < 22) return "What happened today that you want to keep?";
  return "What’s still on your mind tonight?";
}

// A name for an entry nobody named: its first few words, never ending on a little word.
const LITTLE = new Set(["a", "an", "the", "and", "but", "or", "of", "to", "in", "on", "at", "for", "with", "about", "my", "i", "is", "was", "that", "so"]);
function shortName(body: string): string {
  const words = body.split(/\s+/).slice(0, 5).map((w) => w.replace(/[.,;:!?]+$/, ""));
  while (words.length > 2 && LITTLE.has(words[words.length - 1].toLowerCase())) words.pop();
  return words.join(" ");
}

// How Flow is reached on each device, per Wispr's own docs: a held hotkey on
// desktop, its keyboard on iPhone, a floating bubble on Android.
type Device = "mac" | "windows" | "ios" | "android";
function device(): Device {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return /Mac/.test(navigator.platform || ua) ? "mac" : "windows";
}

function duration(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} s` : ""}`.trim();
}

interface SpeechRec {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

function speechRecognition(): (new () => SpeechRec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Records the voice: live level for the waveform, and words from the browser's speech service. */
function useVoice(onWords: (finalText: string, interim: string) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const levels = useRef<number[]>([]);
  const live = useRef(0);
  const stopRef = useRef<() => void>(() => {});
  const supported = !!speechRecognition() && !!navigator.mediaDevices?.getUserMedia;

  const start = async () => {
    setError(null);
    const SR = speechRecognition();
    if (!SR || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser can’t turn speech into text. Use Wispr Flow, or write.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("The microphone is blocked. Allow it in the address bar, or use Wispr Flow.");
      return;
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    levels.current = [];
    const began = performance.now();
    const tick = window.setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const b of buf) sum += ((b - 128) / 128) ** 2;
      const rms = Math.min(1, Math.sqrt(sum / buf.length) * 4);
      live.current = rms;
      levels.current.push(rms);
      setSeconds((performance.now() - began) / 1000);
    }, 80);

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-IN";
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onWords(finalText, interim);
    };
    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError("The speech service stopped. Try again, or use Wispr Flow.");
    };
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(tick);
      try {
        rec.stop();
      } catch {
        // already stopped
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      live.current = 0;
      setRecording(false);
    };
    rec.onend = stop;
    stopRef.current = stop;
    rec.start();
    setRecording(true);
  };

  /** The saved shape of the voice: 48 bars, loudest scaled to full height. */
  const wave = () => {
    const src = levels.current;
    if (!src.length) return [];
    const bars = 48;
    const out: number[] = [];
    for (let i = 0; i < bars; i++) {
      const slice = src.slice(Math.floor((i * src.length) / bars), Math.floor(((i + 1) * src.length) / bars) || undefined);
      out.push(slice.length ? Math.max(...slice) : 0);
    }
    const max = Math.max(0.05, ...out);
    return out.map((v) => Math.round((v / max) * 100) / 100);
  };

  useEffect(() => () => stopRef.current(), []);
  return { recording, seconds, error, supported, live, levels, start, stop: () => stopRef.current(), wave };
}

function LiveWave({ live, recording }: { live: React.MutableRefObject<number>; recording: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const g = c.getContext("2d")!;
    const bars: number[] = new Array(40).fill(0);
    let raf = 0;
    const draw = () => {
      bars.shift();
      bars.push(recording ? live.current : bars[bars.length - 1] * 0.9);
      const w = (c.width = c.clientWidth * devicePixelRatio);
      const h = (c.height = c.clientHeight * devicePixelRatio);
      g.clearRect(0, 0, w, h);
      g.fillStyle = "#f9a3c0";
      const step = w / bars.length;
      bars.forEach((v, i) => {
        const bh = Math.max(2 * devicePixelRatio, v * h * 0.9);
        g.globalAlpha = 0.35 + 0.65 * (i / bars.length);
        g.fillRect(i * step + step * 0.25, (h - bh) / 2, step * 0.5, bh);
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [live, recording]);
  return <canvas ref={canvas} className="diary__wave" aria-hidden="true" />;
}

export function Composer({
  open,
  topics,
  people,
  saveNote,
  blocked,
  onClose,
  onAdd,
  onSubscribe,
}: {
  open: boolean;
  topics: string[];
  people: string[];
  saveNote: string;
  blocked: boolean;
  onClose: () => void;
  onAdd: (t: ComposerInput) => Promise<string | null>;
  onSubscribe: () => void;
}) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [topic, setTopic] = useState("");
  const [when, setWhen] = useState(localNow);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [folding, setFolding] = useState(false);
  const [source, setSource] = useState<ComposerInput["source"]>("typed");
  const [burst, setBurst] = useState<number | null>(null); // words that arrived at once
  const [askFlow, setAskFlow] = useState(false);
  const [usesFlow, setUsesFlow] = useState(() => {
    try {
      return localStorage.getItem(FLOW_KEY) === "1";
    } catch {
      return false;
    }
  });
  const area = useRef<HTMLTextAreaElement>(null);
  const declined = useRef(false); // said a burst was pasted: don't ask again this time
  const before = useRef("");
  const voiceSeconds = useRef(0);
  const savedWave = useRef<number[]>([]);
  const press = useRef<{ at: number; started: boolean } | null>(null);
  const now = useMemo(() => new Date(), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const voice = useVoice((finalText, interim) => {
    setText(`${before.current}${before.current && !before.current.endsWith(" ") ? " " : ""}${finalText}${interim}`.trimStart());
  });

  useEffect(() => {
    if (!open) return;
    setWhen(localNow());
    setError(null);
    setFolding(false);
    if (!topic && topics[0]) setTopic(topics[0]);
    requestAnimationFrame(() => area.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!voice.recording && voice.seconds > 0.5) {
      voiceSeconds.current += voice.seconds;
      savedWave.current = voice.wave();
      setSource("voice");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.recording]);

  const tags = useMemo(() => extractTags(text, people), [text, people]);
  const reading = useMemo(() => (text.trim().split(/\s+/).length >= 4 ? readByRules(text) : null), [text]);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const markFlow = (yes: boolean) => {
    setAskFlow(false);
    if (!yes) declined.current = true;
    if (yes) {
      setSource("flow");
      setUsesFlow(true);
      try {
        localStorage.setItem(FLOW_KEY, "1");
      } catch {
        // fine: remembered for this visit only
      }
    }
  };

  // Dictation tools (Wispr Flow among them) drop a whole passage in at once,
  // not one key at a time. That's how the page knows it was spoken.
  // Flow pastes the way a person does, so a paste alone can't tell them apart: it asks once.
  const onBurst = useRef<(ev: InputEvent) => void>(() => {});
  onBurst.current = (ev) => {
    if (voice.recording) return;
    const data = ev.data ?? (ev.dataTransfer?.getData("text/plain") || "");
    const n = data.trim().split(/\s+/).filter(Boolean).length;
    const atOnce = ev.inputType === "insertFromPaste" || ev.inputType === "insertReplacementText" || (ev.inputType === "insertText" && data.length > 14);
    if (!atOnce || n < 4) return;
    setBurst((b) => (b ?? 0) + n);
    if (usesFlow) setSource("flow");
    else if (!declined.current) setAskFlow(true);
  };

  // React's onBeforeInput doesn't carry inputType, so listen to the native event.
  useEffect(() => {
    const el = area.current;
    if (!open || !el) return;
    const fn = (e: Event) => onBurst.current(e as InputEvent);
    el.addEventListener("beforeinput", fn);
    return () => el.removeEventListener("beforeinput", fn);
  }, [open, blocked]);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    const topicName = topic.trim() || "Today";
    const auto = shortName(body);
    const guessed: Kind = kind ?? (reading?.emotion === "worry" ? "worry" : /\?\s*$/.test(body) ? "question" : "noticed");
    setSaving(true);
    setFolding(true);
    const input: ComposerInput = {
      topicName,
      title: title.trim() || auto,
      text: body,
      kind: guessed,
      at: new Date(when).toISOString(),
      tags,
      source,
      voice: source === "voice" ? { seconds: Math.round(voiceSeconds.current), wave: savedWave.current } : undefined,
    };
    await new Promise((r) => setTimeout(r, 650));
    const err = await onAdd(input);
    setSaving(false);
    if (err) {
      setFolding(false);
      setError(err);
      return;
    }
    setText("");
    setTitle("");
    setKind(null);
    setSource("typed");
    setBurst(null);
    voiceSeconds.current = 0;
    savedWave.current = [];
    onClose();
  };

  const on = device();
  const keys = on === "mac" ? ["fn"] : ["Ctrl", "Win"];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="scrim scrim--diary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onPointerDown={(e) => e.target === e.currentTarget && !saving && onClose()}
        >
          <motion.form
            className="diary"
            role="dialog"
            aria-modal="true"
            aria-labelledby="diary-date"
            initial={{ opacity: 0, y: 60, rotateX: 8 }}
            animate={
              folding
                ? { opacity: 0, y: -260, scale: 0.08, borderRadius: 999, transition: { duration: 0.65, ease: [0.6, 0, 0.4, 1] } }
                : { opacity: 1, y: 0, rotateX: 0, scale: 1, transition: { type: "spring", stiffness: 220, damping: 26 } }
            }
            exit={{ opacity: 0, y: 30, transition: { duration: 0.2 } }}
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                if (voice.recording) voice.stop();
                else onClose();
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
          >
            <header className="diary__head">
              <h2 id="diary-date" className="diary__date">
                {formatWeekday(now)}, {formatDate(now)}
              </h2>
              <p className="diary__time">{formatTime(now)}</p>
              <AnimatePresence>
                {(source === "flow" || source === "voice") && (
                  <motion.p
                    className="diary__stamp"
                    initial={{ opacity: 0, scale: 1.6, rotate: -14 }}
                    animate={{ opacity: 1, scale: 1, rotate: -6 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 18 }}
                  >
                    Spoken
                  </motion.p>
                )}
              </AnimatePresence>
            </header>

            {blocked ? (
              <>
                <p className="diary__prompt">Your free week has ended. Subscribe for $1 a month to keep writing; everything you saved is still here.</p>
                <div className="panel__actions">
                  <button type="button" className="textbtn" onClick={onClose}>
                    Not now
                  </button>
                  <button type="button" className="primary" onClick={onSubscribe}>
                    Subscribe for $1 a month
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="sr-only" htmlFor="diary-text">
                  Your thought
                </label>
                <textarea
                  id="diary-text"
                  ref={area}
                  className="diary__page"
                  rows={5}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (!voice.recording) before.current = e.target.value;
                  }}
                  placeholder={prompt(now)}
                  maxLength={2000}
                />

                <div className="diary__voice">
                  <button
                    type="button"
                    className={`mic${voice.recording ? " is-on" : ""}`}
                    aria-pressed={voice.recording}
                    aria-label={voice.recording ? "Stop talking" : "Talk"}
                    disabled={!voice.supported && !voice.recording}
                    onPointerDown={() => {
                      if (voice.recording) {
                        press.current = { at: performance.now(), started: false };
                        return;
                      }
                      before.current = text;
                      press.current = { at: performance.now(), started: true };
                      void voice.start();
                    }}
                    onPointerUp={() => {
                      const p = press.current;
                      if (!p) return;
                      // Held down and let go: push-to-talk. A quick tap leaves it listening; the next tap stops.
                      if (!p.started || performance.now() - p.at > 450) voice.stop();
                    }}
                    onClick={() => {
                      if (press.current) {
                        press.current = null;
                        return;
                      }
                      // From the keyboard, Enter or Space toggles.
                      if (voice.recording) voice.stop();
                      else {
                        before.current = text;
                        void voice.start();
                      }
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
                      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                  <LiveWave live={voice.live} recording={voice.recording} />
                  <p className="diary__voice-note">
                    {voice.recording
                      ? `Listening · ${duration(voice.seconds)}`
                      : voice.supported
                        ? "Tap to talk, or hold and let go"
                        : "Speech isn’t available in this browser"}
                  </p>
                </div>
                {voice.recording && <p className="diary__fine">Your browser’s speech service turns this into words.</p>}
                {voice.error && <p className="panel__error">{voice.error}</p>}

                <div className="flow">
                  <p className="flow__line">
                    <span className="flow__name">Or talk with Wispr Flow.</span>{" "}
                    {on === "ios" ? (
                      "Switch to the Flow keyboard and tap to speak. It lands here, already tidy."
                    ) : on === "android" ? (
                      "Tap the Flow bubble by your keyboard and speak. It lands here, already tidy."
                    ) : (
                      <>
                        Click the page, hold{" "}
                        {keys.map((k, i) => (
                          <span key={k}>
                            {i > 0 && " + "}
                            <kbd>{k}</kbd>
                          </span>
                        ))}{" "}
                        and speak. Let go and it lands here, already tidy.
                      </>
                    )}
                  </p>
                  <AnimatePresence>
                    {askFlow && (
                      <motion.p className="flow__ask" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        That arrived all at once. Did it come from your voice?
                        <button type="button" className="inline-link" onClick={() => markFlow(true)}>
                          Yes, Wispr Flow
                        </button>
                        <button type="button" className="inline-link" onClick={() => markFlow(false)}>
                          No, I pasted it
                        </button>
                      </motion.p>
                    )}
                  </AnimatePresence>
                  {source === "flow" && burst && (
                    <motion.p className="flow__receipt" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {burst} words · about {duration((burst / SPEAK_WPM) * 60)} to say · about {duration((burst / TYPE_WPM) * 60)} to type
                      <button type="button" className="inline-link" onClick={() => setSource("typed")}>
                        Not spoken
                      </button>
                    </motion.p>
                  )}
                </div>

                {(tags.length > 0 || reading) && (
                  <p className="diary__hear" aria-live="polite">
                    <span className="diary__hear-label">I hear</span>
                    {tags
                      .filter((t) => tagKind(t) !== "theme")
                      .slice(0, 5)
                      .map((t) => (
                        <span key={t} className={`tag tag--${tagKind(t)}`}>
                          {tagName(t)}
                        </span>
                      ))}
                    {reading && (
                      <>
                        <span className="tag" style={{ color: EMOTION_COLOURS[reading.emotion] }}>
                          {EMOTION_NAMES[reading.emotion].toLowerCase()}
                        </span>
                        {reading.needs[0] && <span className="tag">needs {NEED_NAMES[reading.needs[0]].toLowerCase()}</span>}
                      </>
                    )}
                  </p>
                )}

                <details className="diary__details">
                  <summary>Topic, time and kind</summary>
                  <div className="composer__row">
                    <div>
                      <label className="field-label" htmlFor="diary-topic">
                        Topic
                      </label>
                      <input
                        id="diary-topic"
                        className="field"
                        list="diary-topics"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Today"
                        maxLength={40}
                      />
                      <datalist id="diary-topics">
                        {topics.map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="field-label" htmlFor="diary-when">
                        When
                      </label>
                      <input id="diary-when" className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                    </div>
                  </div>
                  <label className="field-label" htmlFor="diary-name">
                    A short name <span className="field-optional">(optional)</span>
                  </label>
                  <input id="diary-name" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
                  <fieldset className="composer__kinds">
                    <legend className="field-label">What kind of thought</legend>
                    {KINDS.map((k) => (
                      <label key={k} className="kind-chip" style={{ ["--kind" as string]: KIND_COLOURS[k] }}>
                        <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
                        <span className="kind-chip__dot" aria-hidden="true" />
                        {KIND_NAMES[k]}
                      </label>
                    ))}
                  </fieldset>
                </details>

                {error && <p className="panel__error">{error}</p>}
                <footer className="diary__foot">
                  <p className="diary__save-note">
                    {words > 0 ? `${words} ${words === 1 ? "word" : "words"} · ` : ""}
                    {saveNote}
                  </p>
                  <div className="panel__actions">
                    <button type="button" className="textbtn" onClick={onClose}>
                      Close
                    </button>
                    <button type="submit" className="primary" disabled={!text.trim() || saving}>
                      {saving ? "Keeping…" : "Keep this page"}
                    </button>
                  </div>
                </footer>
                <p className="diary__fine">Works with Wispr Flow. Not affiliated with Wispr.</p>
              </>
            )}
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
