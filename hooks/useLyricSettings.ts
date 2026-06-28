"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Global, persisted lyric display preferences (docs/16: font scaling + manual
 * sync-offset nudge). One global value each — they correct systemic things
 * (cabin viewing distance, display/network latency), so they apply across songs.
 *
 * SSR-safe: defaults render on the server, real values hydrate from
 * localStorage in an effect to avoid a hydration mismatch.
 */

const FONT_KEY = "tl_font_scale";
const OFFSET_KEY = "tl_sync_offset";

export const FONT_MIN = 0.8;
export const FONT_MAX = 1.5;
export const FONT_STEP = 0.1;

export const OFFSET_MIN = -3000;
export const OFFSET_MAX = 3000;
export const OFFSET_STEP = 50;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export interface LyricSettings {
  fontScale: number;
  setFontScale: (v: number) => void;
  syncOffsetMs: number;
  setSyncOffsetMs: (v: number) => void;
}

export function useLyricSettings(): LyricSettings {
  const [fontScale, setFontScaleState] = useState(1);
  const [syncOffsetMs, setSyncOffsetState] = useState(0);

  // Hydrate from localStorage after mount.
  useEffect(() => {
    try {
      const f = parseFloat(localStorage.getItem(FONT_KEY) ?? "");
      if (!Number.isNaN(f)) setFontScaleState(clamp(f, FONT_MIN, FONT_MAX));
      const o = parseInt(localStorage.getItem(OFFSET_KEY) ?? "", 10);
      if (!Number.isNaN(o)) setSyncOffsetState(clamp(o, OFFSET_MIN, OFFSET_MAX));
    } catch {
      /* localStorage unavailable — keep defaults */
    }
  }, []);

  const setFontScale = useCallback((v: number) => {
    const next = clamp(Number(v.toFixed(2)), FONT_MIN, FONT_MAX);
    setFontScaleState(next);
    try {
      localStorage.setItem(FONT_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setSyncOffsetMs = useCallback((v: number) => {
    const next = clamp(Math.round(v), OFFSET_MIN, OFFSET_MAX);
    setSyncOffsetState(next);
    try {
      localStorage.setItem(OFFSET_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  return { fontScale, setFontScale, syncOffsetMs, setSyncOffsetMs };
}
