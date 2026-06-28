"use client";

import { useEffect, useRef, useState } from "react";
import type { LyricsDoc, PlaybackState } from "@/lib/types";

/**
 * Fetches lyrics whenever the track changes (docs/06 §6.4). Keeps the previous
 * lyrics on screen during the fetch so a song change cross-fades rather than
 * blanking. Only fetches for music tracks.
 *
 * IMPORTANT: `usePlayback` returns a *new* PlaybackState object on every poll
 * (every 1–5s), even when the same song keeps playing. So this effect must key
 * on the track's identity/metadata — NOT the playback object — otherwise it
 * re-runs each poll and its cleanup aborts the in-flight lyrics fetch before it
 * can finish, leaving the UI stuck on "Finding lyrics…".
 */
export function useLyrics(
  playback: PlaybackState | null,
  initialLyrics?: LyricsDoc | null,
  overrideId?: string | null,
): {
  lyrics: LyricsDoc | null;
  loading: boolean;
} {
  const [lyrics, setLyrics] = useState<LyricsDoc | null>(initialLyrics ?? null);
  const [loading, setLoading] = useState(false);
  // Seed `currentKey` with the prefetched track so the first effect run is a
  // no-op (no redundant client refetch when the server already gave us lyrics).
  // Seeded to match the fetchKey format (`${trackId}|${overrideId}`) so a
  // server-prefetched track (no override) is a no-op on first run.
  const currentKey = useRef<string | null>(
    initialLyrics && playback?.trackId ? `${playback.trackId}|` : null,
  );

  const isTrack =
    !!playback &&
    playback.isActive &&
    playback.type === "track" &&
    !!playback.trackId &&
    !!playback.title &&
    !!playback.artists;

  // Only the fields that affect the lyrics lookup. These are stable across
  // polls of the same song, so the effect runs once per track change.
  const trackId = isTrack ? playback!.trackId! : null;
  const title = isTrack ? playback!.title! : "";
  const artists = isTrack ? playback!.artists! : "";
  const album = isTrack ? playback!.album ?? "" : "";
  const durationMs = isTrack ? playback!.durationMs : 0;
  const isrc = isTrack ? playback!.isrc ?? "" : "";

  useEffect(() => {
    if (!trackId) {
      // Non-track (ad/episode/idle): clear lyrics, leave status cards to UI.
      if (currentKey.current !== null) {
        currentKey.current = null;
        setLyrics(null);
        setLoading(false);
      }
      return;
    }

    // Key on both the track and the manual override so that picking a different
    // record for the same song re-runs the fetch (and is treated like a change).
    const fetchKey = `${trackId}|${overrideId ?? ""}`;
    const trackChanged = currentKey.current !== fetchKey;
    currentKey.current = fetchKey;
    let cancelled = false;
    // On a real song change (or override switch), drop the previous lyrics
    // immediately so we never show stale words — the UI shows a brief
    // "Finding lyrics…" until the new ones load.
    if (trackChanged) setLyrics(null);
    setLoading(true);

    // A manual override fetches that exact record by id; otherwise the normal
    // auto-match by metadata.
    const url = overrideId
      ? `/api/lyrics/by-id?id=${encodeURIComponent(overrideId)}`
      : (() => {
          const params = new URLSearchParams({
            title,
            artist: artists,
            durationMs: String(durationMs),
          });
          if (album) params.set("album", album);
          if (isrc) params.set("isrc", isrc);
          return `/api/lyrics?${params.toString()}`;
        })();

    // Retry transient failures (the lyrics endpoint returns 502 when LRCLIB is
    // briefly unreachable or slow) instead of showing "no lyrics" for a song
    // that actually has them. A real "not found" comes back as 200 with
    // `notFound: true` — that's a definitive answer and is shown immediately,
    // never retried. Each attempt has its own timeout so a hung request can't
    // leave the UI stuck; the timeout exceeds the server's own worst case so we
    // don't abort it mid-lookup and false-fail.
    //
    // Crucially we retry BOTH fast and slow failures. A cold LRCLIB lookup is
    // often slow on the first hit and fast once warm — that's why a manual
    // refresh "finds" lyrics the second time. So rather than give up on a slow
    // first failure (which surfaced a wrong "no synced lyrics"), we keep the UI
    // on "Finding lyrics…" and re-request with backoff until LRCLIB answers.
    const MAX_ATTEMPTS = 6;
    const ATTEMPT_TIMEOUT_MS = 12000;
    const BACKOFF_MS = [400, 800, 1500, 2500, 4000];

    const attempt = (n: number): void => {
      if (cancelled) return;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);

      const giveUp = () => {
        setLyrics({
          source: "none",
          trackKey: trackId,
          durationMs,
          synced: false,
          instrumental: false,
          lines: [],
          notFound: true,
        });
        setLoading(false);
      };

      fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
        .then((doc: LyricsDoc) => {
          if (cancelled) return;
          setLyrics(doc);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          if (n < MAX_ATTEMPTS) {
            // Keep `loading` true so the UI stays on "Finding lyrics…" rather
            // than flashing a wrong "no synced lyrics" between attempts.
            const delay = BACKOFF_MS[Math.min(n - 1, BACKOFF_MS.length - 1)];
            setTimeout(() => {
              if (!cancelled) attempt(n + 1);
            }, delay);
            return;
          }
          giveUp();
        })
        .finally(() => clearTimeout(timer));
    };

    attempt(1);

    // Cleanup only runs when the track actually changes (deps below) or on
    // unmount — never on a mere re-poll of the same song.
    return () => {
      cancelled = true;
    };
  }, [trackId, title, artists, album, durationMs, isrc, overrideId]);

  return { lyrics, loading };
}
