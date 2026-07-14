"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Persisted look-and-feel preferences for the ambient theme (docs/16: theme
 * customization). SSR-safe: defaults render server-side, real values hydrate
 * from localStorage in an effect.
 */

export type BackdropStyle = "blur" | "mesh" | "minimal";

const BACKDROP_KEY = "tl_backdrop";
const ACCENT_LYRICS_KEY = "tl_accent_lyrics";
const MOTION_KEY = "tl_ambient_motion";
const SECTIONS_KEY = "tl_song_sections";

export const BACKDROP_OPTIONS: { value: BackdropStyle; label: string }[] = [
  { value: "blur", label: "Album blur" },
  { value: "mesh", label: "Gradient mesh" },
  { value: "minimal", label: "Minimal" },
];

export interface ThemeSettings {
  backdrop: BackdropStyle;
  setBackdrop: (v: BackdropStyle) => void;
  accentLyrics: boolean;
  setAccentLyrics: (v: boolean) => void;
  ambientMotion: boolean;
  setAmbientMotion: (v: boolean) => void;
  showSongSections: boolean;
  setShowSongSections: (v: boolean) => void;
}

function readBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === "1";
}

export function useThemeSettings(): ThemeSettings {
  const [backdrop, setBackdropState] = useState<BackdropStyle>("blur");
  const [accentLyrics, setAccentLyricsState] = useState(true);
  const [ambientMotion, setAmbientMotionState] = useState(true);
  const [showSongSections, setShowSongSectionsState] = useState(true);

  useEffect(() => {
    try {
      const b = localStorage.getItem(BACKDROP_KEY);
      if (b === "blur" || b === "mesh" || b === "minimal") setBackdropState(b);
      setAccentLyricsState(readBool(ACCENT_LYRICS_KEY, true));
      setAmbientMotionState(readBool(MOTION_KEY, true));
      setShowSongSectionsState(readBool(SECTIONS_KEY, true));
    } catch {
      /* localStorage unavailable — keep defaults */
    }
  }, []);

  const persist = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  };

  const setBackdrop = useCallback((v: BackdropStyle) => {
    setBackdropState(v);
    persist(BACKDROP_KEY, v);
  }, []);
  const setAccentLyrics = useCallback((v: boolean) => {
    setAccentLyricsState(v);
    persist(ACCENT_LYRICS_KEY, v ? "1" : "0");
  }, []);
  const setAmbientMotion = useCallback((v: boolean) => {
    setAmbientMotionState(v);
    persist(MOTION_KEY, v ? "1" : "0");
  }, []);
  const setShowSongSections = useCallback((v: boolean) => {
    setShowSongSectionsState(v);
    persist(SECTIONS_KEY, v ? "1" : "0");
  }, []);

  return {
    backdrop,
    setBackdrop,
    accentLyrics,
    setAccentLyrics,
    ambientMotion,
    setAmbientMotion,
    showSongSections,
    setShowSongSections,
  };
}
