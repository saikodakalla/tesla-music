"use client";

import { useEffect, useState } from "react";

/**
 * Cinematic idle state (docs/08 §8.8): when nothing is playing, show a calm
 * live clock + date over the ambient background instead of a plain status card,
 * so a parked car feels like a built-in feature. If we saw album art recently,
 * a faded thumbnail keeps a sense of "what was on".
 */
export default function IdleScreen({
  lastArtUrl,
}: {
  lastArtUrl?: string | null;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Set on mount (client only — avoids SSR hydration mismatch), then tick.
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now
    ? now.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const date = now
    ? now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-8 text-center">
      {lastArtUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lastArtUrl}
          alt=""
          className="mb-10 h-[22vh] max-h-56 w-auto rounded-2xl opacity-25 shadow-2xl grayscale"
        />
      )}

      <div
        className="font-semibold leading-none tracking-tight text-lyric-active tabular-nums"
        style={{ fontSize: "clamp(4rem, 13vw, 11rem)" }}
      >
        {time}
      </div>

      <div className="mt-4 text-[clamp(1.1rem,2.6vw,1.8rem)] font-medium text-lyric-dim">
        {date}
      </div>

      <p className="mt-10 text-[clamp(0.95rem,2vw,1.25rem)] text-lyric-faint">
        Start a song on Spotify and the lyrics will appear here.
      </p>
    </div>
  );
}
