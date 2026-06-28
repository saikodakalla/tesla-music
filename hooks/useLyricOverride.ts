"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Persists per-track manual lyric picks for the "wrong lyrics? re-pick" flow.
 * Maps a Spotify trackId → the chosen provider record id, so the manual choice
 * sticks every time that song comes back. Stored in localStorage.
 */

const KEY = "tl_lyric_overrides";

type OverrideMap = Record<string, string>;

function read(): OverrideMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as OverrideMap) : {};
  } catch {
    return {};
  }
}

function write(map: OverrideMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export interface LyricOverrides {
  /** Override record id for the current track, or null. */
  overrideId: string | null;
  /** Pin a record id for the given track. */
  setOverride: (trackId: string, recordId: string) => void;
  /** Remove the override for the given track (revert to automatic match). */
  clearOverride: (trackId: string) => void;
}

export function useLyricOverride(
  trackId: string | null | undefined,
): LyricOverrides {
  const [map, setMap] = useState<OverrideMap>({});

  useEffect(() => {
    setMap(read());
  }, []);

  const setOverride = useCallback((tid: string, recordId: string) => {
    setMap((prev) => {
      const next = { ...prev, [tid]: recordId };
      write(next);
      return next;
    });
  }, []);

  const clearOverride = useCallback((tid: string) => {
    setMap((prev) => {
      if (!(tid in prev)) return prev;
      const next = { ...prev };
      delete next[tid];
      write(next);
      return next;
    });
  }, []);

  const overrideId = trackId ? map[trackId] ?? null : null;
  return { overrideId, setOverride, clearOverride };
}
