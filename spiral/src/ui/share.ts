import type { Mind } from "../data/model";

// A picture of the galaxy to share: the stars from above and two lines of type, nothing private.
// Everything here runs inside the tap, so the phone's share sheet still counts it as the person's own.

const INK = "#f3f1f7";
const MUTED = "#b9879c";
const SKY = "#020308";

/** "October 2026 · 147 thoughts · 62% light": light is the share of moments that lifted. */
export function posterLine(mind: Mind): string {
  const ts = mind.thoughts;
  if (!ts.length) return "";
  const latest = ts.reduce((a, t) => (t.at > a ? t.at : a), ts[0].at);
  const month = new Date(latest).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const read = ts.filter((t) => t.reading);
  const light = read.filter((t) => t.reading!.valence > 0.15).length;
  const parts = [month, `${ts.length} ${ts.length === 1 ? "thought" : "thoughts"}`];
  if (read.length) parts.push(`${Math.round((light / read.length) * 100)}% light`);
  return parts.join(" · ");
}

function poster(galaxy: HTMLCanvasElement, line: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = galaxy.width;
  c.height = galaxy.height;
  const g = c.getContext("2d")!;
  const { width: w, height: h } = c;
  g.fillStyle = SKY;
  g.fillRect(0, 0, w, h);
  g.drawImage(galaxy, 0, 0);
  // The type sits on the dark under the disc.
  const fade = g.createLinearGradient(0, h * 0.62, 0, h);
  fade.addColorStop(0, "rgba(2, 3, 8, 0)");
  fade.addColorStop(1, "rgba(2, 3, 8, 0.92)");
  g.fillStyle = fade;
  g.fillRect(0, h * 0.62, w, h * 0.38);
  const x = w * 0.067;
  g.textBaseline = "alphabetic";
  g.fillStyle = INK;
  g.font = `300 ${Math.round(w * 0.05)}px "Stack Sans Headline", "Helvetica Neue", Arial, sans-serif`;
  g.fillText("Inside one mind · ideora.space", x, h - h * 0.095);
  g.fillStyle = MUTED;
  g.font = `400 ${Math.round(w * 0.028)}px "Stack Sans Text", "Helvetica Neue", Arial, sans-serif`;
  g.fillText(line, x, h - h * 0.055);
  return c;
}

/** Hands the picture to the phone's share sheet, or saves it where there is none. True when saved. */
export function shareConstellation(galaxy: HTMLCanvasElement, line: string): boolean {
  const url = poster(galaxy, line).toDataURL("image/png");
  const bytes = atob(url.slice(url.indexOf(",") + 1));
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  const file = new File([buf], "my-constellation.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: "Inside one mind" }).catch(() => {
      // closed the share sheet: nothing to do
    });
    return false;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = "my-constellation.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
