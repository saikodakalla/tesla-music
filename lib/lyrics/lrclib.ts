import { env } from "../env";
import type { LyricsDoc } from "../types";
import type { LyricsProvider, TrackQuery } from "./provider";
import { parseLrc } from "./lrc";
import { normalizeArtist, normalizeTitle, trackKey } from "./match";

const BASE = "https://lrclib.net/api";

interface LrclibRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string | null;
  duration: number | null; // seconds
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

/**
 * LRCLIB lyrics provider (docs/07). Free, public, no key/auth. Tries the exact
 * `/get` match first (track+artist+album+duration ±2s), then falls back to
 * `/search` and picks the closest candidate by duration + synced availability.
 */
export class LrclibProvider implements LyricsProvider {
  readonly name = "lrclib";

  async getLyrics(query: TrackQuery): Promise<LyricsDoc> {
    const key = trackKey(query);
    const durationMs = query.durationMs;

    const record =
      (await this.exactGet(query)) ?? (await this.searchBest(query));

    if (!record) {
      return notFound(key, durationMs);
    }

    if (record.instrumental) {
      return {
        source: this.name,
        trackKey: key,
        durationMs,
        synced: false,
        instrumental: true,
        lines: [],
        notFound: false,
      };
    }

    if (record.syncedLyrics && record.syncedLyrics.trim()) {
      const lines = parseLrc(record.syncedLyrics);
      if (lines.length > 0) {
        return {
          source: this.name,
          trackKey: key,
          durationMs,
          synced: true,
          instrumental: false,
          lines,
          plain: record.plainLyrics ?? undefined,
          notFound: false,
        };
      }
    }

    if (record.plainLyrics && record.plainLyrics.trim()) {
      return {
        source: this.name,
        trackKey: key,
        durationMs,
        synced: false,
        instrumental: false,
        lines: [],
        plain: record.plainLyrics,
        notFound: false,
      };
    }

    return notFound(key, durationMs);
  }

  private headers() {
    return {
      "User-Agent": env.lrclibUserAgent,
      Accept: "application/json",
    };
  }

  private async exactGet(query: TrackQuery): Promise<LrclibRecord | null> {
    const params = new URLSearchParams({
      track_name: query.title,
      artist_name: query.artist,
      duration: String(Math.round(query.durationMs / 1000)),
    });
    if (query.album) params.set("album_name", query.album);

    try {
      const res = await fetch(`${BASE}/get?${params.toString()}`, {
        headers: this.headers(),
        cache: "no-store",
      });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return (await res.json()) as LrclibRecord;
    } catch {
      return null;
    }
  }

  private async searchBest(query: TrackQuery): Promise<LrclibRecord | null> {
    const params = new URLSearchParams({
      track_name: normalizeTitle(query.title),
      artist_name: normalizeArtist(query.artist),
    });

    try {
      const res = await fetch(`${BASE}/search?${params.toString()}`, {
        headers: this.headers(),
        cache: "no-store",
      });
      if (!res.ok) return null;
      const results = (await res.json()) as LrclibRecord[];
      if (!Array.isArray(results) || results.length === 0) return null;

      const targetSec = query.durationMs / 1000;
      // Rank: prefer synced lyrics, then closest duration.
      const scored = results
        .map((r) => {
          const durDelta =
            r.duration != null ? Math.abs(r.duration - targetSec) : 9999;
          const hasSynced = !!(r.syncedLyrics && r.syncedLyrics.trim());
          return { r, durDelta, hasSynced };
        })
        .sort((a, b) => {
          if (a.hasSynced !== b.hasSynced) return a.hasSynced ? -1 : 1;
          return a.durDelta - b.durDelta;
        });

      const best = scored[0];
      // Guard against wildly wrong duration matches (> 15s off and not synced).
      if (best.durDelta > 15 && !best.hasSynced) return null;
      return best.r;
    } catch {
      return null;
    }
  }
}

function notFound(key: string, durationMs: number): LyricsDoc {
  return {
    source: "lrclib",
    trackKey: key,
    durationMs,
    synced: false,
    instrumental: false,
    lines: [],
    notFound: true,
  };
}
