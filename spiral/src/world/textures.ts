import * as THREE from "three";
import { mulberry32 } from "./layout";

// A 2×2 atlas of cloud shapes, generated once:
// 0 soft cloud · 1 wispy filaments · 2 dust · 3 smooth glow.

function makeNoise(seed: number) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h: number, x: number, y: number) => {
    const g = h & 7;
    const u = g < 4 ? x : y;
    const v = g < 4 ? y : x;
    return (g & 1 ? -u : u) + (g & 2 ? -2 * v : 2 * v);
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x: number, y: number) => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];
    const x1 = grad(aa, xf, yf) + (grad(ba, xf - 1, yf) - grad(aa, xf, yf)) * u;
    const x2 = grad(ab, xf, yf - 1) + (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1)) * u;
    return (x1 + (x2 - x1) * v) * 0.35;
  };
}

export function buildCloudAtlas(size = 256): THREE.Texture {
  const atlas = size * 2;
  const data = new Uint8Array(atlas * atlas * 4);
  const noise = makeNoise(17);

  const fbm = (x: number, y: number, oct: number, ridged = false) => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < oct; o++) {
      let n = noise(x * f, y * f);
      if (ridged) n = 1 - Math.abs(n * 2.2);
      sum += n * amp;
      f *= 2.03;
      amp *= 0.5;
    }
    return sum;
  };

  for (let tile = 0; tile < 4; tile++) {
    const ox = (tile % 2) * size;
    const oy = Math.floor(tile / 2) * size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / (size - 1)) * 2 - 1;
        const v = (y / (size - 1)) * 2 - 1;
        const r = Math.sqrt(u * u + v * v);
        const edge = Math.max(0, 1 - r);
        let a = 0;
        const sx = u * 2.2 + tile * 13.1;
        const sy = v * 2.2 - tile * 7.7;
        if (tile === 0) {
          const n = fbm(sx, sy, 6) * 0.5 + 0.5;
          a = Math.pow(edge, 1.6) * Math.pow(Math.max(0, n * 1.25 - 0.15), 1.8);
        } else if (tile === 1) {
          // Warp the coordinates so the filaments curl like real nebula wisps.
          const wx = sx + fbm(sx + 3.1, sy, 3) * 1.6;
          const wy = sy + fbm(sx, sy + 5.7, 3) * 1.6;
          const n = fbm(wx, wy, 6, true);
          a = Math.pow(edge, 1.3) * Math.pow(Math.max(0, n - 0.25), 2.2) * 2.2;
        } else if (tile === 2) {
          const n = fbm(sx * 1.3, sy * 1.3, 6) * 0.5 + 0.5;
          a = Math.pow(edge, 1.2) * Math.min(1, Math.pow(Math.max(0, n * 1.6 - 0.45), 1.3) * 1.8);
        } else {
          a = Math.exp(-r * r * 5.5) * (1 - Math.min(1, r));
        }
        const i = ((oy + y) * atlas + ox + x) * 4;
        const val = Math.round(Math.min(1, Math.max(0, a)) * 255);
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }
    }
  }

  const tex = new THREE.DataTexture(data, atlas, atlas, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
