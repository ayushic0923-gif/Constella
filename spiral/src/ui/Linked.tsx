import { useEffect, useMemo, useRef, useState } from "react";
import type { Engine, Frame } from "../world/Engine";
import type { World } from "../world/layout";
import type { Logic } from "../data/lenses";
import { relatedOf } from "../data/related";

/** Above the thought in focus (or under the pointer): why its filaments reach where they do. */
export function LinkedChip({ engine, world, logic }: { engine: Engine; world: World; logic: Logic | undefined }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const clear = useRef({ key: "", y: 76 });
  const reason = useMemo(() => (active === null ? null : (relatedOf(world, logic, active)[0]?.reason ?? null)), [active, world, logic]);

  useEffect(
    () =>
      engine.subscribe((f: Frame) => {
        // On a phone the open thought's card fills the screen and already lists its connections.
        const crowded = f.width < 700 && f.focus !== null;
        const a = f.overview > 0.5 || f.flying || crowded ? null : (f.focus ?? f.hover);
        setActive(a);
        const el = ref.current;
        if (!el || a === null) return;
        const o = a * 4;
        if (!f.thoughtScreen[o + 2]) {
          el.style.opacity = "0";
          return;
        }
        // The lowest edge of what's pinned to the top (the bar; on a phone, the lens tabs and the way back too),
        // measured again when the screen or the star changes.
        const key = `${f.width}x${f.height}:${a}`;
        if (clear.current.key !== key) {
          let y = 0;
          for (const pinned of document.querySelectorAll(".topbar, .lensbar__tabs, .back-chip")) {
            const r = pinned.getBoundingClientRect();
            if (r.height && r.top < f.height / 2) y = Math.max(y, r.bottom);
          }
          clear.current = { key, y: y + 8 };
        }
        // Above the star and to its left, clear of the words that open to its right; kept on screen.
        // A star too near the top gets its chip underneath instead.
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const sy = f.thoughtScreen[o + 1];
        const x = Math.min(f.width - w - 12, Math.max(12, f.thoughtScreen[o] - w + 8));
        const y = sy - h - 16 >= clear.current.y ? sy - h - 16 : Math.max(clear.current.y, sy + 28);
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.style.opacity = "1";
      }),
    [engine],
  );

  if (active === null || !reason) return null;
  return (
    <p ref={ref} className="linked-chip" style={{ opacity: 0 }}>
      Linked by: {reason}
    </p>
  );
}
