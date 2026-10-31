// All colours here are linear and may exceed 1; bloom and ACES tone mapping
// in the composer bring them back into range.

/** Galaxy stars: brightness falls with distance, so the disc glows from afar and near stars flare. */
export const galaxyStarVertex = /* glsl */ `
attribute vec3 aColor;
attribute float aLum;
uniform float uPixelRatio;
uniform float uRef;      // distance at which a lum-1 star has intensity 1
uniform float uFloor;    // minimum relative brightness, so the far disc still shows
uniform float uGain;
varying vec3 vColor;
varying float vIntensity;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(1.0, -mv.z);
  float rel = max(pow(uRef / d, 2.0), uFloor);
  float intensity = aLum * rel * uGain;
  float size = clamp(1.5 * pow(aLum, 0.3) * pow(uRef / d, 0.5), 1.0, 7.0);
  // Spread the light over the point, so a big point is not also brighter.
  vIntensity = min(intensity, 40.0) / max(1.0, size * size * 0.35);
  gl_PointSize = size * uPixelRatio;
  vColor = aColor;
}
`;

export const galaxyStarFragment = /* glsl */ `
varying vec3 vColor;
varying float vIntensity;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float psf = exp(-r2 * 4.5);
  gl_FragColor = vec4(vColor * vIntensity * psf, 1.0);
}
`;

/** Far background: fixed-size faint points on a huge sphere. */
export const farStarVertex = /* glsl */ `
attribute vec3 aColor;
attribute float aLum;
uniform float uPixelRatio;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.0 + aLum) * uPixelRatio;
  vColor = aColor * (0.15 + aLum * 0.5);
}
`;

export const farStarFragment = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  gl_FragColor = vec4(vColor * exp(-r2 * 3.0), 1.0);
}
`;

/**
 * Near stars: a cube of stars that wraps around the camera, drawn as streaks
 * from where each star was a moment ago to where it is now.
 */
export const nearStarVertex = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iColor;
attribute float iSize;
uniform vec3 uCam;
uniform vec3 uVel;        // camera velocity, world units per second
uniform vec3 uFlow;       // slow drift of the field, so it is never still
uniform float uTile;
uniform float uTrail;     // seconds of motion a streak shows
uniform float uPixelRatio;
uniform vec2 uViewport;
uniform float uVisible;
varying vec3 vColor;
varying vec2 vLocal;
varying float vAlpha;
void main() {
  vec3 rel = mod(iPos + uFlow - uCam + 0.5 * uTile, uTile) - 0.5 * uTile;
  vec3 world = uCam + rel;
  float dist = length(rel);
  mat4 vp = projectionMatrix * viewMatrix;
  vec4 c1 = vp * vec4(world, 1.0);
  vec4 c0 = vp * vec4(world + uVel * uTrail, 1.0);
  float behind = step(c1.w, 0.5) + step(c0.w, 0.5);
  vec2 s1 = c1.xy / max(c1.w, 0.001);
  vec2 s0 = c0.xy / max(c0.w, 0.001);
  vec2 px1 = s1 * 0.5 * uViewport;
  vec2 px0 = s0 * 0.5 * uViewport;
  vec2 d = px1 - px0;
  float len = length(d);
  float size = iSize * uPixelRatio * clamp(220.0 / dist, 0.6, 2.4);
  vec2 dir = len > 0.001 ? d / len : vec2(1.0, 0.0);
  len = min(len, 260.0 * uPixelRatio);
  vec2 nrm = vec2(-dir.y, dir.x);
  // position.x in [0,1] runs from the old point to the new one; position.y across.
  vec2 base = px1 - dir * (len + size * 0.5);
  vec2 px = base + dir * position.x * (len + size) + nrm * position.y * size * 0.5;
  vec2 ndc = px / (0.5 * uViewport);
  gl_Position = vec4(ndc * c1.w, c1.z, c1.w);
  vLocal = vec2(position.x, position.y);
  float fade = smoothstep(uTile * 0.5, uTile * 0.32, dist) * smoothstep(3.0, 18.0, dist);
  vAlpha = fade * uVisible * (1.0 - min(behind, 1.0)) * (size / max(size, len + size));
  vColor = iColor;
}
`;

export const nearStarFragment = /* glsl */ `
varying vec3 vColor;
varying vec2 vLocal;
varying float vAlpha;
void main() {
  float across = exp(-vLocal.y * vLocal.y * 3.0);
  float ends = smoothstep(0.0, 0.25, vLocal.x) * (0.4 + 0.6 * vLocal.x);
  gl_FragColor = vec4(vColor * across * ends * vAlpha * 2.2, 1.0);
}
`;

/**
 * Gas, dust and distant galaxies: textured quads either facing the camera
 * (clouds you fly past) or lying in the disc (arm glow and dust lanes seen from above).
 */
export const cloudVertex = /* glsl */ `
attribute vec3 iCenter;
attribute vec2 iSize;     // half width, half height
attribute float iRot;
attribute vec4 iColor;    // linear rgb, alpha
attribute float iTile;
attribute float iPlanar;  // 1 = lies in the disc plane
uniform float uTime;
uniform float uMotion;
varying vec2 vUv;
varying vec4 vColor;
varying float vFade;
void main() {
  float c = cos(iRot), s = sin(iRot);
  vec2 corner = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSize;
  vec4 mv;
  float fade = 1.0;
  if (iPlanar > 0.5) {
    vec3 world = iCenter + vec3(corner, 0.0);
    mv = modelViewMatrix * vec4(world, 1.0);
    // Seen edge-on from inside the disc, a flat cloud would smear: fade it.
    vec3 toCam = normalize(cameraPosition - iCenter);
    fade = smoothstep(0.08, 0.35, abs(toCam.z));
  } else {
    mv = modelViewMatrix * vec4(iCenter, 1.0);
    mv.xy += corner;
    float d = -mv.z;
    float r = max(iSize.x, iSize.y);
    // Fly through a cloud rather than into a wall of it.
    fade = smoothstep(r * 0.2, r * 0.95, d);
  }
  gl_Position = projectionMatrix * mv;
  float tx = mod(iTile, 2.0);
  float ty = floor(iTile / 2.0);
  vUv = (position.xy * 0.5 + 0.5 + vec2(tx, ty)) * 0.5;
  vColor = iColor;
  vFade = fade;
}
`;

export const cloudFragment = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uDust;      // 1 for the dust material: darkens instead of glowing
varying vec2 vUv;
varying vec4 vColor;
varying float vFade;
void main() {
  float a = texture2D(uAtlas, vUv).r * vColor.a * vFade;
  if (a < 0.002) discard;
  if (uDust > 0.5) {
    gl_FragColor = vec4(vColor.rgb, a);
  } else {
    gl_FragColor = vec4(vColor.rgb * a, 1.0);
  }
}
`;

/** Shared by thoughts and links: how open a topic's ring is, and where a thought sits as it opens. */
const OPEN = /* glsl */ `
uniform float uP;
uniform float uOverview;
float openOf(float topic) {
  float o = 1.0 - smoothstep(0.25, 0.85, abs(topic - uP));
  return mix(o, 1.0, uOverview);
}
vec3 opened(vec3 centre, vec3 rest, float o) {
  return mix(centre, rest, 1.0 - pow(1.0 - o, 3.0));
}
`;

/**
 * Big thoughts (topics) and the thoughts inside them. A topic's thoughts sit
 * inside its star until you arrive, then open out into a ring around it.
 */
export const thoughtVertex = /* glsl */ `
${OPEN}
attribute vec3 aCenter;
attribute vec3 aRest;
attribute float aTopic;
attribute float aIsTopic;
attribute vec3 aColor;
attribute float aIndex;   // thought index; -1 for a topic's own star
attribute float aVoice;   // 1 for a spoken thought
uniform float uPixelRatio;
uniform float uFocus;
uniform float uHover;
uniform float uTime;
uniform float uMotion;
varying vec3 vColor;
varying float vCurrent;
varying float vIntensity;
varying float vVoice;
void main() {
  vVoice = aVoice * (1.0 - uOverview) * (0.7 + 0.3 * sin(uTime * 2.2 + aIndex));
  float o = aIsTopic > 0.5 ? 1.0 : openOf(aTopic);
  vec3 p = aIsTopic > 0.5 ? aCenter : opened(aCenter, aRest, o);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(1.0, -mv.z);
  float cur = 1.0 - smoothstep(0.0, 0.8, abs(aTopic - uP));
  float near = clamp(1100.0 / d, 0.0, 1.0);
  float focus = (uFocus >= 0.0 && abs(aIndex - uFocus) < 0.5) ? 1.0 : 0.0;
  float hover = (uHover >= 0.0 && abs(aIndex - uHover) < 0.5) ? 1.0 : 0.0;
  float size;
  if (aIsTopic > 0.5) {
    size = mix(clamp(3200.0 / d, 4.0, 22.0), 7.0, uOverview) * (1.0 + cur * 0.9);
  } else {
    size = mix(clamp(1500.0 / d, 2.5, 13.0), 3.0, uOverview) * (0.35 + 0.65 * o) * (1.0 + focus * 1.3 + hover * 0.5);
  }
  size *= 1.0 + 0.06 * uMotion * sin(uTime * 1.7 + aTopic * 2.3 + aIndex);
  gl_PointSize = size * uPixelRatio;
  vColor = aColor;
  vCurrent = max(aIsTopic * cur, focus) * (1.0 - uOverview);
  float base = aIsTopic > 0.5 ? mix(0.8 + 1.8 * near, 1.8, uOverview) * (1.0 + cur * 1.2) : mix(0.5 + 1.4 * near, 1.1, uOverview) * o;
  vIntensity = base * (1.0 + focus * 1.6 + hover * 0.6);
}
`;

export const thoughtFragment = /* glsl */ `
varying vec3 vColor;
varying float vCurrent;
varying float vIntensity;
varying float vVoice;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * 30.0);
  float halo = exp(-r2 * 5.0) * 0.35;
  float spikes = (exp(-abs(c.x) * 40.0) * exp(-abs(c.y) * 2.2) + exp(-abs(c.y) * 40.0) * exp(-abs(c.x) * 2.2)) * vCurrent * 0.9;
  // A spoken thought breathes: a soft ring around its star.
  float ring = exp(-pow((sqrt(r2) - 0.62 - 0.12 * vVoice) * 13.0, 2.0)) * vVoice * 0.9;
  vec3 col = mix(vColor, vec3(1.0), core * 0.7);
  gl_FragColor = vec4(col * (core * 3.0 + halo + spikes + ring) * vIntensity, 1.0);
}
`;

/** The chain: a thread of light through the day, brightest just ahead of you. */
export const pathVertex = /* glsl */ `
attribute float aIndex;
uniform float uP;
uniform float uOverview;
uniform float uChain;   // 0 before the journey begins
uniform float uTime;
uniform float uMotion;
varying float vAlpha;
varying float vBead;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float k = aIndex - uP;
  float journey = smoothstep(-1.2, 0.2, k) * (1.0 - smoothstep(3.0, 8.0, k));
  vAlpha = mix(journey * 0.55, 0.16, uOverview) * uChain;
  vBead = pow(max(0.0, sin((aIndex * 0.9 - uTime * 0.55) * 3.14159)), 18.0) * uMotion;
}
`;

export const pathFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying float vBead;
void main() {
  gl_FragColor = vec4(uColor * vAlpha * (1.0 + vBead * 2.5), 1.0);
}
`;

/**
 * Every connection, drawn as a curve between two ends that move as rings open:
 * 0 topic to its thought · 1 thought to thought in a topic ·
 * 2 thought to thought across topics · 3 topic to topic.
 */
export const linkVertex = /* glsl */ `
${OPEN}
attribute vec3 aA;
attribute vec3 aAr;
attribute vec3 aB;
attribute vec3 aBr;
attribute vec2 aTopics;
attribute vec2 aEnds;     // thought indices; -1 for a topic's own star
attribute float aT;
attribute float aLift;
attribute float aKind;
attribute float aStrength;
attribute vec3 aColor;
uniform float uFocus;
uniform float uHover;
uniform float uChain;
uniform float uTime;
uniform float uMotion;
uniform vec3 uAccent;
uniform float uAcross;    // how present threads to other topics are at rest (stronger under a lens)
varying vec3 vColor;
varying float vAlpha;
void main() {
  float oA = openOf(aTopics.x);
  float oB = openOf(aTopics.y);
  vec3 A = opened(aA, aAr, oA);
  vec3 B = opened(aB, aBr, oB);
  vec3 C = (A + B) * 0.5 + vec3(0.0, 0.0, aLift);
  float m = 1.0 - aT;
  vec3 p = m * m * A + 2.0 * m * aT * C + aT * aT * B;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);

  float near = 1.0 - smoothstep(0.3, 0.9, min(abs(aTopics.x - uP), abs(aTopics.y - uP)));
  bool onFocus = uFocus >= 0.0 && (abs(aEnds.x - uFocus) < 0.5 || abs(aEnds.y - uFocus) < 0.5);
  bool onHover = uHover >= 0.0 && (abs(aEnds.x - uHover) < 0.5 || abs(aEnds.y - uHover) < 0.5);
  float a;
  vec3 col;
  if (aKind < 0.5) {
    a = oA * 0.22 * (1.0 - 0.7 * uOverview);
    col = vec3(0.62, 0.68, 0.86);
  } else if (aKind < 1.5) {
    a = oA * (0.32 + 0.25 * aStrength) * (1.0 - 0.6 * uOverview);
    col = aColor;
  } else if (aKind < 2.5) {
    a = mix(near * uAcross, uAcross * 0.5, uOverview) * (0.6 + 0.4 * aStrength);
    col = aColor;
  } else {
    a = mix(near * 0.16, 0.12, uOverview) * (0.35 + 0.65 * aStrength);
    col = uAccent;
  }
  // A focused thought pulls its own connections forward and quiets the rest.
  if (uFocus >= 0.0) a = onFocus ? max(a, 0.8) : a * 0.25;
  if (onHover) a = max(a, 0.65);

  // Lines start just off each star, and a bead of light runs along them.
  float ends = smoothstep(0.0, 0.06, aT) * smoothstep(1.0, 0.94, aT);
  float x = fract(aT * (aKind > 1.5 ? 2.0 : 1.0) - uTime * 0.12 + aStrength * 3.7);
  float bead = exp(-pow((x - 0.5) * 11.0, 2.0)) * uMotion;
  vColor = col * (1.0 + bead * 1.6);
  vAlpha = a * ends * uChain * (0.75 + 0.6 * bead);
}
`;

export const linkFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(vColor * vAlpha, 1.0);
}
`;

/** Day grade: the whole sky shifts from dawn to night with the thought you're on. */
export const gradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTint: { value: [1, 1, 1] as [number, number, number] },
    uExposure: { value: 1 },
    // Starlight dims a little where the current thought's words sit, so they read.
    uQuiet: { value: [0.5, 0.5] as [number, number] },
    uQuietSize: { value: [0.3, 0.2] as [number, number] },
    uQuietAmount: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uTint;
    uniform float uExposure;
    uniform vec2 uQuiet;
    uniform vec2 uQuietSize;
    uniform float uQuietAmount;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - uQuiet) / uQuietSize;
      float quiet = 1.0 - uQuietAmount * exp(-dot(d, d) * 1.6);
      gl_FragColor = vec4(c.rgb * uTint * uExposure * quiet, c.a);
    }
  `,
};
