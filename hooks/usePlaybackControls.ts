"use client";

import { useCallback, useEffect, useState } from "react";

export type PlaybackCommand = "play" | "pause" | "next" | "previous";

export function usePlaybackControls({
  trackId,
  onSuccess,
}: {
  trackId?: string | null;
  onSuccess: () => void;
}) {
  const [pending, setPending] = useState<PlaybackCommand | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [trackId]);

  const send = useCallback(
    async (command: PlaybackCommand) => {
      if (pending) return;
      setPending(command);
      setError(null);
      try {
        const res = await fetch("/api/playback/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.status === 403) {
            throw new Error("Log out and back in to enable passenger controls.");
          }
          if (body.error === "no_active_device") {
            throw new Error("Start Spotify on a device first.");
          }
          throw new Error("Spotify could not apply that command.");
        }
        onSuccess();
        setTimeout(onSuccess, 600);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Spotify could not apply that command.",
        );
      } finally {
        setPending(null);
      }
    },
    [onSuccess, pending],
  );

  return { pending, error, send };
}
