"use client";

import { useEffect, useRef, useState } from "react";
import type { LyricsDoc, PlaybackState } from "@/lib/types";

/**
 * Fetches lyrics whenever the track changes (docs/06 §6.4). Keeps the previous
 * lyrics on screen during the fetch so a song change cross-fades rather than
 * blanking. Only fetches for music tracks.
 */
export function useLyrics(playback: PlaybackState | null): {
  lyrics: LyricsDoc | null;
  loading: boolean;
} {
  const [lyrics, setLyrics] = useState<LyricsDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const currentKey = useRef<string | null>(null);

  useEffect(() => {
    const track = playback;
    if (
      !track ||
      !track.isActive ||
      track.type !== "track" ||
      !track.trackId ||
      !track.title ||
      !track.artists
    ) {
      // Non-track (ad/episode/idle): clear lyrics, leave status cards to UI.
      if (currentKey.current !== null) {
        currentKey.current = null;
        setLyrics(null);
      }
      return;
    }

    // Key on trackId so we fetch exactly once per song.
    if (track.trackId === currentKey.current) return;
    currentKey.current = track.trackId;

    const controller = new AbortController();
    setLoading(true);

    const params = new URLSearchParams({
      title: track.title,
      artist: track.artists,
      durationMs: String(track.durationMs),
    });
    if (track.album) params.set("album", track.album);
    if (track.isrc) params.set("isrc", track.isrc);

    fetch(`/api/lyrics?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((doc: LyricsDoc) => {
        // Ignore if the track changed again while we were fetching.
        if (currentKey.current === track.trackId) setLyrics(doc);
      })
      .catch(() => {
        if (currentKey.current === track.trackId) {
          setLyrics({
            source: "none",
            trackKey: track.trackId ?? "",
            durationMs: track.durationMs,
            synced: false,
            instrumental: false,
            lines: [],
            notFound: true,
          });
        }
      })
      .finally(() => {
        if (currentKey.current === track.trackId) setLoading(false);
      });

    return () => controller.abort();
  }, [playback]);

  return { lyrics, loading };
}
