"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlaybackCommand, PlaybackState } from "@/lib/types";

export type { PlaybackCommand } from "@/lib/types";

export function usePlaybackControls({
  playback,
  onSuccess,
}: {
  playback: PlaybackState | null;
  onSuccess: () => void;
}) {
  const [pending, setPending] = useState<PlaybackCommand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => setError(null), [playback?.trackId]);
  useEffect(() => {
    setError(null);
    setBlocked(false);
  }, [playback?.deviceId]);

  const send = useCallback(
    async (command: PlaybackCommand) => {
      if (pending || !playback?.controlCapabilities[command]) return;
      setPending(command);
      setError(null);
      try {
        const res = await fetch("/api/playback/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command,
            deviceId: playback.deviceId ?? undefined,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.status === 401 || body.error === "reauth_required") {
            window.location.assign("/api/auth/login");
            return;
          }
          if (body.error === "scope_missing") {
            window.location.assign("/api/auth/login");
            return;
          }
          if (body.error === "premium_required") {
            setBlocked(true);
            throw new Error("Spotify Premium is required for playback controls.");
          }
          if (body.error === "control_forbidden") {
            setBlocked(true);
            throw new Error("Spotify blocked controls on this device.");
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
    [onSuccess, pending, playback],
  );

  return { pending, error, blocked, send };
}
