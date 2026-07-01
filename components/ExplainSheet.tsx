"use client";

/**
 * Bottom sheet showing an AI-generated explanation of the tapped lyric line.
 * Same visual pattern as LyricsControls.tsx's settings sheet. z-50 — nothing
 * else in the app uses it (LyricsControls is z-30, SyncCalibrator is z-40).
 */
export default function ExplainSheet({
  line,
  status,
  explanation,
  onClose,
  onRetry,
}: {
  line: string;
  status: "loading" | "success" | "error";
  explanation: string | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center">
      {/* Scrim — tap outside to close. */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      <section className="relative w-full max-w-3xl rounded-t-3xl border-t border-white/10 bg-ink-900/95 p-6 pb-8 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <p className="min-w-0 flex-1 truncate text-lg font-semibold text-lyric-active">
            &ldquo;{line}&rdquo;
          </p>
          <button
            onClick={onClose}
            aria-label="Done"
            className="flex h-12 shrink-0 items-center rounded-full bg-white/10 px-6 text-base font-semibold text-lyric-active active:scale-95"
          >
            Done
          </button>
        </div>

        {status === "loading" && (
          <div className="space-y-3 py-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-4 animate-pulse rounded-full bg-white/10"
                style={{ width: i === 2 ? "60%" : "100%" }}
              />
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="py-2">
            <p className="text-sm text-amber-300">
              Couldn&rsquo;t get an explanation.
            </p>
            <button
              onClick={onRetry}
              className="mt-3 h-12 rounded-full bg-white/10 px-6 text-sm font-semibold text-lyric-active active:scale-95"
            >
              Try again
            </button>
          </div>
        )}

        {status === "success" && explanation && (
          <>
            <p className="text-base leading-relaxed text-lyric-dim">
              {explanation}
            </p>
            <p className="mt-4 text-xs text-lyric-faint">
              AI-generated interpretation — may be inaccurate.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
