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

    // `exactGet`/`searchBest` return `null` ONLY for a genuine miss (404 /
    // empty results) and throw on transient failures (network, 5xx, 429,
    // timeout). We fire BOTH concurrently so the total wait is the slower call,
    // not their sum — LRCLIB can be seconds-slow and the old sequential path
    // stacked those delays. We prefer the exact match; if it hits we return
    // immediately and the search result is discarded. If neither produces a
    // record and either threw, we rethrow (route → 502, not negative-cached);
    // if both genuinely missed, it's a real "no lyrics".
    const exactP = this.exactGet(query);
    const searchP = this.searchBest(query);
    // Avoid an unhandled rejection if we never await searchP (exact hit path).
    searchP.catch(() => {});

    let record: LrclibRecord | null = null;
    let transient: unknown = null;

    try {
      record = await exactP;
    } catch (e) {
      transient = e;
    }
    if (!record) {
      try {
        record = await searchP;
      } catch (e) {
        transient = e;
      }
    }

    if (!record) {
      if (transient) throw transient; // don't cache; let the poll retry
      return notFound(key, durationMs); // genuine miss; safe to cache
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

  /**
   * Fetch with a hard per-request timeout. A 404 is returned to the caller as a
   * real response (genuine miss); everything else (5xx, 429, network error,
   * timeout) is thrown so the caller can decide NOT to negative-cache it. We
   * retry once on a non-timeout error, but never on a timeout — a request that
   * already blew the deadline will almost certainly time out again, and the
   * point here is to fail fast.
   *
   * The timeout is the important bit: LRCLIB's `/search` occasionally hangs,
   * and without an abort the whole lyrics fetch would stall (the user saw
   * "Finding lyrics…" stuck 45s into a song). Bounding each request keeps the
   * worst case to a few seconds, then we fall back to "no lyrics".
   */
  private async fetchJson(url: string, timeoutMs: number): Promise<Response> {
    const RETRIES = 1;
    let lastErr: unknown = new Error("lrclib: request failed");
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        const res = await fetch(url, {
          headers: this.headers(),
          cache: "no-store",
          signal: controller.signal,
        });
        if (res.ok || res.status === 404) return res;
        lastErr = new Error(`lrclib: HTTP ${res.status}`);
      } catch (e) {
        lastErr = e;
        if (timedOut) break; // don't retry a timeout — fail fast
      } finally {
        clearTimeout(timer);
      }
      if (attempt < RETRIES) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    throw lastErr;
  }

  // `/get` is an indexed exact lookup — normally sub-second; bound it tight.
  // `/search` scans and is much slower (seconds), so it gets a longer budget;
  // the timeout still has to be long enough to receive a genuine "0 results"
  // answer, otherwise an empty (but slow) result would masquerade as a hang.
  private static readonly GET_TIMEOUT_MS = 5000;
  private static readonly SEARCH_TIMEOUT_MS = 9000;

  private async exactGet(query: TrackQuery): Promise<LrclibRecord | null> {
    const params = new URLSearchParams({
      track_name: query.title,
      artist_name: query.artist,
      duration: String(Math.round(query.durationMs / 1000)),
    });
    if (query.album) params.set("album_name", query.album);

    const res = await this.fetchJson(
      `${BASE}/get?${params.toString()}`,
      LrclibProvider.GET_TIMEOUT_MS,
    );
    if (res.status === 404) return null; // genuine miss
    return (await res.json()) as LrclibRecord;
  }

  private async searchBest(query: TrackQuery): Promise<LrclibRecord | null> {
    const params = new URLSearchParams({
      track_name: normalizeTitle(query.title),
      artist_name: normalizeArtist(query.artist),
    });

    {
      const res = await this.fetchJson(
        `${BASE}/search?${params.toString()}`,
        LrclibProvider.SEARCH_TIMEOUT_MS,
      );
      if (res.status === 404) return null;
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
