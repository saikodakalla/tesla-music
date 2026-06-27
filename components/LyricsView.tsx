"use client";

import { useEffect, useRef, useState } from "react";
import type { LyricLine } from "@/lib/types";
import type { PlaybackAnchor } from "@/hooks/usePlayback";

/**
 * Synced lyric view (docs/08 §8.2, §8.6, §8.9).
 *
 * A single requestAnimationFrame loop advances the interpolated position from
 * the latest poll anchor and picks the active line by binary search. State only
 * changes when the active line (or gap) changes — at most once per lyric line —
 * so React doesn't re-render every frame. The visible window of lines is
 * positioned with composited `transform` (no reflow); CSS transitions produce
 * the smooth upward glide.
 */

const PAST = 2; // lines kept above the active line
const AHEAD = 6; // lines kept below

function findActiveIndex(lines: LyricLine[], posMs: number): number {
  // Largest index whose tMs <= posMs; -1 before the first line.
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].tMs <= posMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export default function LyricsView({
  lines,
  anchor,
}: {
  lines: LyricLine[];
  anchor: PlaybackAnchor | null;
}) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [inGap, setInGap] = useState(false);

  const anchorRef = useRef<PlaybackAnchor | null>(anchor);
  const linesRef = useRef<LyricLine[]>(lines);
  useEffect(() => {
    anchorRef.current = anchor;
  }, [anchor]);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const a = anchorRef.current;
      const ls = linesRef.current;
      if (a && ls.length > 0) {
        const pos = a.isPlaying
          ? a.progressMs + (performance.now() - a.receivedAt)
          : a.progressMs;

        const idx = findActiveIndex(ls, pos);
        setActiveIndex((prev) => (prev === idx ? prev : idx));

        // Gap = current slot is an empty/instrumental line and the next line
        // is still a moment away, or we're in the intro before the first line.
        let gap: boolean;
        if (idx < 0) {
          gap = ls[0].tMs - pos > 2500;
        } else {
          const next = ls[idx + 1];
          gap =
            ls[idx].text.trim() === "" &&
            (!next || next.tMs - pos > 1200);
        }
        setInGap((prev) => (prev === gap ? prev : gap));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const center = activeIndex < 0 ? 0 : activeIndex;
  const start = Math.max(0, center - PAST);
  const end = Math.min(lines.length - 1, center + AHEAD);

  const windowLines: { line: LyricLine; idx: number }[] = [];
  for (let i = start; i <= end; i++) windowLines.push({ line: lines[i], idx: i });

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="lyric-stage absolute inset-0">
        {windowLines.map(({ line, idx }) => {
          const offset = idx - center;
          const isActive = idx === activeIndex;
          const style = lineStyle(offset, isActive);
          return (
            <p
              key={idx}
              className="lyric-line absolute left-1/2 top-1/2 mx-auto w-[84vw] max-w-[1500px] px-4 text-center font-semibold leading-[1.12] text-balance"
              style={{
                fontSize: "clamp(2.3rem, 4.8vw, 4.4rem)",
                color: isActive ? "var(--c-active, #f5f6f8)" : "#c3c8d2",
                ...style,
              }}
            >
              {line.text || (isActive ? "" : "♪")}
            </p>
          );
        })}

        {/* Instrumental / intro gap affordance (docs/08 §8.6, edge case #23). */}
        {inGap && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-3">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="gap-dot h-3 w-3 rounded-full bg-lyric-dim"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Position + emphasis for a line at `offset` slots from center. */
function lineStyle(offset: number, isActive: boolean): React.CSSProperties {
  const gap = "clamp(3.6rem, 9vh, 7.5rem)";
  const scale = isActive ? 1 : offset === 0 ? 0.72 : 0.6;

  let opacity: number;
  if (isActive) opacity = 1;
  else if (offset === 0)
    opacity = 0.5; // intro: first line waiting at center, not yet active
  else if (offset > 0) opacity = [0, 0.6, 0.42, 0.3, 0.2, 0.13][Math.min(offset, 5)];
  else opacity = [0, 0.34, 0.18, 0.1][Math.min(-offset, 3)];

  return {
    opacity,
    transform: `translate(-50%, -50%) translateY(calc(${offset} * ${gap})) scale(${scale})`,
    transitionProperty: "transform, opacity",
    transitionDuration: "420ms",
    transitionTimingFunction: "cubic-bezier(0.22, 0.61, 0.36, 1)",
  };
}
