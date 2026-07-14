"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LyricLine } from "@/lib/types";
import type { PlaybackAnchor } from "@/hooks/usePlayback";
import type { LyricDisplayMode } from "@/hooks/useLyricTransform";
import { detectLyricSections } from "@/lib/lyrics/structure";

/**
 * Synced lyric view, styled after Spotify's full-screen lyrics (docs/08 §8.2).
 *
 *  - No "pop": lines never scale. The active line is brighter (solid white,
 *    bold); the rest sit at a uniform dim white. Emphasis is colour, not size.
 *  - Auto-scroll: a real scroll container keeps the active line at a fixed
 *    anchor height. A single rAF loop interpolates playback position and picks
 *    the active line by binary search; state changes at most once per line.
 *  - Manual scroll: the user can wheel/drag through the lyrics at any time.
 *    Doing so suspends auto-scroll; after a few seconds of no interaction it
 *    smoothly snaps back to the active line and resumes following the song.
 */

// Where the active line rests vertically, as a fraction of the view height.
const ACTIVE_Y_RATIO = 0.42;

// Highlight offset, in ms. Positive = earlier, negative = later. Small positive
// value compensates for fetch latency + render/transition lag. If lyrics feel
// late, raise it; if early, lower it (or go negative). Exported so the sync
// calibrator can account for it when deriving a user offset.
export const LYRIC_LEAD_MS = 200;

// How long to leave auto-scroll suspended after the user scrolls, before
// snapping back to the active line.
const RESUME_AFTER_MS = 5000;
const LONG_GAP_MS = 8000;
const HOLD_CURRENT_LINE_MS = 3500;

function findActiveIndex(lines: LyricLine[], posMs: number): number {
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
  syncOffsetMs = 0,
  accentLyrics = true,
  transformedLines = null,
  displayMode = "original",
  showSongSections = true,
  onLineTap,
}: {
  lines: LyricLine[];
  anchor: PlaybackAnchor | null;
  /** User sync nudge (ms). Positive = lyrics earlier, negative = later. */
  syncOffsetMs?: number;
  /** Tint the active line with the album accent (vs. plain white). */
  accentLyrics?: boolean;
  /** Optional line-index-aligned translation or romanization. */
  transformedLines?: string[] | null;
  displayMode?: LyricDisplayMode;
  showSongSections?: boolean;
  /** Called with a line's index into `lines` when it's tapped. */
  onLineTap?: (index: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [gapSeconds, setGapSeconds] = useState<number | null>(null);
  const [userScrolling, setUserScrolling] = useState(false);
  const sectionLabels = useMemo(() => {
    if (!showSongSections) return new Map<number, string>();
    return new Map(
      detectLyricSections(lines).map((section) => [
        section.startIndex,
        section.label,
      ]),
    );
  }, [lines, showSongSections]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const anchorRef = useRef<PlaybackAnchor | null>(anchor);
  const linesRef = useRef<LyricLine[]>(lines);
  // Live user sync nudge, read inside the rAF loop so changes apply instantly
  // without tearing down the loop.
  const offsetRef = useRef(syncOffsetMs);
  const userScrollingRef = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timestamp until which `scroll` events are our own programmatic auto-scroll
  // and should be ignored (so they don't get mistaken for the user scrolling).
  const programmaticUntil = useRef(0);

  useEffect(() => {
    anchorRef.current = anchor;
  }, [anchor]);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);
  useEffect(() => {
    offsetRef.current = syncOffsetMs;
  }, [syncOffsetMs]);

  // Drive the active line from the interpolated playback clock.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const a = anchorRef.current;
      const ls = linesRef.current;
      if (a && ls.length > 0) {
        const pos =
          (a.isPlaying
            ? a.progressMs + (performance.now() - a.receivedAt)
            : a.progressMs) +
          LYRIC_LEAD_MS +
          offsetRef.current;

        const idx = findActiveIndex(ls, pos);
        setActiveIndex((prev) => (prev === idx ? prev : idx));

        let nextGapSeconds: number | null = null;
        if (idx < 0) {
          const remaining = ls[0].tMs - pos;
          if (remaining > 2500) nextGapSeconds = Math.ceil(remaining / 1000);
        } else {
          const next = ls[idx + 1];
          const fullGap = next ? next.tMs - ls[idx].tMs : 0;
          const remaining = next ? next.tMs - pos : 0;
          const lineHasCleared = pos - ls[idx].tMs >= HOLD_CURRENT_LINE_MS;
          if (
            next &&
            remaining > 1200 &&
            (ls[idx].text.trim() === "" ||
              (fullGap >= LONG_GAP_MS && lineHasCleared))
          ) {
            nextGapSeconds = Math.ceil(remaining / 1000);
          }
        }
        setGapSeconds((prev) =>
          prev === nextGapSeconds ? prev : nextGapSeconds,
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const scrollActiveIntoView = useCallback(
    (behavior: ScrollBehavior) => {
      const c = scrollRef.current;
      const el = lineRefs.current[Math.max(0, activeIndex)];
      if (!c || !el) return;
      const target =
        el.offsetTop - c.clientHeight * ACTIVE_Y_RATIO + el.offsetHeight / 2;
      // Mark the scroll events this triggers as programmatic. Smooth scrolling
      // emits events for a few hundred ms, so cover that window.
      programmaticUntil.current =
        performance.now() + (behavior === "smooth" ? 900 : 150);
      c.scrollTo({ top: Math.max(0, target), behavior });
    },
    [activeIndex],
  );

  // Follow the song when the user isn't manually scrolling.
  useEffect(() => {
    if (userScrollingRef.current) return;
    scrollActiveIntoView("smooth");
  }, [activeIndex, scrollActiveIntoView]);

  // Snap to the active line on mount (no animation).
  useEffect(() => {
    scrollActiveIntoView("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any scroll the component didn't initiate is the user browsing the lyrics →
  // suspend auto-scroll, then resume after a quiet period.
  const onScroll = useCallback(() => {
    if (performance.now() < programmaticUntil.current) return; // our own scroll
    if (!userScrollingRef.current) {
      userScrollingRef.current = true;
      setUserScrolling(true);
    }
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      userScrollingRef.current = false;
      setUserScrolling(false);
      scrollActiveIntoView("smooth");
    }, RESUME_AFTER_MS);
  }, [scrollActiveIntoView]);

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  const resumeNow = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    userScrollingRef.current = false;
    setUserScrolling(false);
    scrollActiveIntoView("smooth");
  }, [scrollActiveIntoView]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="no-scrollbar h-full w-full overflow-y-auto overscroll-contain"
        style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {/* Padding lets the first and last lines reach the anchor height. */}
        <div style={{ paddingTop: "42vh", paddingBottom: "55vh" }}>
          {lines.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = activeIndex >= 0 && idx < activeIndex;
            const tappable = !!onLineTap && line.text.trim() !== "";
            const transformed = transformedLines?.[idx]?.trim() ?? "";
            const sectionLabel = sectionLabels.get(idx);
            const showTransformed = displayMode !== "original" && !!transformed;
            const showOriginal = displayMode !== "transformed" || !showTransformed;
            return (
              <p
                key={idx}
                ref={(el) => {
                  lineRefs.current[idx] = el;
                }}
                onClick={tappable ? () => onLineTap!(idx) : undefined}
                role={tappable ? "button" : undefined}
                className={`mx-auto w-full max-w-[1400px] px-[7vw] py-[1.15vh] text-left font-extrabold leading-[1.18] ${
                  tappable ? "cursor-pointer active:opacity-70" : ""
                }`}
                style={{
                  fontSize:
                    "calc(clamp(2rem, 4.1vw, 3.6rem) * var(--lyric-scale, 1))",
                  color: isActive
                    ? accentLyrics
                      ? "var(--accent, #ffffff)"
                      : "#ffffff"
                    : isPast
                    ? "rgba(255,255,255,0.28)"
                    : "rgba(255,255,255,0.38)",
                  transition: "color 300ms ease",
                }}
              >
                {sectionLabel && (
                  <span className="mb-2 block text-[0.27em] font-semibold uppercase tracking-[0.18em] opacity-55">
                    {sectionLabel}
                  </span>
                )}
                {showOriginal && <span dir="auto">{line.text || "♪"}</span>}
                {showTransformed && (
                  <span
                    dir="auto"
                    className={`block text-[0.58em] font-semibold leading-[1.3] opacity-75 ${
                      showOriginal ? "mt-2" : ""
                    }`}
                  >
                    {transformed}
                  </span>
                )}
              </p>
            );
          })}
        </div>
      </div>

      {/* Instrumental / intro gap affordance — pulsing dots at the anchor. */}
      {gapSeconds !== null && !userScrolling && (
        <div
          className="pointer-events-none absolute flex items-center gap-3 px-[7vw]"
          style={{ top: `${ACTIVE_Y_RATIO * 100}%`, transform: "translateY(-50%)" }}
        >
          <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lyric-dim">
            Next lyric in {gapSeconds}s
          </span>
          <span className="gap-dot h-2.5 w-2.5 rounded-full bg-white/70" />
        </div>
      )}

      {/* While the user is browsing the lyrics, offer a one-tap resync. */}
      {userScrolling && (
        <button
          onClick={resumeNow}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/12 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition active:scale-95"
        >
          Resume
        </button>
      )}
    </div>
  );
}
