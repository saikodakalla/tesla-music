"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LyricsDoc, PlaybackState } from "@/lib/types";
import { getPrefetchedLyrics } from "./lyricsPrefetchCache";

/** Fetch once per recording/override, with bounded retries and explicit recovery. */
export function useLyrics(
  playback: PlaybackState | null,
  initialLyrics?: LyricsDoc | null,
  overrideId?: string | null,
): {
  lyrics: LyricsDoc | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
} {
  const [lyrics, setLyrics] = useState<LyricsDoc | null>(initialLyrics ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const initial = useRef(initialLyrics);
  const identity = useRef<string | null>(null);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  const isTrack = playback?.isActive && playback.type === "track";
  const trackId = isTrack ? playback.trackId : null;
  const title = isTrack ? playback.title : null;
  const artists = isTrack ? playback.artists : null;
  const album = isTrack ? playback.album : null;
  const durationMs = isTrack ? playback.durationMs : 0;
  const isrc = isTrack ? playback.isrc : null;

  useEffect(() => {
    setError(false);
    if (!trackId || !title || !artists) {
      setLyrics(null);
      setLoading(false);
      initial.current = null;
      identity.current = null;
      return;
    }
    let cancelled = false;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const seeded = initial.current;
    initial.current = null;
    const warm = !overrideId && revision === 0
      ? getPrefetchedLyrics(trackId) ?? seeded ?? null : null;
    const key = `${trackId}|${overrideId ?? ""}`;
    const sameDocument = identity.current === key;
    identity.current = key;
    setLyrics((previous) => warm ?? (sameDocument ? previous : null));
    if (warm && (warm.synced || warm.instrumental)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ title, artist: artists, durationMs: String(durationMs) });
    if (album) params.set("album", album);
    if (isrc) params.set("isrc", isrc);
    if (revision > 0) params.set("refresh", "1");
    const url = overrideId
      ? `/api/lyrics/by-id?id=${encodeURIComponent(overrideId)}`
      : `/api/lyrics?${params}`;

    const attempt = async (number: number): Promise<void> => {
      controller = new AbortController();
      // Covers LRCLIB's 11s total budget and the second source's 4s budget.
      const timer = setTimeout(() => controller?.abort(), 20_000);
      try {
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!res.ok) {
          if (res.status === 401) throw new Error("unauthenticated");
          throw new Error("unavailable");
        }
        const doc = await res.json() as LyricsDoc;
        if (!cancelled) {
          setLyrics((previous) => doc.notFound && previous && !previous.notFound ? previous : doc);
          setLoading(false);
        }
      } catch (failure) {
        if (cancelled) return;
        if (number < 3 && !(failure instanceof Error && failure.message === "unauthenticated")) {
          retryTimer = setTimeout(() => void attempt(number + 1), number * 1000);
        } else {
          // An outage is not evidence that the song has no lyrics.
          setError(true);
          setLoading(false);
        }
      } finally { clearTimeout(timer); }
    };
    void attempt(1);
    return () => {
      cancelled = true;
      controller?.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [trackId, title, artists, album, durationMs, isrc, overrideId, revision]);

  return { lyrics, loading, error, retry };
}
