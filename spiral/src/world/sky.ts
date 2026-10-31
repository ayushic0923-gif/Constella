import * as THREE from "three";
import { ARM_START_R as DAY_START_R, DISC_RADIUS, gauss, mulberry32, type Spiral } from "./layout";

// Everything in the sky that isn't a thought. Generated once, never interactive.

export type RGB = [number, number, number];

/** Approximate colour of a black body at a temperature in kelvin, as linear RGB. */
export function blackbody(kelvin: number): RGB {
  const t = kelvin / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.47 * Math.log(t) - 161.12;
    b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  } else {
    r = 329.7 * Math.pow(t - 60, -0.1332);
    g = 288.12 * Math.pow(t - 60, -0.0755);
    b = 255;
  }
  const c = new THREE.Color(
    Math.min(255, Math.max(0, r)) / 255,
    Math.min(255, Math.max(0, g)) / 255,
    Math.min(255, Math.max(0, b)) / 255,
  );
  c.convertSRGBToLinear();
  return [c.r, c.g, c.b];
}

function linear(hex: string, k = 1): RGB {
  const c = new THREE.Color(hex); // three converts sRGB hex to linear
  return [c.r * k, c.g * k, c.b * k];
}

// Stellar luminosity: most stars are faint, a few are brilliant.
function luminosity(rand: () => number, young: boolean): number {
  const x = rand();
  const base = 0.04 + Math.pow(x, 6) * (young ? 70 : 30);
  return rand() < 0.004 ? base + 40 + rand() * 120 : base;
}

export function buildGalaxyStars(spiral: Spiral, count: number): THREE.BufferGeometry {
  const rand = mulberry32(2024);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const lum = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const roll = rand();
    let x: number, y: number, z: number, temp: number, young = false;
    if (roll < 0.18) {
      // Bulge: old, warm, round.
      const r = Math.abs(gauss(rand)) * 950;
      const a = rand() * Math.PI * 2;
      const e = gauss(rand);
      x = Math.cos(a) * r * 1.15;
      y = Math.sin(a) * r;
      z = e * 260 * Math.exp(-r / 1800);
      temp = 3300 + rand() * 2200;
    } else if (roll < 0.66) {
      // Arms: two major, two minor; young blue stars crowd the arms.
      const arm = rand() < 0.78 ? (rand() < 0.5 ? 0 : 1) : rand() < 0.5 ? 0.5 : 1.5;
      const r = DAY_START_R * 0.7 + Math.pow(rand(), 0.85) * (DISC_RADIUS - DAY_START_R * 0.7);
      const theta = spiral.angle(r, arm) + gauss(rand) * 0.045;
      const t = spiral.tangent(theta);
      const spread = gauss(rand) * (110 + r * 0.045);
      x = Math.cos(theta) * r + Math.cos(t + Math.PI / 2) * spread;
      y = Math.sin(theta) * r + Math.sin(t + Math.PI / 2) * spread;
      z = gauss(rand) * (45 + r * 0.008);
      young = rand() < 0.55;
      temp = young ? 7500 + Math.pow(rand(), 0.7) * 18000 : 3800 + rand() * 3800;
    } else {
      // The disc between the arms.
      const r = Math.min(DISC_RADIUS * 1.08, 300 - Math.log(Math.max(1e-6, rand())) * 3100);
      const a = rand() * Math.PI * 2;
      x = Math.cos(a) * r;
      y = Math.sin(a) * r;
      z = gauss(rand) * 110;
      temp = 3400 + rand() * 4600;
    }
    pos.set([x, y, z], i * 3);
    col.set(blackbody(temp), i * 3);
    lum[i] = luminosity(rand, young);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aLum", new THREE.BufferAttribute(lum, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), DISC_RADIUS * 1.5);
  return g;
}

export function buildFarStars(count: number): THREE.BufferGeometry {
  const rand = mulberry32(77);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const lum = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const R = 120000;
    pos.set([Math.cos(a) * s * R, Math.sin(a) * s * R, u * R], i * 3);
    col.set(blackbody(3500 + rand() * 9000), i * 3);
    lum[i] = Math.pow(rand(), 5) * 1.2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aLum", new THREE.BufferAttribute(lum, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 130000);
  return g;
}

export function buildNearStars(count: number, tile: number): THREE.InstancedBufferGeometry {
  const rand = mulberry32(5150);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const p = new Float32Array(count * 3);
  const c = new Float32Array(count * 3);
  const s = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p.set([rand() * tile, rand() * tile, rand() * tile], i * 3);
    const bright = rand() < 0.04;
    const col = blackbody(rand() < 0.3 ? 9000 + rand() * 14000 : 3600 + rand() * 4500);
    const k = bright ? 2.4 : 0.55 + rand() * 0.7;
    c.set([col[0] * k, col[1] * k, col[2] * k], i * 3);
    s[i] = bright ? 2.6 + rand() * 1.4 : 1.1 + rand() * 1.1;
  }
  g.setAttribute("iPos", new THREE.InstancedBufferAttribute(p, 3));
  g.setAttribute("iColor", new THREE.InstancedBufferAttribute(c, 3));
  g.setAttribute("iSize", new THREE.InstancedBufferAttribute(s, 1));
  g.instanceCount = count;
  return g;
}

interface Cloud {
  c: [number, number, number];
  w: number;
  h: number;
  rot: number;
  color: RGB;
  alpha: number;
  tile: number;
  planar: boolean;
}

function cloudGeometry(list: Cloud[]): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const n = list.length;
  const center = new Float32Array(n * 3);
  const size = new Float32Array(n * 2);
  const rot = new Float32Array(n);
  const color = new Float32Array(n * 4);
  const tile = new Float32Array(n);
  const planar = new Float32Array(n);
  list.forEach((cl, i) => {
    center.set(cl.c, i * 3);
    size.set([cl.w, cl.h], i * 2);
    rot[i] = cl.rot;
    color.set([...cl.color, cl.alpha], i * 4);
    tile[i] = cl.tile;
    planar[i] = cl.planar ? 1 : 0;
  });
  g.setAttribute("iCenter", new THREE.InstancedBufferAttribute(center, 3));
  g.setAttribute("iSize", new THREE.InstancedBufferAttribute(size, 2));
  g.setAttribute("iRot", new THREE.InstancedBufferAttribute(rot, 1));
  g.setAttribute("iColor", new THREE.InstancedBufferAttribute(color, 4));
  g.setAttribute("iTile", new THREE.InstancedBufferAttribute(tile, 1));
  g.setAttribute("iPlanar", new THREE.InstancedBufferAttribute(planar, 1));
  g.instanceCount = n;
  return g;
}

const H_ALPHA = linear("#ff5a7a");
const OIII = linear("#58d6c8");
const REFLECTION = linear("#6f8fff");

export function buildClouds(spiral: Spiral, path: THREE.Vector3[], density: number) {
  const rand = mulberry32(31337);
  const glow: Cloud[] = [];
  const dust: Cloud[] = [];
  const armPoint = (arm: number, r: number, spreadK: number) => {
    const theta = spiral.angle(r, arm) + gauss(rand) * 0.03;
    const t = spiral.tangent(theta);
    const spread = gauss(rand) * (60 + r * spreadK);
    return {
      x: Math.cos(theta) * r + Math.cos(t + Math.PI / 2) * spread,
      y: Math.sin(theta) * r + Math.sin(t + Math.PI / 2) * spread,
      t,
    };
  };

  // Bulge: a warm, smooth glow with some texture.
  const warm = blackbody(4300);
  glow.push(
    { c: [0, 0, 0], w: 2600, h: 2300, rot: 0.3, color: warm.map((v) => v * 0.22) as RGB, alpha: 1, tile: 3, planar: true },
    { c: [0, 0, 0], w: 1300, h: 1100, rot: 0.3, color: warm.map((v) => v * 0.55) as RGB, alpha: 1, tile: 3, planar: true },
    { c: [0, 0, 0], w: 1400, h: 1400, rot: 0, color: warm.map((v) => v * 0.3) as RGB, alpha: 1, tile: 3, planar: false },
  );
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 900;
    glow.push({
      c: [Math.cos(a) * r, Math.sin(a) * r, gauss(rand) * 80],
      w: 600 + rand() * 700,
      h: 500 + rand() * 600,
      rot: rand() * Math.PI,
      color: blackbody(3800 + rand() * 1400).map((v) => v * 0.25) as RGB,
      alpha: 1,
      tile: 0,
      planar: true,
    });
  }

  // Arm glow: the light of stars too faint to see one by one.
  const armGlow = Math.round(760 * density);
  for (let i = 0; i < armGlow; i++) {
    const arm = i % 4 === 3 ? (rand() < 0.5 ? 0.5 : 1.5) : i % 2;
    const r = DAY_START_R * 0.8 + Math.pow(rand(), 0.8) * (DISC_RADIUS - DAY_START_R * 0.8);
    const p = armPoint(arm, r, 0.04);
    const k = (arm % 1 === 0 ? 0.095 : 0.04) * (1.1 - (r / DISC_RADIUS) * 0.6);
    const col = blackbody(r < 2500 ? 5600 + rand() * 1500 : 8500 + rand() * 8000);
    glow.push({
      c: [p.x, p.y, gauss(rand) * 20],
      w: 380 + rand() * 600,
      h: 220 + rand() * 260,
      rot: p.t,
      color: col.map((v) => v * k) as RGB,
      alpha: 1,
      tile: rand() < 0.6 ? 0 : 3,
      planar: true,
    });
  }

  // Dust lanes on the inner edge of each major arm.
  const lanes = Math.round(820 * density);
  for (let i = 0; i < lanes; i++) {
    const arm = i % 2;
    const r = 1100 + Math.pow(rand(), 0.9) * (DISC_RADIUS * 0.95 - 1100);
    const theta = spiral.angle(r, arm) + gauss(rand) * 0.02;
    const t = spiral.tangent(theta);
    const inward = -(110 + r * 0.035) + gauss(rand) * (30 + r * 0.012);
    dust.push({
      c: [
        Math.cos(theta) * r + Math.cos(t + Math.PI / 2) * inward,
        Math.sin(theta) * r + Math.sin(t + Math.PI / 2) * inward,
        6,
      ],
      w: 300 + rand() * 520,
      h: 90 + rand() * 140,
      rot: t + gauss(rand) * 0.08,
      color: [0.012, 0.008, 0.007],
      alpha: 0.35 + rand() * 0.4,
      tile: 2,
      planar: true,
    });
  }

  // Star-forming regions along the arms: pink hydrogen, teal oxygen cores, a blue-white cluster.
  const regions = Math.round(170 * density);
  const addRegion = (x: number, y: number, z: number, scale: number) => {
    const n = 2 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const s = scale * (0.5 + rand() * 0.8);
      glow.push({
        c: [x + gauss(rand) * scale * 0.5, y + gauss(rand) * scale * 0.5, z + gauss(rand) * scale * 0.3],
        w: s,
        h: s * (0.7 + rand() * 0.6),
        rot: rand() * Math.PI * 2,
        color: H_ALPHA.map((v) => v * (0.03 + rand() * 0.035)) as RGB,
        alpha: 1,
        tile: rand() < 0.55 ? 1 : 0,
        planar: false,
      });
    }
    if (rand() < 0.7) {
      glow.push({
        c: [x, y, z],
        w: scale * 0.45,
        h: scale * 0.4,
        rot: rand() * Math.PI,
        color: OIII.map((v) => v * 0.06) as RGB,
        alpha: 1,
        tile: 1,
        planar: false,
      });
    }
    glow.push({
      c: [x, y, z],
      w: scale * 0.22,
      h: scale * 0.22,
      rot: 0,
      color: blackbody(16000).map((v) => v * 0.35) as RGB,
      alpha: 1,
      tile: 3,
      planar: false,
    });
    if (rand() < 0.35) {
      glow.push({
        c: [x + gauss(rand) * scale * 0.6, y + gauss(rand) * scale * 0.6, z + scale * 0.3],
        w: scale * 0.6,
        h: scale * 0.5,
        rot: rand() * Math.PI,
        color: REFLECTION.map((v) => v * 0.05) as RGB,
        alpha: 1,
        tile: 0,
        planar: false,
      });
    }
    if (rand() < 0.5) {
      dust.push({
        c: [x + gauss(rand) * scale * 0.3, y + gauss(rand) * scale * 0.3, z + gauss(rand) * scale * 0.2],
        w: scale * (0.4 + rand() * 0.4),
        h: scale * (0.3 + rand() * 0.3),
        rot: rand() * Math.PI * 2,
        color: [0.01, 0.007, 0.006],
        alpha: 0.6,
        tile: 2,
        planar: false,
      });
    }
  };

  for (let i = 0; i < regions; i++) {
    const arm = i % 2;
    const r = 1300 + Math.pow(rand(), 0.85) * (DISC_RADIUS * 0.95 - 1300);
    const p = armPoint(arm, r, 0.02);
    addRegion(p.x, p.y, gauss(rand) * 30, 160 + Math.pow(rand(), 2) * 420);
  }

  // Regions close to the journey, so travelling between topics passes through gas.
  for (let i = 0; i < path.length - 1; i += 1 + (i % 3 === 2 ? 1 : 0)) {
    const a = path[i];
    const b = path[i + 1];
    const dir = b.clone().sub(a).normalize();
    const along = a.clone().lerp(b, 0.35 + rand() * 0.3);
    const side = new THREE.Vector3(-dir.y, dir.x, 0).normalize().multiplyScalar((rand() < 0.5 ? -1 : 1) * (420 + rand() * 380));
    addRegion(along.x + side.x, along.y + side.y, along.z + gauss(rand) * 120, 200 + rand() * 260);
  }

  // Distant galaxies, far beyond the disc.
  for (let i = 0; i < 90; i++) {
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const R = 70000 + rand() * 40000;
    const size = 250 + Math.pow(rand(), 3) * 1400;
    glow.push({
      c: [Math.cos(a) * s * R, Math.sin(a) * s * R, u * R],
      w: size,
      h: size * (0.25 + rand() * 0.6),
      rot: rand() * Math.PI,
      color: blackbody(4500 + rand() * 5000).map((v) => v * (0.5 + rand() * 0.8)) as RGB,
      alpha: 1,
      tile: 3,
      planar: false,
    });
  }

  return { glow: cloudGeometry(glow), dust: cloudGeometry(dust) };
}
