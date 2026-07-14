"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaybackState } from "@/lib/types";

export type PlaybackStatus =
  | "loading"
  | "ok" // active playback
  | "idle" // nothing playing (204)
  | "reconnecting" // transient network/5xx — keep last lyrics frozen
  | "ratelimited"
  | "forbidden" // dev-mode 5-user cap
  | "reauth"; // must log in again

/** Anchor for the client interpolation clock (docs/06 §6.2). */
export interface PlaybackAnchor {
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
  /** performance.now() when this snapshot was received. */
  receivedAt: number;
  trackId: string | null;
}

export interface UsePlaybackResult {
  playback: PlaybackState | null;
  anchor: PlaybackAnchor | null;
  status: PlaybackStatus;
  /** When status === "reconnecting", how long we've been failing (ms). */
  outageMs: number;
  /** Poll immediately after a local playback command. */
  refresh: () => void;
}

// Adaptive poll intervals (docs/06 §6.3).
const INTERVAL = {
  steady: 5000,
  nearEnd: 2000,
  burst: 1000,
  paused: 12000,
  ad: 8000,
  idle: 20000,
  episode: 15000,
};
const NEAR_END_MS = 10_000;
const BURST_COUNT = 3;
const BACKOFF_CAP = 30_000;

export function usePlayback(
  initialPlayback?: PlaybackState | null,
): UsePlaybackResult {
  const [playback, setPlayback] = useState<PlaybackState | null>(
    initialPlayback ?? null,
  );
  const [anchor, setAnchor] = useState<PlaybackAnchor | null>(() =>
    initialPlayback && initialPlayback.isActive
      ? {
          progressMs: initialPlayback.progressMs,
          durationMs: initialPlayback.durationMs,
          isPlaying: initialPlayback.isPlaying,
          receivedAt: typeof performance !== "undefined" ? performance.now() : 0,
          trackId: initialPlayback.trackId,
        }
      : null,
  );
  const [status, setStatus] = useState<PlaybackStatus>(
    initialPlayback ? (initialPlayback.isActive ? "ok" : "idle") : "loading",
  );
  const [outageMs, setOutageMs] = useState(0);

  // Refs to avoid stale closures inside the recursive timer.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackId = useRef<string | null>(initialPlayback?.trackId ?? null);
  const burstLeft = useRef(0);
  const failures = useRef(0);
  const outageStart = useRef<number | null>(null);
  const stopped = useRef(false);

  const schedule = useCallback((delayMs: number, fn: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, delayMs);
  }, []);

  const poll = useCallback(async () => {
    if (stopped.current) return;
    if (typeof document !== "undefined" && document.hidden) {
      // Tab hidden / app backgrounded → pause polling, resume on visibility.
      return;
    }

    let nextDelay = INTERVAL.steady;

    try {
      const res = await fetch("/api/playback", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (res.status === 401) {
        setStatus("reauth");
        stopped.current = true;
        return;
      }
      if (res.status === 403) {
        setStatus("forbidden");
        schedule(30_000, poll);
        return;
      }
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        const retry = Number(body?.retryAfter ?? 5);
        setStatus("ratelimited");
        schedule(Math.max(1, retry) * 1000, poll);
        return;
      }
      if (!res.ok) throw new Error(`playback ${res.status}`);

      const data = (await res.json()) as PlaybackState;

      // Success: clear outage state.
      failures.current = 0;
      outageStart.current = null;
      setOutageMs(0);

      setPlayback(data);
      setAnchor({
        progressMs: data.progressMs,
        durationMs: data.durationMs,
        isPlaying: data.isPlaying,
        receivedAt: performance.now(),
        trackId: data.trackId,
      });

      // Decide next interval from the snapshot.
      if (!data.isActive) {
        setStatus("idle");
        nextDelay = INTERVAL.idle;
      } else if (data.type === "ad") {
        setStatus("ok");
        nextDelay = INTERVAL.ad;
      } else if (data.type === "episode") {
        setStatus("ok");
        nextDelay = INTERVAL.episode;
      } else if (!data.isPlaying) {
        setStatus("ok");
        nextDelay = INTERVAL.paused;
      } else {
        setStatus("ok");
        const changed = data.trackId !== lastTrackId.current;
        if (changed) burstLeft.current = BURST_COUNT;
        if (burstLeft.current > 0) {
          burstLeft.current -= 1;
          nextDelay = INTERVAL.burst;
        } else if (
          data.durationMs > 0 &&
          data.durationMs - data.progressMs <= NEAR_END_MS
        ) {
          // Tighten near the end so the song-change swap feels instant, and
          // burst again right after the change.
          nextDelay = INTERVAL.nearEnd;
          burstLeft.current = BURST_COUNT;
        } else {
          nextDelay = INTERVAL.steady;
        }
      }
      lastTrackId.current = data.trackId;
    } catch {
      // Transient network / 5xx → exponential backoff with jitter; keep last
      // lyrics on screen with a "reconnecting" hint (docs/10 #18).
      failures.current += 1;
      if (outageStart.current === null) outageStart.current = performance.now();
      setOutageMs(performance.now() - (outageStart.current ?? 0));
      setStatus("reconnecting");
      const base = Math.min(
        BACKOFF_CAP,
        2000 * Math.pow(2, Math.min(failures.current - 1, 4)),
      );
      nextDelay = base + Math.floor(((failures.current * 137) % 1000)); // light jitter
    }

    schedule(nextDelay, poll);
  }, [schedule]);

  useEffect(() => {
    stopped.current = false;
    void poll();

    const onVisible = () => {
      if (!document.hidden && !stopped.current) {
        // On resume, poll immediately and re-anchor (docs/06 §6.5).
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  return {
    playback,
    anchor,
    status,
    outageMs,
    refresh: () => void poll(),
  };
}
