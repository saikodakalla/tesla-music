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
): {
  lyrics: LyricsDoc | null;
  loading: boolean;
} {
  const [lyrics, setLyrics] = useState<LyricsDoc | null>(initialLyrics ?? null);
  const [loading, setLoading] = useState(false);
  // Seed `currentKey` with the prefetched track so the first effect run is a
  // no-op (no redundant client refetch when the server already gave us lyrics).
  const currentKey = useRef<string | null>(
    initialLyrics && playback?.trackId ? playback.trackId : null,
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

    const trackChanged = currentKey.current !== trackId;
    currentKey.current = trackId;
    let cancelled = false;
    // On a real song change, drop the previous song's lyrics immediately so we
    // never show the old words against the new track — the UI shows a brief
    // "Finding lyrics…" until the new ones load.
    if (trackChanged) setLyrics(null);
    setLoading(true);

    const params = new URLSearchParams({
      title,
      artist: artists,
      durationMs: String(durationMs),
    });
    if (album) params.set("album", album);
    if (isrc) params.set("isrc", isrc);

    // Retry transient failures (the lyrics endpoint returns 502 when LRCLIB is
    // briefly unreachable) instead of permanently showing "no lyrics" for a
    // song that actually has them. A real "not found" comes back as 200 with
    // `notFound: true`, so it is NOT retried here. Each attempt has its own
    // timeout so a hung request can't leave the UI stuck on "Finding lyrics…".
    // The timeout exceeds the server's own worst case so we don't abort it
    // mid-lookup and false-fail.
    //
    // We only retry FAST failures: a quick error is likely a transient blip
    // worth another shot, whereas a slow failure means LRCLIB itself is slow —
    // retrying would just double the wait, so we fall back to "no lyrics"
    // immediately rather than make the user stare at "Finding lyrics…".
    const MAX_ATTEMPTS = 2;
    const ATTEMPT_TIMEOUT_MS = 12000;
    const FAST_FAIL_MS = 3000;

    const attempt = (n: number): void => {
      if (cancelled) return;
      const startedAt = performance.now();
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

      fetch(`/api/lyrics?${params.toString()}`, {
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
          const elapsed = performance.now() - startedAt;
          if (n < MAX_ATTEMPTS && elapsed < FAST_FAIL_MS) {
            setTimeout(() => {
              if (!cancelled) attempt(n + 1);
            }, 400);
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
  }, [trackId, title, artists, album, durationMs, isrc]);

  return { lyrics, loading };
}
