"use client";

/**
 * Calm, centered status state (docs/08 §8.8, docs/10). Used for idle, paused,
 * ad, episode, instrumental, and no-lyrics. Never a stack trace or blank page —
 * a quiet message, optionally with album art for context.
 */
export default function StatusCard({
  title,
  subtitle,
  albumArtUrl,
  trackTitle,
  trackArtist,
}: {
  title: string;
  subtitle?: string;
  albumArtUrl?: string | null;
  trackTitle?: string | null;
  trackArtist?: string | null;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-8 text-center">
      {albumArtUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={albumArtUrl}
          alt=""
          className="mb-8 h-[28vh] max-h-72 w-auto rounded-2xl shadow-2xl"
        />
      )}
      <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-semibold text-lyric-active">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 max-w-2xl text-[clamp(1rem,2.2vw,1.4rem)] text-lyric-dim">
          {subtitle}
        </p>
      )}
      {(trackTitle || trackArtist) && (
        <p className="mt-6 text-[clamp(1rem,2vw,1.3rem)] text-lyric-faint">
          {trackTitle}
          {trackTitle && trackArtist ? " — " : ""}
          {trackArtist}
        </p>
      )}
    </div>
  );
}
