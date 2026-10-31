import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { exampleMind, formatSpan, latestMoment, withinDays, tagKind, tagName, type Mind } from "./data/model";
import { connect } from "./data/connect";
import { buildWorld, makeSpiral, type World } from "./world/layout";
import { Engine } from "./world/Engine";
import { JourneyLabels } from "./ui/Journey";
import { HoverCard, TopicNames } from "./ui/Overview";
import { Announcer, BackChip, Intro, OverviewHeader, Progress, Stamp, Toast, TopBar, type Range } from "./ui/Hud";
import { JumpTo } from "./ui/JumpTo";
import { WhatsNewPanel, type NewsGroup } from "./ui/News";
import { AccountDialog } from "./ui/Account";
import { PRICE } from "./services/pricing";
import { Composer, type ComposerInput } from "./ui/Composer";
import { accessOf, loadProfile, supabase, type Profile } from "./services/supabase";
import { accountStore, deviceStore, type Store } from "./services/store";
import { subscribe } from "./services/billing";
import { topicQueries } from "./services/news";
import { KIND_COLOURS } from "./world/grade";
import { EMOTION_NAMES, NEED_NAMES, lensColour, type Lens } from "./data/lenses";
import { inLogic, insights, lensLinks, readExample, readOwn } from "./data/patterns";
import { LensBar, PatternsPanel } from "./ui/Lenses";

const example = readExample(exampleMind());
const exampleNow = latestMoment(example);
const spiral = makeSpiral();

interface View {
  base: number;
  current: number;
  focus: number | null;
  overview: boolean;
  flying: boolean;
}

type Back = { kind: "topic" | "thought"; id: string; label: string };

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // Whose thoughts, and how far back.
  const [source, setSource] = useState<"example" | "mine">("example");
  const [mine, setMine] = useState<Mind>({ topics: [], thoughts: [] });
  const [range, setRange] = useState<Range>(30);

  // Account.
  const [session, setSession] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const store: Store = useMemo(() => (session && supabase ? accountStore() : deviceStore), [session]);
  const access = profile ? accessOf(profile) : null;

  const visible = useMemo(() => {
    const base = source === "mine" ? readOwn(mine) : example;
    return withinDays(base, range, source === "mine" ? new Date() : exampleNow);
  }, [source, mine, range]);
  const world: World = useMemo(() => buildWorld(visible, connect(visible), spiral), [visible]);
  const worldRef = useRef(world);
  const pendingFocus = useRef<string | null>(null);

  const [engine, setEngine] = useState<Engine | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>({ base: 0, current: 0, focus: null, overview: true, flying: false });
  const [started, setStarted] = useState(false);
  const [moved, setMoved] = useState(false);
  const [back, setBack] = useState<Back | null>(null);
  const [panel, setPanel] = useState<"jump" | "news" | "compose" | "account" | "patterns" | null>(null);
  const [lens, setLens] = useState<Lens>("what");
  const [hover, setHover] = useState<{ hit: ReturnType<Engine["pick"]>; x: number; y: number }>({ hit: null, x: 0, y: 0 });
  const [toast, setToast] = useState<string | null>(null);

  const say = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 3200);
  }, []);

  // ------------------------------------------------------------------ the galaxy

  useEffect(() => {
    const el = host.current!;
    const cv = canvas.current!;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || matchMedia("(max-width: 700px)").matches;
    let engineRef: Engine | null = null;
    let off = () => {};
    const lost = () => setFailed(true);
    const root = el.closest(".app") ?? el;
    const wheel = (ev: Event) => {
      if ((ev.target as Element | null)?.closest(".scrim")) return;
      engineRef?.onWheel(ev as WheelEvent);
    };
    root.addEventListener("wheel", wheel, { passive: false });

    // Let the first frame paint the words before the galaxy is generated.
    const start = window.setTimeout(() => {
      let e: Engine;
      try {
        e = new Engine(cv, worldRef.current, { reducedMotion, lowPower });
      } catch {
        setFailed(true);
        return;
      }
      engineRef = e;
      setEngine(e);
      if (import.meta.env.DEV) (window as unknown as { __mind: Engine }).__mind = e;
      el.addEventListener("pointerdown", e.onPointerDown);
      el.addEventListener("pointermove", e.onPointerMove);
      el.addEventListener("pointerup", e.onPointerUp);
      el.addEventListener("pointercancel", e.onPointerUp);
      cv.addEventListener("webglcontextlost", lost);
      let last: View = { base: -1, current: -1, focus: null, overview: true, flying: false };
      off = e.subscribe((f) => {
        const next: View = { base: Math.max(0, Math.floor(f.p)), current: f.current, focus: f.focus, overview: f.overview > 0.5, flying: f.flying };
        if (
          next.base !== last.base ||
          next.current !== last.current ||
          next.focus !== last.focus ||
          next.overview !== last.overview ||
          next.flying !== last.flying
        ) {
          last = next;
          setView(next);
        }
      });
    }, 30);

    return () => {
      window.clearTimeout(start);
      root.removeEventListener("wheel", wheel);
      const e = engineRef;
      if (!e) return;
      el.removeEventListener("pointerdown", e.onPointerDown);
      el.removeEventListener("pointermove", e.onPointerMove);
      el.removeEventListener("pointerup", e.onPointerUp);
      el.removeEventListener("pointercancel", e.onPointerUp);
      cv.removeEventListener("webglcontextlost", lost);
      off();
      e.dispose();
      setEngine(null);
    };
  }, []);

  // A different mind or date range: rebuild the stars, then go where we meant to.
  useEffect(() => {
    if (!engine || worldRef.current === world) return;
    const keep = worldRef.current.topics[view.current]?.topic.id;
    worldRef.current = world;
    engine.setWorld(world, keep);
    const id = pendingFocus.current;
    pendingFocus.current = null;
    const target = id ? world.thoughtById.get(id) : undefined;
    if (target) window.setTimeout(() => engine.focusThought(target.index), 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, world]);

  // The lens: how stars are coloured and which threads are drawn.
  const logicSet = useMemo(() => inLogic(visible.logic), [visible]);
  const colours = useMemo(
    () => world.thoughts.map((n) => lensColour(lens, n.thought, logicSet.has(n.thought.id), KIND_COLOURS[n.thought.kind])),
    [world, lens, logicSet],
  );
  useEffect(() => {
    if (!engine) return;
    engine.setStyle(lens === "what" ? null : { colours, links: lensLinks(world, visible.logic, lens), across: 0.3 });
    // Re-applied whenever the mind or the lens changes; runs after setWorld above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, world, lens]);
  const found = useMemo(() => insights(visible, world), [visible, world]);
  const readBy = useMemo(() => {
    if (source === "example") return "The example month was read by hand through all six lenses.";
    const byClaude = visible.thoughts.filter((t) => t.reading?.by === "claude").length;
    return byClaude
      ? `${byClaude} of ${visible.thoughts.length} thoughts were read by Claude; the rest by simple rules on this device.`
      : "Read by simple rules on this device. With an account, Claude reads each thought more deeply.";
  }, [source, visible]);

  useEffect(() => {
    if (!view.overview) setStarted(true);
  }, [view.overview]);

  const firstTopic = useRef<number | null>(null);
  useEffect(() => {
    if (view.overview) return;
    if (firstTopic.current === null) firstTopic.current = view.current;
    else if (view.current !== firstTopic.current) setMoved(true);
    const topic = world.topics[view.current];
    const thought = view.focus !== null ? world.thoughts[view.focus] : null;
    if (topic) history.replaceState(null, "", `#${thought ? thought.thought.id : topic.topic.id}`);
  }, [view.current, view.focus, view.overview, world]);

  // Deep links: #ajji or #mom-and-dad/booked-it
  useEffect(() => {
    if (!engine) return;
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const w = worldRef.current;
    const thought = w.thoughtById.get(id);
    const topic = w.topicById.get(id);
    window.setTimeout(() => {
      if (thought) engine.enterJourney(thought.topic, thought.index);
      else if (topic) engine.enterJourney(topic.index);
    }, 700);
  }, [engine]);

  // ------------------------------------------------------------------ account

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setSession(u ? { id: u.id, email: u.email ?? "" } : null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s?.user ? { id: s.user.id, email: s.user.email ?? "" } : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let live = true;
    store
      .load()
      .then((m) => live && setMine(m))
      .catch(() => live && setMine({ topics: [], thoughts: [] }));
    if (session) loadProfile().then((p) => live && setProfile(p));
    else setProfile(null);
    return () => {
      live = false;
    };
  }, [store, session]);

  const startSubscription = useCallback(async (): Promise<string | null> => {
    const outcome = await subscribe(session?.email);
    if (outcome === "paid") {
      setProfile(await loadProfile());
      setPanel(null);
      say("You’re a member. Thank you.");
      return null;
    }
    if (outcome === "unavailable") return "Payments aren’t connected in this preview yet.";
    if (outcome === "error") return "Couldn’t start the payment. Please try again in a moment.";
    return null;
  }, [session, say]);

  // ------------------------------------------------------------------ navigation

  const home = useCallback(() => {
    engine?.enterOverview();
    setStarted(false);
    setBack(null);
    setPanel(null);
    history.replaceState(null, "", location.pathname + location.search);
  }, [engine]);

  const rememberHere = useCallback(() => {
    if (view.overview) return;
    if (view.focus !== null) {
      const t = world.thoughts[view.focus];
      if (t) setBack({ kind: "thought", id: t.thought.id, label: `“${t.thought.title}”` });
    } else {
      const t = world.topics[view.current];
      if (t) setBack({ kind: "topic", id: t.topic.id, label: t.topic.name });
    }
  }, [view, world]);

  const openThought = useCallback(
    (i: number) => {
      if (!engine) return;
      const node = world.thoughts[i];
      if (node && node.topic !== view.current) rememberHere();
      engine.focusThought(i);
    },
    [engine, world, view.current, rememberHere],
  );

  const goTopic = useCallback(
    (i: number) => {
      if (!engine) return;
      if (Math.abs(i - view.current) > 2) rememberHere();
      engine.goToTopic(i);
    },
    [engine, view.current, rememberHere],
  );

  const goBack = useCallback(() => {
    if (!engine || !back) return;
    if (back.kind === "thought") {
      const t = world.thoughtById.get(back.id);
      if (t) engine.focusThought(t.index);
    } else {
      const t = world.topicById.get(back.id);
      if (t) engine.goToTopic(t.index);
    }
    setBack(null);
  }, [engine, back, world]);

  const toggleOverview = useCallback(() => {
    if (!engine) return;
    if (engine.inOverview) engine.enterJourney();
    else engine.enterOverview();
  }, [engine]);

  useEffect(() => {
    if (!engine) return;
    const onKey = (e: KeyboardEvent) => {
      if (panel) return;
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowDown":
        case "PageDown":
        case "j":
          engine.step(1);
          break;
        case " ":
          if (target?.tagName === "BUTTON" || target?.tagName === "A") return;
          engine.step(e.shiftKey ? -1 : 1);
          break;
        case "ArrowUp":
        case "PageUp":
        case "k":
          engine.step(-1);
          break;
        case "/":
          setPanel("jump");
          break;
        case "o":
        case "O":
          toggleOverview();
          break;
        case "Escape":
          if (engine.focused !== null) engine.focusThought(null);
          else if (!engine.inOverview) engine.enterOverview();
          break;
        case "n":
        case "N":
          setPanel("compose");
          break;
        case "b":
        case "B":
          goBack();
          break;
        case "Home":
          home();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, panel, toggleOverview, goBack, home]);

  // In the overview, the star under the pointer can be opened.
  const onHostMove = (e: React.PointerEvent) => {
    if (!engine || !view.overview || !started) {
      if (hover.hit) setHover({ hit: null, x: 0, y: 0 });
      return;
    }
    const r = host.current!.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const hit = engine.pick(x, y);
    if (hit || hover.hit) setHover({ hit, x, y });
  };
  const onHostClick = () => {
    if (!engine || !view.overview || engine.clickSuppressed() || !hover.hit) return;
    if (hover.hit.kind === "thought") engine.focusThought(hover.hit.index);
    else engine.enterJourney(hover.hit.index);
    setHover({ hit: null, x: 0, y: 0 });
  };

  // ------------------------------------------------------------------ writing

  const addThought = useCallback(
    async (input: ComposerInput): Promise<string | null> => {
      try {
        const { mind: next, id, read } = await store.add(input);
        const at = new Date(input.at).getTime();
        if (range && at < Date.now() - range * 86400000) setRange(null);
        pendingFocus.current = id;
        setMine(next);
        setSource("mine");
        say(`Added to “${input.topicName}”.`);
        void read?.then((m) => {
          const r = m?.thoughts.find((t) => t.id === id)?.reading;
          if (!m || !r) return;
          setMine(m);
          const need = r.needs[0] ? `, reaching for ${NEED_NAMES[r.needs[0]].toLowerCase()}` : "";
          say(`Claude read it: ${EMOTION_NAMES[r.emotion].toLowerCase()}${need}.`);
        });
        return null;
      } catch {
        if (access?.state === "ended") return "Your free week has ended. Subscribe to keep adding thoughts.";
        return "Couldn’t save that just now. Please try again.";
      }
    },
    [store, range, access, say],
  );

  const people = useMemo(() => {
    const set = new Set<string>();
    for (const m of [example, mine]) for (const t of m.thoughts) for (const g of t.tags) if (tagKind(g) === "person") set.add(tagName(g));
    return [...set];
  }, [mine]);

  const newsGroups = useMemo<NewsGroup[]>(() => {
    const groups = new Map<string, NewsGroup>();
    for (const node of world.topics) {
      const own = node.thoughts.map((i) => world.thoughts[i].thought);
      for (const q of topicQueries(node.topic, own)) {
        const g = groups.get(q) ?? { query: q, topics: [] };
        if (!g.topics.some((t) => t.index === node.index)) g.topics.push({ index: node.index, name: node.topic.name });
        groups.set(q, g);
      }
    }
    return [...groups.values()].sort((a, b) => b.topics.length - a.topics.length).slice(0, 14);
  }, [world]);

  if (failed) return <Fallback mind={visible} />;

  // For one render after the mind changes, the engine's last frame still points into the old one.
  const current = Math.max(0, Math.min(view.current, world.topics.length - 1));
  const focus = view.focus !== null && world.thoughts[view.focus] ? view.focus : null;
  const topicNode = world.topics[current];
  const focusNode = focus !== null ? world.thoughts[focus] : null;
  const span = world.thoughts.length
    ? formatSpan(world.thoughts.reduce((a, t) => (t.thought.at < a ? t.thought.at : a), world.thoughts[0].thought.at), world.topics.reduce((a, t) => (t.last > a ? t.last : a), ""))
    : "";
  const accountLabel = session
    ? { label: access?.state === "trial" ? `${access.daysLeft} free ${access.daysLeft === 1 ? "day" : "days"} left` : access?.state === "ended" ? "Subscribe" : "Account" }
    : null;
  const backTitle = back && !view.overview && back.id !== (focusNode?.thought.id ?? topicNode?.topic.id) ? back.label : null;
  const empty = world.topics.length === 0;

  return (
    <main className={`app${view.overview ? " is-overview" : ""}${hover.hit ? " is-pointing" : ""}`}>
      <div className="sky" ref={host} onPointerMove={onHostMove} onClick={onHostClick}>
        <canvas ref={canvas} className="sky__canvas" aria-hidden="true" />
        {engine && started && !empty && (
          <>
            <JourneyLabels
              engine={engine}
              world={world}
              current={current}
              focus={focus}
              lens={lens}
              logic={visible.logic}
              colours={colours}
              onOpen={openThought}
            />
            <TopicNames engine={engine} world={world} active={started} onPick={(i) => engine.enterJourney(i)} />
            {view.overview && <HoverCard world={world} hit={hover.hit} x={hover.x} y={hover.y} />}
          </>
        )}
      </div>

      <TopBar
        account={accountLabel}
        mine={!!session || mine.thoughts.length > 0}
        source={source}
        onHome={home}
        onJump={() => setPanel("jump")}
        onNews={() => setPanel("news")}
        onPatterns={() => setPanel("patterns")}
        onCompose={() => setPanel("compose")}
        onAccount={() => setPanel("account")}
        onSource={(s) => {
          setSource(s);
          setBack(null);
        }}
      />

      <AnimatePresence>
        {view.overview && !started && (
          <Intro
            key="intro"
            mine={source === "mine"}
            topics={world.topics.length}
            thoughts={world.thoughts.length}
            span={span}
            onBegin={() => engine?.enterJourney(0)}
            onJump={() => setPanel("jump")}
            onCompose={() => setPanel("compose")}
          />
        )}
        {view.overview && started && (
          <OverviewHeader
            key="ov"
            title={
              empty
                ? source === "mine" && !mine.thoughts.length
                  ? "Your mind is empty for now"
                  : "Nothing in this range"
                : range
                  ? `${source === "mine" ? "Your" : "The"} last ${range} days`
                  : source === "mine"
                    ? "Your whole mind"
                    : "The whole month"
            }
            range={range}
            onRange={setRange}
            backTo={!empty && topicNode ? topicNode.topic.name : null}
            onBack={() => engine?.enterJourney()}
          />
        )}
      </AnimatePresence>

      {!view.overview && !empty && (
        <>
          <Stamp iso={focusNode ? focusNode.thought.at : topicNode?.last ?? null} where={topicNode?.topic.name ?? ""} />
          <Progress current={current} total={world.topics.length} hint={!moved} />
          <BackChip title={backTitle} onBack={goBack} />
          <Announcer
            text={
              focusNode
                ? `${focusNode.thought.title}. ${focusNode.thought.text}`
                : topicNode
                  ? `${topicNode.topic.name}: ${topicNode.thoughts.length} thoughts. ${topicNode.thoughts.map((i) => world.thoughts[i].thought.title).join(", ")}.`
                  : ""
            }
          />
        </>
      )}

      <JumpTo
        open={panel === "jump"}
        world={world}
        current={current}
        onClose={() => setPanel(null)}
        onTopic={(i) => (view.overview ? engine?.enterJourney(i) : goTopic(i))}
        onThought={openThought}
      />
      <WhatsNewPanel
        open={panel === "news"}
        groups={newsGroups}
        onClose={() => setPanel(null)}
        onTopic={(i) => {
          setPanel(null);
          if (view.overview) engine?.enterJourney(i);
          else goTopic(i);
        }}
      />
      <AccountDialog
        open={panel === "account"}
        email={session?.email ?? null}
        access={access}
        onClose={() => setPanel(null)}
        onSubscribe={startSubscription}
        onRefresh={() => {
          if (session) void loadProfile().then((p) => setProfile(p));
        }}
        onSignOut={() => {
          supabase?.auth.signOut();
          setSource("example");
          setPanel(null);
          say("Signed out.");
        }}
      />
      <Composer
        open={panel === "compose"}
        topics={mine.topics.map((t) => t.name)}
        people={people}
        saveNote={
          session
            ? "It joins your mind, saved to your account. Claude reads it for patterns."
            : `Saved on this device for now. Sign up to keep your mind everywhere: free for 7 days, then ${PRICE}.`
        }
        blocked={!!session && access?.state === "ended"}
        onClose={() => setPanel(null)}
        onAdd={addThought}
        onSubscribe={() => setPanel("account")}
      />
      <PatternsPanel
        open={panel === "patterns"}
        insights={found}
        world={world}
        readBy={readBy}
        onClose={() => setPanel(null)}
        onEvidence={(l, id) => {
          setPanel(null);
          setLens(l);
          const t = world.thoughtById.get(id);
          if (t) openThought(t.index);
        }}
      />
      {started && !empty && (
        <LensBar lens={lens} onLens={setLens} />
      )}
      <Toast text={toast} />
    </main>
  );
}

function Fallback({ mind }: { mind: Mind }) {
  return (
    <main className="fallback">
      <h1>A month, inside one mind</h1>
      <p>This browser couldn’t start the 3D galaxy, so here are the same thoughts as a list.</p>
      {mind.topics.map((topic) => (
        <section key={topic.id}>
          <h2>{topic.name}</h2>
          <ul>
            {mind.thoughts
              .filter((t) => t.topicId === topic.id)
              .map((t) => (
                <li key={t.id}>
                  <strong>{t.title}.</strong> {t.text}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
