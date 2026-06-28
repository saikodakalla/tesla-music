import type { LyricsCandidate, LyricsDoc } from "../types";

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
 *
 * `search`/`getById` are optional — they power the "wrong lyrics? re-pick"
 * flow. A provider that can't search simply omits them and that UI degrades to
 * empty results rather than breaking.
 */
export interface LyricsProvider {
  readonly name: string;
  getLyrics(query: TrackQuery): Promise<LyricsDoc>;
  /** Free-text search for candidate records the user can manually choose. */
  search?(term: string): Promise<LyricsCandidate[]>;
  /** Fetch a specific record by its provider id and normalise to a LyricsDoc. */
  getById?(id: string): Promise<LyricsDoc>;
}

import { LrclibProvider } from "./lrclib";

let provider: LyricsProvider | null = null;

/** The active provider. Default: LRCLIB (free, no key). */
export function getLyricsProvider(): LyricsProvider {
  if (!provider) provider = new LrclibProvider();
  return provider;
}
