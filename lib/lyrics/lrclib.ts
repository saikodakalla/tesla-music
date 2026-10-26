import { env } from "../env";
import type { LyricsCandidate, LyricsDoc } from "../types";
import type { LyricsProvider, TrackQuery } from "./provider";
import { parseLrc } from "./lrc";
import { transliterateTelugu } from "./telugu";
import { artistNames, matchText, normalizeArtist, normalizeTitle, titleSimilarity, trackKey } from "./match";

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

  private pending = new Map<string, Promise<LyricsDoc>>();

  getLyrics(query: TrackQuery): Promise<LyricsDoc> {
    const key = trackKey(query);
    const existing = this.pending.get(key);
    if (existing) return existing;
    const request = this.lookup(query).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  private async lookup(query: TrackQuery): Promise<LyricsDoc> {
    const key = trackKey(query);
    const controller = new AbortController();
    // Bound the entire waterfall, including body reads and retries.
    const deadline = setTimeout(() => controller.abort(), 11_000);
    const records: LrclibRecord[] = [];
    let transient: unknown = null;
    const collect = async (request: Promise<LrclibRecord[]>) => {
      try { records.push(...await request); } catch (error) { transient = error; }
    };
    try {
      const search = collect(this.searchRecords({
        track_name: normalizeTitle(query.title),
        artist_name: normalizeArtist(query.artist),
      }, controller.signal));
      let exact: LrclibRecord | null = null;
      try { exact = await this.exactGet(query, controller.signal); }
      catch (error) { transient = error; }
      if (exact) {
        const doc = this.recordToDoc(exact, key, query.durationMs);
        if (doc.synced || doc.instrumental) return doc;
        records.push(exact);
      }
      await search;
      let best = this.bestRecord(records, query);
      if (!best || !this.recordToDoc(best, key, query.durationMs).synced) {
        // Film titles, composer-first Spotify credits and singer-only LRCLIB
        // credits must not prevent a match. Keep every usable plain-text result.
        const variants: Record<string, string>[] = [
          { track_name: normalizeTitle(query.title) },
        ];
        const romanTitle = transliterateTelugu(normalizeTitle(query.title));
        if (romanTitle !== normalizeTitle(query.title)) variants.push({ track_name: romanTitle });
        if (query.album) variants.push({
          q: `${normalizeTitle(query.title)} ${normalizeTitle(query.album)}`,
        });
        const artists = artistNames(query.artist);
        if (artists.length > 1) variants.push({
          track_name: normalizeTitle(query.title), artist_name: artists[artists.length - 1],
        });
        await Promise.all(variants.map((params) => collect(this.searchRecords(params, controller.signal))));
        best = this.bestRecord(records, query);
      }
      if (best) return this.recordToDoc(best, key, query.durationMs);
      // Empty/lyrics-less exact records do not suppress broader lookups.
      if (transient) throw transient;
      return notFound(key, query.durationMs);
    } finally {
      clearTimeout(deadline);
      controller.abort();
    }
  }

  private bestRecord(records: LrclibRecord[], query: TrackQuery): LrclibRecord | null {
    const target = query.durationMs / 1000;
    const artists = artistNames(query.artist).map(matchText);
    const version = /\b(live|cover|karaoke|instrumental|remix|sped up|slowed)\b/gi;
    const requestedVersions = new Set((query.title.match(version) ?? []).map((s) => s.toLowerCase()));
    const ranked = records.flatMap((r) => {
      if (r.instrumental) return [];
      const candidateVersions = new Set((r.trackName.match(version) ?? []).map((v) => v.toLowerCase()));
      if (candidateVersions.size !== requestedVersions.size || [...candidateVersions].some((v) => !requestedVersions.has(v))) return [];
      const similarity = titleSimilarity(query.title, r.trackName);
      const delta = r.duration == null ? Infinity : Math.abs(r.duration - target);
      const artist = artistNames(r.artistName).some((name) => artists.includes(matchText(name)));
      const album = !!query.album && !!r.albumName && matchText(normalizeTitle(query.album)) === matchText(normalizeTitle(r.albumName));
      const doc = this.recordToDoc(r, "candidate", query.durationMs);
      if (doc.notFound || similarity < 0.72) return [];
      // Reject wrong recordings BEFORE preferring synchronized text.
      if (Number.isFinite(delta) && delta > Math.min(10, Math.max(4, target * 0.025))) return [];
      if (!artist && !album && !(similarity >= 0.95 && delta <= 3)) return [];
      if (!Number.isFinite(delta) && (doc.synced || !artist || similarity < 0.95)) return [];
      const score = (doc.synced ? 100 : 0) + similarity * 30 + (artist ? 15 : 0) + (album ? 10 : 0) - Math.min(delta, 20);
      return [{ record: r, score }];
    }).sort((a, b) => b.score - a.score);
    return ranked[0]?.record ?? null;
  }

  private async searchRecords(params: Record<string, string>, signal: AbortSignal): Promise<LrclibRecord[]> {
    const res = await this.fetchJson(`${BASE}/search?${new URLSearchParams(params)}`, 4500, signal);
    if (res.status === 404) return [];
    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error("lrclib: invalid search response");
    return data;
  }

  /**
   * Free-text search → candidate list for the "wrong lyrics? re-pick" flow.
   * Returns [] on a genuine empty result; throws on transient failure so the
   * route can surface it. Ranks synced records first, then closest by title.
   */
  async search(term: string): Promise<LyricsCandidate[]> {
    const params = new URLSearchParams({ q: term });
    const res = await this.fetchJson(
      `${BASE}/search?${params.toString()}`,
      LrclibProvider.SEARCH_TIMEOUT_MS,
    );
    if (res.status === 404) return [];
    const results = (await res.json()) as LrclibRecord[];
    if (!Array.isArray(results)) return [];

    return results
      .map((r) => ({
        id: String(r.id),
        trackName: r.trackName,
        artistName: r.artistName,
        albumName: r.albumName,
        durationSec: r.duration,
        hasSynced: !!(r.syncedLyrics && r.syncedLyrics.trim()),
        instrumental: r.instrumental,
      }))
      .sort((a, b) => (a.hasSynced === b.hasSynced ? 0 : a.hasSynced ? -1 : 1));
  }

  /** Fetch a specific record by LRCLIB id and normalise it to a LyricsDoc. */
  async getById(id: string): Promise<LyricsDoc> {
    const res = await this.fetchJson(
      `${BASE}/get/${encodeURIComponent(id)}`,
      LrclibProvider.GET_TIMEOUT_MS,
    );
    const key = `lrclib:id:${id}`;
    if (res.status === 404) return notFound(key, 0);
    const record = (await res.json()) as LrclibRecord;
    const durationMs = (record.duration ?? 0) * 1000;
    return this.recordToDoc(record, key, durationMs);
  }

  /** Map a raw LRCLIB record into the normalised LyricsDoc shape. */
  private recordToDoc(
    record: LrclibRecord,
    key: string,
    durationMs: number,
  ): LyricsDoc {
    if (record.instrumental) {
      return {
        source: this.name,
        providerId: String(record.id),
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
      if (lines.some((line) => line.text.trim()) && lines.every((line) => line.tMs <= durationMs + 2000 || durationMs === 0)) {
        return {
          source: this.name,
          providerId: String(record.id),
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

    const plain = record.plainLyrics?.trim() || record.syncedLyrics
      ?.replace(/\[(?:\d{1,3}:\d{2}(?:[.:]\d{1,3})?|(?:ar|ti|al|by|offset):[^\]]*)\]/gi, "")
      .replace(/<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g, "").trim();
    if (plain) {
      return {
        source: this.name,
        providerId: String(record.id),
        trackKey: key,
        durationMs,
        synced: false,
        instrumental: false,
        lines: [],
        plain,
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
  private async fetchJson(url: string, timeoutMs: number, parentSignal?: AbortSignal): Promise<Response> {
    const RETRIES = 1;
    let lastErr: unknown = new Error("lrclib: request failed");
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      parentSignal?.throwIfAborted();
      const controller = new AbortController();
      const abort = () => controller.abort();
      parentSignal?.addEventListener("abort", abort, { once: true });
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
        if (res.ok || res.status === 404) {
          const body = await res.text();
          return new Response(body, { status: res.status, headers: res.headers });
        }
        lastErr = new Error(`lrclib: HTTP ${res.status}`);
      } catch (e) {
        lastErr = e;
        if (timedOut) break; // don't retry a timeout — fail fast
      } finally {
        clearTimeout(timer);
        parentSignal?.removeEventListener("abort", abort);
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

  private async exactGet(query: TrackQuery, signal?: AbortSignal): Promise<LrclibRecord | null> {
    const params = new URLSearchParams({
      track_name: query.title,
      artist_name: query.artist,
      duration: String(Math.round(query.durationMs / 1000)),
    });
    if (query.album) params.set("album_name", query.album);

    const res = await this.fetchJson(
      `${BASE}/get?${params.toString()}`,
      LrclibProvider.GET_TIMEOUT_MS,
      signal,
    );
    if (res.status === 404) return null; // genuine miss
    return (await res.json()) as LrclibRecord;
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
