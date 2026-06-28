"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LyricLine } from "@/lib/types";
import type { PlaybackAnchor } from "@/hooks/usePlayback";
import { OFFSET_MAX, OFFSET_MIN } from "@/hooks/useLyricSettings";

/**
 * Tap-to-the-beat sync calibration (docs/16). The user taps as they hear each
 * line; we compare each tap to the nearest lyric timestamp and derive the sync
 * offset, so they don't have to nudge ± by hand.
 *
 * Math: at each tap, `delta = nearestLineTime − rawAudioPosition`. A tap lands
 * ~200ms after the perceived onset (reaction time), so
 *   offset = median(delta) + TAP_REACTION_MS
 * which lands a perfectly-synced song near 0 and cancels real LRC drift.
 * Positive offset ⇒ lyrics shown earlier; negative ⇒ later.
 */

const MIN_TAPS = 4;
const MAX_TAPS = 8;
const TAP_REACTION_MS = 200;
const REJECT_BEYOND_MS = 3000; // ignore taps not near any line

function rawPos(a: PlaybackAnchor): number {
  return a.isPlaying ? a.progressMs + (performance.now() - a.receivedAt) : a.progressMs;
}

function nearestLineDelta(lines: LyricLine[], pos: number): number | null {
  let best: number | null = null;
  for (const l of lines) {
    const d = l.tMs - pos;
    if (best === null || Math.abs(d) < Math.abs(best)) best = d;
  }
  if (best === null || Math.abs(best) > REJECT_BEYOND_MS) return null;
  return best;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const clamp = (v: number) => Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, v));

export default function SyncCalibrator({
  lines,
  anchor,
  onApply,
  onCancel,
}: {
  lines: LyricLine[];
  anchor: PlaybackAnchor | null;
  onApply: (offsetMs: number) => void;
  onCancel: () => void;
}) {
  const [deltas, setDeltas] = useState<number[]>([]);
  const anchorRef = useRef(anchor);
  useEffect(() => {
    anchorRef.current = anchor;
  }, [anchor]);

  const tap = useCallback(() => {
    const a = anchorRef.current;
    if (!a) return;
    const d = nearestLineDelta(lines, rawPos(a));
    if (d === null) return; // tap nowhere near a line — ignore
    setDeltas((prev) => [...prev, d].slice(-MAX_TAPS));
  }, [lines]);

  const ready = deltas.length >= MIN_TAPS;
  const computed = ready ? clamp(Math.round(median(deltas) + TAP_REACTION_MS)) : 0;
  const sign = computed > 0 ? "+" : "";

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 px-8 text-center backdrop-blur-sm">
      <h2 className="text-[clamp(1.4rem,3vw,2rem)] font-semibold text-lyric-active">
        Tap to the beat
      </h2>
      <p className="mt-2 max-w-md text-[clamp(0.95rem,2vw,1.2rem)] text-lyric-dim">
        Tap the button each time you hear a new line. {MIN_TAPS}+ taps tunes the
        timing automatically.
      </p>

      {/* Big tap target. */}
      <button
        onClick={tap}
        className="mt-8 flex h-44 w-44 items-center justify-center rounded-full text-xl font-bold text-black transition active:scale-90"
        style={{ background: "var(--accent)" }}
      >
        TAP
      </button>

      <div className="mt-6 h-7 text-base text-lyric-dim">
        {deltas.length === 0
          ? "Waiting for your first tap…"
          : ready
          ? `Suggested offset: ${sign}${computed} ms`
          : `${deltas.length}/${MIN_TAPS} taps…`}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={onCancel}
          className="h-14 rounded-full px-6 text-base font-semibold text-lyric-dim active:scale-95"
        >
          Cancel
        </button>
        {deltas.length > 0 && (
          <button
            onClick={() => setDeltas([])}
            className="h-14 rounded-full bg-white/10 px-6 text-base font-semibold text-lyric-active active:scale-95"
          >
            Redo
          </button>
        )}
        <button
          onClick={() => onApply(computed)}
          disabled={!ready}
          className="h-14 rounded-full px-7 text-base font-semibold text-black disabled:opacity-40 active:scale-95"
          style={{ background: "var(--accent)" }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
