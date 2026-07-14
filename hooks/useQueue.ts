"use client";

import { useEffect, useState } from "react";
import type { LyricsDoc, QueueTrack } from "@/lib/types";
import {
  getPrefetchedLyrics,
  setPrefetchedLyrics,
} from "./lyricsPrefetchCache";

const REFRESH_MS = 30_000;
const PREFETCH_COUNT = 2;

function lyricsUrl(track: QueueTrack): string {
  const params = new URLSearchParams({
    title: track.title,
    artist: track.artists,
    durationMs: String(track.durationMs),
  });
  if (track.album) params.set("album", track.album);
  if (track.isrc) params.set("isrc", track.isrc);
  return `/api/lyrics?${params.toString()}`;
}

async function prefetchLyrics(tracks: QueueTrack[], signal: AbortSignal) {
  await Promise.allSettled(
    tracks.slice(0, PREFETCH_COUNT).map(async (track) => {
      if (getPrefetchedLyrics(track.trackId)) return;
      const res = await fetch(lyricsUrl(track), { cache: "no-store", signal });
      if (!res.ok) return;
      const doc = (await res.json()) as LyricsDoc;
      setPrefetchedLyrics(track.trackId, doc);
    }),
  );
}

export function useQueue(currentTrackId?: string | null): QueueTrack[] {
  const [tracks, setTracks] = useState<QueueTrack[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    const refresh = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/queue", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { tracks: QueueTrack[] };
        const next = (data.tracks ?? []).filter(
          (track) => track.trackId !== currentTrackId,
        );
        setTracks(next);
        void prefetchLyrics(next, controller.signal);
      } catch {
        /* Queue is a progressive enhancement; playback remains unaffected. */
      }
    };

    void refresh();
    const interval = setInterval(() => void refresh(), REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [currentTrackId]);

  return tracks;
}
