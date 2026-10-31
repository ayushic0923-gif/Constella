import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { animate, type AnimationPlaybackControls } from "motion";
import { DISC_RADIUS, openness, openPosition, type World } from "./layout";
import { buildClouds, buildFarStars, buildGalaxyStars, buildNearStars } from "./sky";
import { buildCloudAtlas } from "./textures";
import { KIND_COLOURS, gradeAt } from "./grade";
import {
  cloudFragment,
  cloudVertex,
  farStarFragment,
  farStarVertex,
  galaxyStarFragment,
  galaxyStarVertex,
  gradeShader,
  linkFragment,
  linkVertex,
  nearStarFragment,
  nearStarVertex,
  pathFragment,
  pathVertex,
  thoughtFragment,
  thoughtVertex,
} from "./shaders";

export interface Frame {
  /** 0 = travelling between topics, 1 = looking at the whole galaxy. */
  overview: number;
  /** Position along the journey, in topics. */
  p: number;
  /** The topic you're at. */
  current: number;
  /** The thought you're looking at closely, if any. */
  focus: number | null;
  /** The thought under the pointer or a finger, if any. */
  hover: number | null;
  flying: boolean;
  /** A finger is moving the journey, or it is still gliding after a flick. */
  dragging: boolean;
  /** Minutes since midnight of what you're looking at (drives the sky). */
  minutes: number;
  /** Per topic: screen x, screen y, 1 if in front, distance. */
  topicScreen: Float32Array;
  /** Per thought: screen x, screen y, 1 if in front, how open its ring is. */
  thoughtScreen: Float32Array;
  speed: number;
  width: number;
  height: number;
  dt: number;
}

interface Pose {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

const UP = new THREE.Vector3(0, 0, 1);
const NEAR_TILE = 1500;
/** How far one pixel of finger travel moves the journey, in topics. */
const SWIPE_PER_PX = 0.0065;
/** Each frame (at 60 fps) a flick keeps this much of its speed. */
const GLIDE_KEEP = 0.92;
/** Points along each filament arc. */
const FIL_SEG = 24;
const FIL_MAX = 3;
const TOPIC_COLOUR = "#fff0d4";

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const newPose = (): Pose => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 55 });

export class Engine {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.5, 400000);
  private world: World;
  private reduced: boolean;

  private u = {
    time: { value: 0 },
    motion: { value: 1 },
    pixelRatio: { value: 1 },
    overview: { value: 1 },
    p: { value: 0 },
    focus: { value: -1 },
    hover: { value: -1 },
    chain: { value: 0 },
    across: { value: 0.09 },
  };
  /** How the current lens colours thoughts and which threads it draws. */
  private style: { colours: string[]; links: { a: number; b: number; colour: string; strength: number; across: boolean }[]; across: number } | null = null;
  /** Connections appear once the journey has begun. */
  private chainGoal = 0;

  private galaxyMat!: THREE.ShaderMaterial;
  private nearMat!: THREE.ShaderMaterial;
  private thoughtPoints: THREE.Points | null = null;
  private pathLine: THREE.LineSegments | null = null;
  private linkLines: THREE.LineSegments | null = null;

  // Journey state
  private p = 0;
  private pGoal = 0;
  private currentTopic = 0;
  private focus: number | null = null;
  private wheelTimer = 0;
  private wheelDir = 1;
  private yaw = 0;
  private pitch = 0;
  private yawGoal = 0;
  private pitchGoal = 0;

  // Overview state
  private overview = 1;
  private overviewGoal = 1;
  private ovAzimuth = -0.6;
  private ovElevation = 0.95;
  private ovDistance = 21000;

  private flight: { from: Pose; to: () => Pose; t: number; dur: number; lift: number; done: () => void } | null = null;
  private blendAnim: AnimationPlaybackControls | null = null;

  private pose: Pose = newPose();
  private lastCam = new THREE.Vector3();
  private velocity = new THREE.Vector3();
  private flow = new THREE.Vector3();
  private width = 1;
  private height = 1;
  private raf = 0;
  private last = 0;
  private disposed = false;
  private listeners = new Set<(f: Frame) => void>();
  private frame: Frame;
  private resizeObserver: ResizeObserver;
  private slowFrames = 0;
  private quality = 2;

  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  private dragAxis: "none" | "look" | "swipe" = "none";
  private dragged = false;
  private suppressClickUntil = 0;
  private swipeAccum = 0;
  // Touch: the finger moves the journey directly, then a flick glides and slows to a stop.
  private touchDrag = false;
  private gliding = false;
  private touchVel = 0; // topics per second
  private lastMoveAt = 0;
  private downAt = 0;
  private resizeTimer = 0;

  // Filaments: the active thought's closest relations, drawn as glowing arcs.
  private filamentLine!: THREE.LineSegments;
  private filamentMat!: THREE.LineBasicMaterial;
  private filamentSource: ((thought: number) => number[]) | null = null;
  private filamentFrom: number | null = null;
  private filamentTo: number[] = [];
  private filamentAlpha = 0;

  constructor(canvas: HTMLCanvasElement, world: World, opts: { reducedMotion: boolean; lowPower: boolean }) {
    this.canvas = canvas;
    this.world = world;
    this.reduced = opts.reducedMotion;
    this.u.motion.value = this.reduced ? 0 : 1;
    if (opts.lowPower) this.quality = 1;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 1);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.32, 0.9);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(gradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    this.buildSky(opts.lowPower ? 0.55 : 1);
    this.buildThoughts();

    this.frame = {
      overview: 1,
      p: 0,
      current: 0,
      focus: null,
      hover: null,
      flying: false,
      dragging: false,
      minutes: 0,
      topicScreen: new Float32Array(world.topics.length * 4),
      thoughtScreen: new Float32Array(world.thoughts.length * 4),
      speed: 0,
      width: 1,
      height: 1,
      dt: 0,
    };

    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(FIL_MAX * FIL_SEG * 2 * 3), 3));
    fg.setDrawRange(0, 0);
    this.filamentMat = new THREE.LineBasicMaterial({
      color: new THREE.Color("#f9a3c0"),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.filamentLine = new THREE.LineSegments(fg, this.filamentMat);
    this.filamentLine.frustumCulled = false;
    this.filamentLine.renderOrder = 5;
    this.scene.add(this.filamentLine);

    this.resizeObserver = new ResizeObserver(() => {
      // On phones the address bar slides in and out as you move. Resizing the canvas on every
      // step of that makes it jitter, so a height-only change waits until the bar has settled.
      const host = canvas.parentElement ?? canvas;
      if (matchMedia("(pointer: coarse)").matches && host.clientWidth === this.width && Math.abs(host.clientHeight - this.height) < 160) {
        window.clearTimeout(this.resizeTimer);
        this.resizeTimer = window.setTimeout(() => this.resize(), 180);
        return;
      }
      this.resize();
    });
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.overviewPose(this.pose);
    this.lastCam.copy(this.pose.pos);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  // ---------------------------------------------------------------- building

  private add(obj: THREE.Object3D, order: number) {
    obj.renderOrder = order;
    obj.frustumCulled = false;
    this.scene.add(obj);
    return obj;
  }

  private buildSky(density: number) {
    const u = this.u;
    const atlas = buildCloudAtlas();
    const spiral = this.world.spiral;

    this.add(
      new THREE.Points(
        buildFarStars(Math.round(5000 * density)),
        new THREE.ShaderMaterial({
          vertexShader: farStarVertex,
          fragmentShader: farStarFragment,
          uniforms: { uPixelRatio: u.pixelRatio },
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          transparent: true,
        }),
      ),
      0,
    );

    this.galaxyMat = new THREE.ShaderMaterial({
      vertexShader: galaxyStarVertex,
      fragmentShader: galaxyStarFragment,
      uniforms: { uPixelRatio: u.pixelRatio, uRef: { value: 420 }, uFloor: { value: 0.002 }, uGain: { value: 1 } },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.add(new THREE.Points(buildGalaxyStars(spiral, Math.round(190000 * density)), this.galaxyMat), 1);

    const clouds = buildClouds(spiral, this.world.topics.map((t) => t.pos), density);
    const cloudMat = (dust: boolean) =>
      new THREE.ShaderMaterial({
        vertexShader: cloudVertex,
        fragmentShader: cloudFragment,
        uniforms: { uAtlas: { value: atlas }, uDust: { value: dust ? 1 : 0 }, uTime: u.time, uMotion: u.motion },
        blending: dust ? THREE.NormalBlending : THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      });
    this.add(new THREE.Mesh(clouds.glow, cloudMat(false)), 2);
    this.add(new THREE.Mesh(clouds.dust, cloudMat(true)), 3);

    this.nearMat = new THREE.ShaderMaterial({
      vertexShader: nearStarVertex,
      fragmentShader: nearStarFragment,
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uVel: { value: new THREE.Vector3() },
        uFlow: { value: new THREE.Vector3() },
        uTile: { value: NEAR_TILE },
        uTrail: { value: this.reduced ? 0 : 0.045 },
        uPixelRatio: u.pixelRatio,
        uViewport: { value: new THREE.Vector2(1, 1) },
        uVisible: { value: 0 },
      },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.add(new THREE.Mesh(buildNearStars(Math.round(4200 * density), NEAR_TILE), this.nearMat), 4);
  }

  /** Topics, their thoughts, the path between topics and every connection. Rebuilt when the mind changes. */
  private buildThoughts() {
    for (const o of [this.thoughtPoints, this.pathLine, this.linkLines]) {
      if (!o) continue;
      this.scene.remove(o);
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
    const u = this.u;
    const { topics, thoughts } = this.world;

    // Stars: one per topic, one per thought.
    const n = topics.length + thoughts.length;
    const f = (k: number) => new Float32Array(Math.max(1, n) * k);
    const pos = f(3), center = f(3), rest = f(3), color = f(3), topicIdx = f(1), isTopic = f(1), index = f(1), voice = f(1);
    let k = 0;
    const topicColour = new THREE.Color(TOPIC_COLOUR);
    for (const t of topics) {
      pos.set(t.pos.toArray(), k * 3);
      center.set(t.pos.toArray(), k * 3);
      rest.set(t.pos.toArray(), k * 3);
      color.set([topicColour.r, topicColour.g, topicColour.b], k * 3);
      topicIdx[k] = t.index;
      isTopic[k] = 1;
      index[k] = -1;
      k++;
    }
    for (const th of thoughts) {
      const c = new THREE.Color(this.style?.colours[th.index] ?? KIND_COLOURS[th.thought.kind]);
      const centre = topics[th.topic].pos;
      pos.set(th.rest.toArray(), k * 3);
      center.set(centre.toArray(), k * 3);
      rest.set(th.rest.toArray(), k * 3);
      color.set([c.r, c.g, c.b], k * 3);
      topicIdx[k] = th.topic;
      isTopic[k] = 0;
      index[k] = th.index;
      voice[k] = th.thought.source === "voice" || th.thought.source === "flow" ? 1 : 0;
      k++;
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    tg.setAttribute("aCenter", new THREE.BufferAttribute(center, 3));
    tg.setAttribute("aRest", new THREE.BufferAttribute(rest, 3));
    tg.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    tg.setAttribute("aTopic", new THREE.BufferAttribute(topicIdx, 1));
    tg.setAttribute("aIsTopic", new THREE.BufferAttribute(isTopic, 1));
    tg.setAttribute("aIndex", new THREE.BufferAttribute(index, 1));
    tg.setAttribute("aVoice", new THREE.BufferAttribute(voice, 1));
    tg.setDrawRange(0, n);
    this.thoughtPoints = this.add(
      new THREE.Points(
        tg,
        new THREE.ShaderMaterial({
          vertexShader: thoughtVertex,
          fragmentShader: thoughtFragment,
          uniforms: {
            uPixelRatio: u.pixelRatio,
            uP: u.p,
            uOverview: u.overview,
            uFocus: u.focus,
            uHover: u.hover,
            uTime: u.time,
            uMotion: u.motion,
          },
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          transparent: true,
        }),
      ),
      7,
    ) as THREE.Points;

    const accent = new THREE.Color("#f9a3c0");

    // The path between topics: the way the journey goes.
    const pathPos: number[] = [];
    const pathIdx: number[] = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const sub = 24;
    for (let i = 0; i < topics.length - 1; i++) {
      for (let s = 0; s < sub; s++) {
        const t0 = i + s / sub;
        const t1 = i + (s + 1) / sub;
        this.pathPoint(t0, a);
        this.pathPoint(t1, b);
        pathPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        pathIdx.push(t0, t1);
      }
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.Float32BufferAttribute(pathPos.length ? pathPos : [0, 0, 0, 0, 0, 0], 3));
    pg.setAttribute("aIndex", new THREE.Float32BufferAttribute(pathIdx.length ? pathIdx : [0, 0], 1));
    this.pathLine = this.add(
      new THREE.LineSegments(
        pg,
        new THREE.ShaderMaterial({
          vertexShader: pathVertex,
          fragmentShader: pathFragment,
          uniforms: { uColor: { value: accent }, uP: u.p, uOverview: u.overview, uChain: u.chain, uTime: u.time, uMotion: u.motion },
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          transparent: true,
        }),
      ),
      5,
    ) as THREE.LineSegments;

    // Connections.
    const L = {
      A: [] as number[], Ar: [] as number[], B: [] as number[], Br: [] as number[],
      topics: [] as number[], ends: [] as number[], t: [] as number[], lift: [] as number[],
      kind: [] as number[], strength: [] as number[], pos: [] as number[], color: [] as number[],
    };
    const tint = new THREE.Color();
    const curve = (
      A: THREE.Vector3, Ar: THREE.Vector3, B: THREE.Vector3, Br: THREE.Vector3,
      ta: number, tb: number, ea: number, eb: number, kind: number, lift: number, strength: number, segments: number,
      colour = "#e6dcf0",
    ) => {
      tint.set(colour);
      for (let s = 0; s < segments; s++) {
        for (const t of [s / segments, (s + 1) / segments]) {
          L.A.push(A.x, A.y, A.z);
          L.Ar.push(Ar.x, Ar.y, Ar.z);
          L.B.push(B.x, B.y, B.z);
          L.Br.push(Br.x, Br.y, Br.z);
          L.topics.push(ta, tb);
          L.ends.push(ea, eb);
          L.t.push(t);
          L.lift.push(lift);
          L.kind.push(kind);
          L.strength.push(strength);
          L.pos.push(0, 0, 0);
          L.color.push(tint.r, tint.g, tint.b);
        }
      }
    };
    for (const t of topics) {
      for (const i of t.thoughts) curve(t.pos, t.pos, t.pos, thoughts[i].rest, t.index, t.index, -1, i, 0, 0, 1, 6);
    }
    // Threads between thoughts: what they share by default, or whatever the lens reads.
    const links =
      this.style?.links ??
      this.world.links.map((l) => ({ a: l.a, b: l.b, colour: l.across ? "#f9a3c0" : "#e6dcf0", strength: Math.min(1, l.weight / 5), across: l.across }));
    for (const l of links) {
      const A = thoughts[l.a];
      const B = thoughts[l.b];
      if (!A || !B) continue;
      const ta = topics[A.topic];
      const tb = topics[B.topic];
      if (!l.across) {
        curve(ta.pos, A.rest, tb.pos, B.rest, A.topic, B.topic, l.a, l.b, 1, 22, l.strength, 14, l.colour);
      } else {
        const d = A.rest.distanceTo(B.rest);
        curve(ta.pos, A.rest, tb.pos, B.rest, A.topic, B.topic, l.a, l.b, 2, Math.min(3200, 120 + d * 0.3), l.strength, 40, l.colour);
      }
    }
    if (!this.style || this.style.across < 0.15) {
      for (const l of this.world.topicLinks) {
        const A = topics[l.a].pos;
        const B = topics[l.b].pos;
        const d = A.distanceTo(B);
        curve(A, A, B, B, l.a, l.b, -1, -1, 3, Math.min(3800, 160 + d * 0.32), l.strength, 40, "#f9a3c0");
      }
    }
    const lg = new THREE.BufferGeometry();
    const attr = (arr: number[], size: number) => new THREE.Float32BufferAttribute(arr.length ? arr : new Array(size * 2).fill(0), size);
    lg.setAttribute("position", attr(L.pos, 3));
    lg.setAttribute("aA", attr(L.A, 3));
    lg.setAttribute("aAr", attr(L.Ar, 3));
    lg.setAttribute("aB", attr(L.B, 3));
    lg.setAttribute("aBr", attr(L.Br, 3));
    lg.setAttribute("aTopics", attr(L.topics, 2));
    lg.setAttribute("aEnds", attr(L.ends, 2));
    lg.setAttribute("aT", attr(L.t, 1));
    lg.setAttribute("aLift", attr(L.lift, 1));
    lg.setAttribute("aKind", attr(L.kind, 1));
    lg.setAttribute("aStrength", attr(L.strength, 1));
    lg.setAttribute("aColor", attr(L.color, 3));
    this.linkLines = this.add(
      new THREE.LineSegments(
        lg,
        new THREE.ShaderMaterial({
          vertexShader: linkVertex,
          fragmentShader: linkFragment,
          uniforms: {
            uP: u.p,
            uOverview: u.overview,
            uFocus: u.focus,
            uHover: u.hover,
            uChain: u.chain,
            uTime: u.time,
            uMotion: u.motion,
            uAccent: { value: accent },
            uAcross: u.across,
          },
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          transparent: true,
        }),
      ),
      6,
    ) as THREE.LineSegments;
  }

  /** A point on the journey at fractional topic index t (Catmull-Rom through topic centres). */
  private pathPoint(t: number, out: THREE.Vector3): THREE.Vector3 {
    const pts = this.world.topics;
    const n = pts.length;
    if (n === 0) return out.set(0, 0, 0);
    if (n === 1) return out.copy(pts[0].pos);
    const tc = Math.min(n - 1, Math.max(0, t));
    const i = Math.min(n - 2, Math.floor(tc));
    const s = tc - i;
    const p0 = pts[Math.max(0, i - 1)].pos;
    const p1 = pts[i].pos;
    const p2 = pts[i + 1].pos;
    const p3 = pts[Math.min(n - 1, i + 2)].pos;
    const s2 = s * s;
    const s3 = s2 * s;
    const f = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s2 + (-a + 3 * b - 3 * c + d) * s3);
    return out.set(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z));
  }

  /** Re-colour the thoughts and redraw the threads for a lens, without moving anything. */
  setStyle(style: { colours: string[]; links: { a: number; b: number; colour: string; strength: number; across: boolean }[]; across: number } | null) {
    this.style = style;
    this.u.across.value = style?.across ?? 0.09;
    this.buildThoughts();
  }

  /** Swap in a different mind (another date range, or your own), keeping your place if it still exists. */
  setWorld(world: World, keepTopicId?: string) {
    const keep = keepTopicId ?? this.world.topics[this.currentTopic]?.topic.id;
    this.world = world;
    // The lens style points into the old mind; the app re-applies it for the new one.
    this.style = null;
    this.u.across.value = 0.09;
    this.buildThoughts();
    this.frame.topicScreen = new Float32Array(world.topics.length * 4);
    this.frame.thoughtScreen = new Float32Array(world.thoughts.length * 4);
    const i = keep ? world.topicById.get(keep)?.index ?? 0 : 0;
    this.p = this.pGoal = Math.min(i, Math.max(0, world.topics.length - 1));
    this.currentTopic = Math.round(this.p);
    this.focus = null;
    this.u.focus.value = -1;
    this.u.hover.value = -1;
    this.gliding = false;
    this.touchVel = 0;
    this.filamentFrom = null;
    this.filamentTo = [];
  }

  /** Who the active thought's filaments reach: up to three thought indices, closest first. */
  setFilamentSource(source: ((thought: number) => number[]) | null) {
    this.filamentSource = source;
    this.filamentFrom = null;
    this.filamentTo = [];
  }

  // ---------------------------------------------------------------- poses

  private topicPose(p: number, out: Pose): Pose {
    const n = this.world.topics.length;
    const at = this.pathPoint(p, new THREE.Vector3());
    const fwd = new THREE.Vector3();
    if (n > 1) {
      this.pathPoint(Math.min(n - 1, p + 0.4), fwd);
      fwd.sub(this.pathPoint(Math.max(0, p - 0.4), new THREE.Vector3()));
    }
    if (fwd.lengthSq() < 1) fwd.copy(this.world.topics[Math.round(Math.min(n - 1, Math.max(0, p)))]?.fwd ?? new THREE.Vector3(1, 0, 0));
    fwd.z *= 0.3;
    fwd.normalize();
    const side = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    const t = this.u.time.value;
    const bob = this.reduced ? 0 : 1;
    out.pos
      .copy(at)
      .addScaledVector(fwd, -560 * this.narrow())
      .addScaledVector(UP, 40 + Math.sin(t * 0.37) * 4 * bob)
      .addScaledVector(side, Math.sin(t * 0.23) * 5 * bob);
    out.look.copy(at).addScaledVector(fwd, 40);
    this.applyLook(out);
    out.fov = 55;
    return out;
  }

  private focusPose(i: number, out: Pose): Pose {
    const node = this.world.thoughts[i];
    const topic = this.world.topics[node.topic];
    const t = this.u.time.value;
    const bob = this.reduced ? 0 : 1;
    out.pos
      .copy(node.rest)
      .addScaledVector(topic.fwd, -300 * this.narrow())
      .addScaledVector(UP, 14 + Math.sin(t * 0.37) * 2.5 * bob)
      .addScaledVector(topic.side, 70 + Math.sin(t * 0.23) * 3 * bob);
    // Look a little past the thought so it sits left of centre, its words to the right.
    out.look.copy(node.rest).addScaledVector(topic.side, 95);
    this.applyLook(out);
    out.fov = 55;
    return out;
  }

  /** On tall, narrow screens the camera stands further back so a topic's ring fits across. */
  private narrow(): number {
    return Math.pow(Math.max(1, 1.25 / (this.width / this.height)), 0.85);
  }

  private applyLook(out: Pose) {
    if (this.yaw === 0 && this.pitch === 0) return;
    const dir = out.look.clone().sub(out.pos);
    dir.applyAxisAngle(UP, this.yaw);
    const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
    dir.applyAxisAngle(right, this.pitch);
    out.look.copy(out.pos).add(dir);
  }

  private overviewPose(out: Pose): Pose {
    const aspect = this.width / this.height;
    const fitWidth = (DISC_RADIUS * 2.1) / (2 * Math.tan(THREE.MathUtils.degToRad(23)) * aspect);
    const d = Math.max(this.ovDistance, aspect < 1 ? fitWidth : 0);
    const e = this.ovElevation;
    const a = this.ovAzimuth + (this.reduced ? 0 : this.u.time.value * 0.006);
    out.look.set(0, 0, 0);
    out.pos.set(Math.cos(a) * Math.cos(e) * d, Math.sin(a) * Math.cos(e) * d, Math.sin(e) * d);
    const forward = new THREE.Vector3().subVectors(out.look, out.pos).normalize();
    const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    if (aspect > 1.15) {
      const shift = d * 0.15 * Math.min(1, (aspect - 1.15) * 2);
      out.pos.addScaledVector(right, -shift);
      out.look.addScaledVector(right, -shift);
    } else if (aspect < 0.9) {
      const shift = d * 0.16;
      out.pos.addScaledVector(up, -shift);
      out.look.addScaledVector(up, -shift);
    }
    out.fov = 46;
    return out;
  }

  private fly(to: () => Pose, opts: { lift?: number; duration?: number; done?: () => void } = {}) {
    const from: Pose = { pos: this.pose.pos.clone(), look: this.pose.look.clone(), fov: this.pose.fov };
    const target = to();
    const dist = from.look.distanceTo(target.look);
    const dur = this.reduced ? 0.001 : opts.duration ?? THREE.MathUtils.clamp(1.2 + Math.log10(1 + dist / 80) * 0.55, 1.2, 3.2);
    this.flight = { from, to, t: 0, dur, lift: opts.lift ?? dist, done: opts.done ?? (() => {}) };
  }

  private stepFlight(dt: number, out: Pose) {
    const f = this.flight!;
    f.t = Math.min(1, f.t + dt / f.dur);
    const e = easeInOut(f.t);
    const to = f.to();
    out.look.lerpVectors(f.from.look, to.look, e);
    const off0 = f.from.pos.clone().sub(f.from.look);
    const off1 = to.pos.clone().sub(to.look);
    const l0 = Math.log(Math.max(1, off0.length()));
    const l1 = Math.log(Math.max(1, off1.length()));
    const dir = off0.clone().normalize().lerp(off1.clone().normalize(), e).normalize();
    let ln = l0 + (l1 - l0) * e;
    // Long hops rise above the disc so you can see where you're going.
    const mid = Math.log(Math.max(1, f.lift * 0.7));
    const base = (l0 + l1) / 2;
    if (mid > base) {
      ln += (mid - base) * Math.sin(Math.PI * e);
      dir.addScaledVector(UP, 1.1 * Math.sin(Math.PI * e)).normalize();
    }
    out.pos.copy(out.look).addScaledVector(dir, Math.exp(ln));
    out.fov = f.from.fov + (to.fov - f.from.fov) * e;
    if (f.t >= 1) {
      this.flight = null;
      f.done();
    }
  }

  private animateOverview(target: number) {
    this.blendAnim?.stop();
    this.overviewGoal = target;
    if (this.reduced) {
      this.overview = target;
      return;
    }
    this.blendAnim = animate(this.overview, target, {
      duration: 2.2,
      ease: [0.65, 0, 0.35, 1],
      onUpdate: (v) => (this.overview = v),
    });
  }

  // ---------------------------------------------------------------- navigation

  get topicIndex() {
    return this.currentTopic;
  }

  get focused() {
    return this.focus;
  }

  get inOverview() {
    return this.overviewGoal > 0.5;
  }

  private clampTopic(i: number) {
    return THREE.MathUtils.clamp(Math.round(i), 0, Math.max(0, this.world.topics.length - 1));
  }

  /** Dive in from the whole galaxy, at a topic (and optionally straight onto one thought). */
  enterJourney(topic = this.currentTopic, thought: number | null = null) {
    const i = this.clampTopic(topic);
    this.p = this.pGoal = i;
    this.currentTopic = i;
    this.setFocus(thought);
    this.yaw = this.pitch = this.yawGoal = this.pitchGoal = 0;
    this.chainGoal = 1;
    this.animateOverview(0);
    this.fly(() => (this.focus !== null ? this.focusPose(this.focus, newPose()) : this.topicPose(this.p, newPose())), {
      duration: this.reduced ? 0.001 : 2.6,
      lift: 0,
    });
  }

  enterOverview() {
    this.setFocus(null);
    this.animateOverview(1);
    this.fly(() => this.overviewPose(newPose()), { duration: this.reduced ? 0.001 : 2.4, lift: 0 });
  }

  private setFocus(i: number | null) {
    this.focus = i;
    this.u.focus.value = i ?? -1;
  }

  /** Travel to a topic: along the arm if it's close, a flight above the disc if not. */
  goToTopic(index: number) {
    const i = this.clampTopic(index);
    if (this.inOverview) return this.enterJourney(i);
    this.yawGoal = this.pitchGoal = 0;
    if (this.focus !== null) {
      this.setFocus(null);
      const dist = this.pose.look.distanceTo(this.world.topics[i].pos);
      this.fly(() => this.topicPose(i, newPose()), { lift: Math.abs(i - this.p) > 2 ? dist : 0, duration: Math.abs(i - this.p) > 2 ? undefined : 1.3 });
      this.p = this.pGoal = i;
      return;
    }
    if (Math.abs(i - this.p) <= 3 && !this.flight) {
      this.pGoal = i;
      return;
    }
    const dist = this.pose.look.distanceTo(this.world.topics[i].pos);
    this.fly(() => this.topicPose(i, newPose()), { lift: dist });
    this.p = this.pGoal = i;
  }

  /** Look closely at one thought, wherever it is; null steps back to its topic. */
  focusThought(i: number | null) {
    if (i === null) {
      if (this.focus === null) return;
      this.setFocus(null);
      this.fly(() => this.topicPose(this.p, newPose()), { duration: 1, lift: 0 });
      return;
    }
    const node = this.world.thoughts[i];
    if (!node) return;
    if (this.inOverview) return this.enterJourney(node.topic, i);
    const far = node.topic !== this.currentTopic;
    const dist = far ? this.pose.look.distanceTo(node.rest) : 0;
    this.p = this.pGoal = node.topic;
    this.setFocus(i);
    this.fly(() => this.focusPose(i, newPose()), far ? { lift: dist } : { duration: 0.95, lift: 0 });
  }

  step(dir: 1 | -1) {
    if (this.inOverview) {
      if (dir > 0) this.enterJourney();
      return;
    }
    const next = Math.round(this.focus !== null ? this.p : this.pGoal) + dir;
    if (next < 0) return this.enterOverview();
    this.goToTopic(Math.min(this.world.topics.length - 1, next));
  }

  setHover(thought: number | null) {
    this.u.hover.value = thought ?? -1;
  }

  // ---------------------------------------------------------------- input

  readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= 400;
    dy = THREE.MathUtils.clamp(dy, -220, 220);
    if (Math.abs(dy) < 0.5) return;
    if (this.inOverview) {
      if (dy > 8 && !this.flight) this.enterJourney();
      return;
    }
    if (this.flight) return;
    if (this.focus !== null) {
      if (Math.abs(dy) > 8) this.step(dy > 0 ? 1 : -1);
      return;
    }
    this.wheelDir = dy > 0 ? 1 : -1;
    this.pGoal = THREE.MathUtils.clamp(this.pGoal + dy * 0.0065, -0.7, this.world.topics.length - 1);
    this.yawGoal = this.pitchGoal = 0;
    window.clearTimeout(this.wheelTimer);
    this.wheelTimer = window.setTimeout(() => this.settle(), 170);
  };

  /** After scrolling stops, come to rest at a topic. */
  private settle() {
    const target = Math.round(this.pGoal + 0.3 * this.wheelDir);
    if (target < 0) {
      this.pGoal = 0;
      this.enterOverview();
      return;
    }
    this.pGoal = this.clampTopic(target);
  }

  readonly onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    this.dragAxis = "none";
    this.dragged = false;
    this.swipeAccum = 0;
    this.downAt = performance.now();
    // A finger landing on a glide catches it where it is.
    if (e.pointerType === "touch" && this.gliding) {
      this.gliding = false;
      this.touchVel = 0;
    }
  };

  readonly onPointerMove = (e: PointerEvent) => {
    const pt = this.pointers.get(e.pointerId);
    if (!pt) return;
    const dx = e.clientX - pt.x;
    const dy = e.clientY - pt.y;
    const touch = e.pointerType === "touch";
    if (this.dragAxis === "none") {
      const tx = e.clientX - pt.sx;
      const ty = e.clientY - pt.sy;
      // A finger wobbles more than a mouse: under 8px it is still a tap.
      if (Math.hypot(tx, ty) < (touch ? 8 : 6)) return;
      this.dragged = true;
      this.dragAxis = touch && Math.abs(ty) > Math.abs(tx) && !this.inOverview ? "swipe" : "look";
      (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId);
      this.lastMoveAt = performance.now();
      this.touchVel = 0;
    }
    pt.x = e.clientX;
    pt.y = e.clientY;
    if (this.dragAxis === "swipe" && (this.focus !== null || this.flight)) {
      // Reading one thought: a swipe still moves one topic at a time.
      this.swipeAccum -= dy;
      if (Math.abs(this.swipeAccum) > 70) {
        this.step(this.swipeAccum > 0 ? 1 : -1);
        this.swipeAccum = 0;
      }
    } else if (this.dragAxis === "swipe") {
      // The journey follows the finger, and remembers how fast it was moving.
      const now = performance.now();
      const secs = Math.max(0.004, (now - this.lastMoveAt) / 1000);
      this.lastMoveAt = now;
      const d = -dy * SWIPE_PER_PX;
      this.touchDrag = true;
      this.pGoal = THREE.MathUtils.clamp(this.pGoal + d, -0.7, this.world.topics.length - 1);
      this.touchVel = this.touchVel * 0.6 + (d / secs) * 0.4;
      if (d !== 0) this.wheelDir = d > 0 ? 1 : -1;
      this.yawGoal = this.pitchGoal = 0;
    } else if (this.inOverview) {
      this.ovAzimuth -= dx * 0.004;
      this.ovElevation = THREE.MathUtils.clamp(this.ovElevation + dy * 0.003, 0.25, 1.45);
    } else {
      this.yawGoal = THREE.MathUtils.clamp(this.yawGoal - dx * 0.0035, -1.3, 1.3);
      this.pitchGoal = THREE.MathUtils.clamp(this.pitchGoal - dy * 0.0035, -0.8, 0.8);
    }
  };

  readonly onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    const now = performance.now();
    if (this.dragged) this.suppressClickUntil = now + 150;
    // On touch, a tap is short and still; a long press is not a tap.
    else if (e.pointerType === "touch" && now - this.downAt >= 250) this.suppressClickUntil = now + 150;
    if (this.touchDrag) {
      this.touchDrag = false;
      // A finger that stopped before lifting has no flick left in it.
      if (now - this.lastMoveAt > 90) this.touchVel = 0;
      if (!this.reduced && Math.abs(this.touchVel) > 0.4) {
        this.wheelDir = this.touchVel > 0 ? 1 : -1;
        this.gliding = true;
      } else {
        this.touchVel = 0;
        this.settle();
      }
    }
    this.dragAxis = "none";
  };

  clickSuppressed() {
    return performance.now() < this.suppressClickUntil;
  }

  /** The star nearest a screen point: a thought if one is open there, else a topic. */
  pick(x: number, y: number, radius = 14): { kind: "thought" | "topic"; index: number } | null {
    const f = this.frame;
    let best: { kind: "thought" | "topic"; index: number } | null = null;
    let bestD = radius;
    for (let i = 0; i < this.world.thoughts.length; i++) {
      const o = i * 4;
      if (!f.thoughtScreen[o + 2] || f.thoughtScreen[o + 3] < 0.5) continue;
      const d = Math.hypot(f.thoughtScreen[o] - x, f.thoughtScreen[o + 1] - y);
      if (d < bestD) {
        bestD = d;
        best = { kind: "thought", index: i };
      }
    }
    for (let i = 0; i < this.world.topics.length; i++) {
      const o = i * 4;
      if (!f.topicScreen[o + 2]) continue;
      const d = Math.hypot(f.topicScreen[o] - x, f.topicScreen[o + 1] - y) - 4;
      if (d < bestD) {
        bestD = d;
        best = { kind: "topic", index: i };
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- loop

  subscribe(fn: (f: Frame) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private resize() {
    const host = this.canvas.parentElement ?? this.canvas;
    this.width = Math.max(1, host.clientWidth);
    this.height = Math.max(1, host.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality >= 2 ? 1.6 : this.quality === 1 ? 1.15 : 0.9);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(this.width, this.height);
    this.bloom.resolution.set(this.width / 2, this.height / 2);
    this.u.pixelRatio.value = dpr;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    (this.nearMat.uniforms.uViewport.value as THREE.Vector2).copy(size);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  private minutesOf(iso: string) {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
  }

  /** What time of day the sky should show: the thought in focus, or the topic's latest moment. */
  private minutesAt(p: number): number {
    if (this.focus !== null) return this.minutesOf(this.world.thoughts[this.focus].thought.at);
    const ts = this.world.topics;
    if (!ts.length) return 12 * 60;
    const i = Math.min(ts.length - 1, Math.max(0, Math.floor(p)));
    const j = Math.min(ts.length - 1, i + 1);
    const t = Math.min(1, Math.max(0, p - i));
    return this.minutesOf(ts[i].last) * (1 - t) + this.minutesOf(ts[j].last) * t;
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    // Flights keep to real time even when frames are slow; smoothing steps are capped.
    const elapsed = Math.min(0.25, Math.max(0.001, (now - this.last) / 1000));
    const dt = Math.min(0.06, elapsed);
    this.last = now;
    const u = this.u;
    u.time.value = now / 1000;
    const nTopics = this.world.topics.length;

    if (this.gliding) {
      // The flick carries on and slows: it keeps GLIDE_KEEP of its speed each 60th of a second.
      const last = this.world.topics.length - 1;
      this.pGoal += this.touchVel * dt;
      this.touchVel *= Math.pow(GLIDE_KEEP, dt * 60);
      if (this.pGoal <= -0.7 || this.pGoal >= last) {
        this.pGoal = THREE.MathUtils.clamp(this.pGoal, -0.7, last);
        this.touchVel = 0;
      }
      if (Math.abs(this.touchVel) < 0.15 || this.flight) {
        this.gliding = false;
        this.touchVel = 0;
        if (!this.flight) this.settle();
      }
    }
    if (!this.flight) {
      // Under a finger the journey keeps up closely; the wheel keeps its slower, smoother follow.
      const rate = this.reduced ? 30 : this.touchDrag || this.gliding ? 10 : 3.4;
      const k = 1 - Math.exp(-dt * rate);
      this.p += (this.pGoal - this.p) * k;
      if (Math.abs(this.pGoal - this.p) < 0.0005) this.p = this.pGoal;
    }
    const pc = THREE.MathUtils.clamp(this.p, 0, Math.max(0, nTopics - 1));
    this.currentTopic = Math.round(pc);
    u.p.value = pc;
    u.chain.value += (this.chainGoal - u.chain.value) * (1 - Math.exp(-dt * 1.5));

    const kl = 1 - Math.exp(-dt * 5);
    this.yaw += (this.yawGoal - this.yaw) * kl;
    this.pitch += (this.pitchGoal - this.pitch) * kl;

    if (this.flight) this.stepFlight(elapsed, this.pose);
    else if (this.overviewGoal > 0.5) this.overviewPose(this.pose);
    else if (this.focus !== null) this.focusPose(this.focus, this.pose);
    else this.topicPose(pc, this.pose);
    this.camera.position.copy(this.pose.pos);
    this.camera.up.copy(UP);
    this.camera.lookAt(this.pose.look);
    if (Math.abs(this.camera.fov - this.pose.fov) > 0.01) {
      this.camera.fov = this.pose.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();

    this.velocity.copy(this.camera.position).sub(this.lastCam).divideScalar(dt);
    this.lastCam.copy(this.camera.position);
    const speed = this.velocity.length();
    u.overview.value = this.overview;

    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    if (!this.reduced) this.flow.addScaledVector(fwd, -dt * 7);
    const nu = this.nearMat.uniforms;
    (nu.uCam.value as THREE.Vector3).copy(this.camera.position);
    (nu.uVel.value as THREE.Vector3).copy(this.velocity).clampLength(0, 20000);
    (nu.uFlow.value as THREE.Vector3).copy(this.flow);
    nu.uVisible.value = (1 - this.overview) * (1 - THREE.MathUtils.smoothstep(this.camera.position.length(), DISC_RADIUS * 1.3, DISC_RADIUS * 2));

    const ref = this.galaxyMat.uniforms;
    ref.uFloor.value = THREE.MathUtils.lerp(0.0015, 0.028, this.overview);
    ref.uGain.value = THREE.MathUtils.lerp(1, 1.1, this.overview);

    const minutes = this.minutesAt(pc);
    const g = gradeAt(minutes);
    const gu = this.grade.uniforms;
    gu.uTint.value = g.tint;
    gu.uExposure.value = g.exposure;

    this.updateFilaments(dt, pc);
    this.composer.render(dt);
    this.watchPerformance(dt);

    // Screen positions for the words.
    const f = this.frame;
    const v = new THREE.Vector3();
    const project = (p: THREE.Vector3, arr: Float32Array, o: number) => {
      v.copy(p).applyMatrix4(this.camera.matrixWorldInverse);
      const depth = -v.z;
      v.applyMatrix4(this.camera.projectionMatrix);
      arr[o] = (v.x * 0.5 + 0.5) * this.width;
      arr[o + 1] = (-v.y * 0.5 + 0.5) * this.height;
      arr[o + 2] = depth > 1 ? 1 : 0;
      return depth;
    };
    const { topics, thoughts } = this.world;
    if (f.topicScreen.length !== topics.length * 4) f.topicScreen = new Float32Array(topics.length * 4);
    if (f.thoughtScreen.length !== thoughts.length * 4) f.thoughtScreen = new Float32Array(thoughts.length * 4);
    topics.forEach((t, i) => {
      f.topicScreen[i * 4 + 3] = project(t.pos, f.topicScreen, i * 4);
    });
    const tmp = new THREE.Vector3();
    thoughts.forEach((th, i) => {
      const open = openness(th.topic, pc, this.overview);
      project(openPosition(th, topics[th.topic].pos, open, tmp), f.thoughtScreen, i * 4);
      f.thoughtScreen[i * 4 + 3] = open;
    });

    // Quiet the starlight behind the words you're reading.
    let qx = 0.5;
    let qy = 0.5;
    let amount = 0;
    const settled = this.flight ? 0 : 1 - this.overview;
    if (this.focus !== null) {
      const o = this.focus * 4;
      qx = (f.thoughtScreen[o] + Math.min(300, this.width * 0.22)) / this.width;
      qy = 1 - (f.thoughtScreen[o + 1] + 80) / this.height;
      amount = 0.55 * settled * f.thoughtScreen[o + 2];
    } else if (topics.length) {
      const o = this.currentTopic * 4;
      qx = f.topicScreen[o] / this.width;
      qy = 1 - (f.topicScreen[o + 1] + 60) / this.height;
      amount = 0.5 * settled * f.topicScreen[o + 2] * (1 - Math.min(1, Math.abs(pc - this.currentTopic) * 2));
    }
    gu.uQuiet.value = [qx, qy];
    gu.uQuietSize.value = [Math.min(0.36, 380 / this.width), Math.min(0.3, 200 / this.height)];
    gu.uQuietAmount.value = amount;

    f.overview = this.overview;
    f.p = pc;
    f.current = this.currentTopic;
    f.focus = this.focus;
    f.hover = this.u.hover.value >= 0 ? this.u.hover.value : null;
    f.flying = !!this.flight;
    f.dragging = this.touchDrag || this.gliding;
    f.minutes = minutes;
    f.speed = speed;
    f.width = this.width;
    f.height = this.height;
    f.dt = dt;
    this.listeners.forEach((l) => l(f));
  };

  private readonly filA = new THREE.Vector3();
  private readonly filB = new THREE.Vector3();
  private readonly filC = new THREE.Vector3();

  /** Arcs from the thought in focus (or under the pointer) to its closest relations, following the stars as they move. */
  private updateFilaments(dt: number, pc: number) {
    const hover = this.u.hover.value >= 0 ? this.u.hover.value : null;
    const active = this.overview > 0.5 ? null : (this.focus ?? hover);
    if (active !== this.filamentFrom) {
      this.filamentFrom = active;
      this.filamentTo = active !== null && this.filamentSource ? this.filamentSource(active).slice(0, FIL_MAX) : [];
    }
    const goal = this.filamentFrom !== null && this.filamentTo.length ? 1 : 0;
    this.filamentAlpha += (goal - this.filamentAlpha) * (1 - Math.exp(-dt * 6));
    const line = this.filamentLine;
    const { topics, thoughts } = this.world;
    const from = this.filamentFrom !== null ? thoughts[this.filamentFrom] : undefined;
    if (this.filamentAlpha < 0.01 || !from) {
      line.visible = false;
      return;
    }
    line.visible = true;
    const pulse = this.reduced ? 1 : 0.82 + 0.18 * Math.sin(this.u.time.value * 2.4);
    this.filamentMat.opacity = this.filamentAlpha * 0.85 * pulse * (1 - this.overview);
    const A = openPosition(from, topics[from.topic].pos, openness(from.topic, pc, this.overview), this.filA);
    const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    let o = 0;
    for (const j of this.filamentTo) {
      const to = thoughts[j];
      if (!to) continue;
      const B = openPosition(to, topics[to.topic].pos, openness(to.topic, pc, this.overview), this.filB);
      const C = this.filC.copy(A).add(B).multiplyScalar(0.5).addScaledVector(UP, A.distanceTo(B) * 0.22);
      let px = A.x;
      let py = A.y;
      let pz = A.z;
      for (let s = 1; s <= FIL_SEG; s++) {
        const t = s / FIL_SEG;
        const m = 1 - t;
        const x = m * m * A.x + 2 * m * t * C.x + t * t * B.x;
        const y = m * m * A.y + 2 * m * t * C.y + t * t * B.y;
        const z = m * m * A.z + 2 * m * t * C.z + t * t * B.z;
        arr[o++] = px;
        arr[o++] = py;
        arr[o++] = pz;
        arr[o++] = x;
        arr[o++] = y;
        arr[o++] = z;
        px = x;
        py = y;
        pz = z;
      }
    }
    pos.needsUpdate = true;
    line.geometry.setDrawRange(0, o / 3);
  }

  private watchPerformance(dt: number) {
    if (document.hidden || dt > 0.055) return;
    this.slowFrames = dt > 0.024 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 0.5);
    if (this.slowFrames > 90 && this.quality > 0) {
      this.quality--;
      this.slowFrames = 0;
      this.resize();
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.wheelTimer);
    window.clearTimeout(this.resizeTimer);
    this.blendAnim?.stop();
    this.resizeObserver.disconnect();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.LineSegments) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.composer.dispose();
    this.renderer.dispose();
  }
}
