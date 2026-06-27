import type { LyricsDoc } from "../types";

/** Identifies the track we want lyrics for. */
export interface TrackQuery {
  title: string;
  artist: string;
  album?: string | null;
  durationMs: number;
  isrc?: string | null;
}

/**
 * Swappable lyrics backend (docs/07 §7.3). The app only ever talks to this
 * interface, so dropping in Musixmatch / LyricFind / a self-hosted LRCLIB
 * mirror later is a one-file change, not a rewrite.
 */
export interface LyricsProvider {
  readonly name: string;
  getLyrics(query: TrackQuery): Promise<LyricsDoc>;
}

import { LrclibProvider } from "./lrclib";

let provider: LyricsProvider | null = null;

/** The active provider. Default: LRCLIB (free, no key). */
export function getLyricsProvider(): LyricsProvider {
  if (!provider) provider = new LrclibProvider();
  return provider;
}
