/** Shared types used across the API boundary and the client. */

/** A single timed lyric line. `tMs` is an absolute offset into the track. */
export interface LyricLine {
  tMs: number;
  text: string;
}

/** Parsed, normalised lyrics document (docs/07 §7.5). */
export interface LyricsDoc {
  source: string;
  /** Provider record id, when the source exposes one (used to cycle matches). */
  providerId?: string;
  trackKey: string;
  durationMs: number;
  /** true → `lines` carries synced timestamps; false → only `plain` is meaningful. */
  synced: boolean;
  instrumental: boolean;
  /** Sorted by tMs ascending. Empty for instrumental / not-found. */
  lines: LyricLine[];
  /** Unsynced fallback text, when present. */
  plain?: string;
  /** true when neither synced nor plain lyrics were found. */
  notFound: boolean;
}

/**
 * A lyrics candidate surfaced by a provider search, for the "wrong lyrics?
 * re-pick" flow. `id` is the provider-specific record id passed back to
 * `getById` to fetch the full document.
 */
export interface LyricsCandidate {
  id: string;
  trackName: string;
  artistName: string;
  albumName: string | null;
  durationSec: number | null;
  hasSynced: boolean;
  instrumental: boolean;
}

export type CurrentlyPlayingType = "track" | "episode" | "ad" | "unknown";

/**
 * Normalised playback snapshot returned by /api/playback.
 *
 * `progressMs` is already latency-corrected server-side using Spotify's own
 * `timestamp` (docs/06 §6.2), so the client can anchor its local clock directly
 * on the moment it receives this payload.
 */
export interface PlaybackState {
  /** false when nothing is playing / no active device (Spotify 204). */
  isActive: boolean;
  isPlaying: boolean;
  type: CurrentlyPlayingType;
  progressMs: number;
  durationMs: number;
  /** Spotify track id — the song-change signal. null when idle. */
  trackId: string | null;
  title: string | null;
  artists: string | null;
  album: string | null;
  albumArtUrl: string | null;
  /** Link back to the track on Spotify (attribution, docs/06 §6.6). */
  spotifyUrl: string | null;
  /** ISRC when available — a precise lyric-match key. */
  isrc: string | null;
  /** Name of the active device (e.g. "Tesla", phone), informational. */
  deviceName: string | null;
}

/** Compact queue item used by Next Up and lyric prefetching. */
export interface QueueTrack {
  trackId: string;
  title: string;
  artists: string;
  album: string | null;
  albumArtUrl: string | null;
  durationMs: number;
  spotifyUrl: string | null;
  isrc: string | null;
}

/** Auth/session status surfaced to the client. */
export interface SessionStatus {
  authenticated: boolean;
}
