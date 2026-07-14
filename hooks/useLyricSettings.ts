"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Persisted lyric display preferences. Font size and device delay apply across
 * songs, while a second timing correction is remembered for each Spotify track.
 *
 * SSR-safe: defaults render on the server, real values hydrate from
 * localStorage in an effect to avoid a hydration mismatch.
 */

const FONT_KEY = "tl_font_scale";
const OFFSET_KEY = "tl_sync_offset";
const TRACK_OFFSETS_KEY = "tl_track_sync_offsets";
const MAX_TRACK_OFFSETS = 250;

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
  /** Combined device and current-track correction used by the lyric clock. */
  syncOffsetMs: number;
  globalSyncOffsetMs: number;
  setGlobalSyncOffsetMs: (v: number) => void;
  trackSyncOffsetMs: number;
  setTrackSyncOffsetMs: (v: number) => void;
}

interface TrackOffsetEntry {
  offsetMs: number;
  updatedAt: number;
}

type TrackOffsetMap = Record<string, TrackOffsetEntry>;

function readTrackOffsets(): TrackOffsetMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(TRACK_OFFSETS_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, TrackOffsetEntry] => {
        const value = entry[1] as Partial<TrackOffsetEntry> | null;
        return (
          !!value &&
          typeof value.offsetMs === "number" &&
          Number.isFinite(value.offsetMs) &&
          typeof value.updatedAt === "number"
        );
      },
    );
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function writeTrackOffset(trackId: string, offsetMs: number) {
  try {
    const map = readTrackOffsets();
    if (offsetMs === 0) {
      delete map[trackId];
    } else {
      map[trackId] = { offsetMs, updatedAt: Date.now() };
    }

    const trimmed = Object.fromEntries(
      Object.entries(map)
        .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
        .slice(0, MAX_TRACK_OFFSETS),
    );
    localStorage.setItem(TRACK_OFFSETS_KEY, JSON.stringify(trimmed));
  } catch {
    /* localStorage unavailable — keep the in-memory value */
  }
}

export function useLyricSettings(trackId?: string | null): LyricSettings {
  const [fontScale, setFontScaleState] = useState(1);
  const [globalSyncOffsetMs, setGlobalSyncOffsetState] = useState(0);
  const [trackSyncOffsetMs, setTrackSyncOffsetState] = useState(0);

  // Hydrate from localStorage after mount.
  useEffect(() => {
    try {
      const f = parseFloat(localStorage.getItem(FONT_KEY) ?? "");
      if (!Number.isNaN(f)) setFontScaleState(clamp(f, FONT_MIN, FONT_MAX));
      const o = parseInt(localStorage.getItem(OFFSET_KEY) ?? "", 10);
      if (!Number.isNaN(o)) {
        setGlobalSyncOffsetState(clamp(o, OFFSET_MIN, OFFSET_MAX));
      }
    } catch {
      /* localStorage unavailable — keep defaults */
    }
  }, []);

  // Restore the correction that belongs to the current Spotify track.
  useEffect(() => {
    if (!trackId) {
      setTrackSyncOffsetState(0);
      return;
    }
    const stored = readTrackOffsets()[trackId]?.offsetMs ?? 0;
    setTrackSyncOffsetState(clamp(Math.round(stored), OFFSET_MIN, OFFSET_MAX));
  }, [trackId]);

  const setFontScale = useCallback((v: number) => {
    const next = clamp(Number(v.toFixed(2)), FONT_MIN, FONT_MAX);
    setFontScaleState(next);
    try {
      localStorage.setItem(FONT_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setGlobalSyncOffsetMs = useCallback((v: number) => {
    const next = clamp(Math.round(v), OFFSET_MIN, OFFSET_MAX);
    setGlobalSyncOffsetState(next);
    try {
      localStorage.setItem(OFFSET_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setTrackSyncOffsetMs = useCallback(
    (v: number) => {
      const next = clamp(Math.round(v), OFFSET_MIN, OFFSET_MAX);
      setTrackSyncOffsetState(next);
      if (trackId) writeTrackOffset(trackId, next);
    },
    [trackId],
  );

  return {
    fontScale,
    setFontScale,
    syncOffsetMs: clamp(
      globalSyncOffsetMs + trackSyncOffsetMs,
      OFFSET_MIN,
      OFFSET_MAX,
    ),
    globalSyncOffsetMs,
    setGlobalSyncOffsetMs,
    trackSyncOffsetMs,
    setTrackSyncOffsetMs,
  };
}
