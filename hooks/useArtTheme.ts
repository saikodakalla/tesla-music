"use client";

import { useEffect, useState } from "react";
import { extractPalette } from "@/lib/color";

const DEFAULT_ACCENT = "#f5f6f8"; // neutral lyric-active white
// Cool neutral palette for the gradient mesh when there's no art (idle/podcast).
const DEFAULT_PALETTE = ["#2a3346", "#202738", "#161b27"];

export interface ArtTheme {
  /** Dominant accent (palette[0] when art is present), for lyric/UI tinting. */
  accent: string;
  /** Hue-diverse colour set driving the gradient-mesh background. */
  palette: string[];
}

/**
 * Derives a night-readable accent + palette from the current album art. Falls
 * back to neutral defaults when there's no art or the canvas is CORS-tainted.
 * Re-extracts only when the art URL changes; cancellable so a fast song change
 * doesn't apply stale colours.
 */
export function useArtTheme(albumArtUrl: string | null | undefined): ArtTheme {
  const [palette, setPalette] = useState<string[] | null>(null);

  useEffect(() => {
    if (!albumArtUrl) {
      setPalette(null);
      return;
    }
    let cancelled = false;
    extractPalette(albumArtUrl)
      .then((colors) => {
        if (!cancelled) setPalette(colors);
      })
      .catch(() => {
        if (!cancelled) setPalette(null);
      });
    return () => {
      cancelled = true;
    };
  }, [albumArtUrl]);

  return {
    accent: palette?.[0] ?? DEFAULT_ACCENT,
    palette: palette && palette.length > 0 ? palette : DEFAULT_PALETTE,
  };
}
