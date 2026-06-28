"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ambient album-art backdrop (docs/16: art-driven ambient background). Renders
 * the *already-small* Spotify art heavily blurred and scaled up behind the
 * lyrics, under a dark scrim that preserves lyric contrast. Cross-fades on track
 * change. Only `opacity` animates — cheap on the old Tesla Chromium (docs/09),
 * and the fade collapses to ~instant under prefers-reduced-motion (globals.css).
 *
 * GPU note: blurring a ~300px source (then scaling) is far cheaper than blurring
 * a full-screen image; that's the deliberate mitigation.
 */
export default function AmbientBackdrop({
  albumArtUrl,
  accent,
}: {
  albumArtUrl: string | null | undefined;
  accent: string;
}) {
  // Keep up to two layers so a change cross-fades old → new. The newest layer
  // fades in over the older one via the `ambient-fade` animation; once it's in,
  // the older layer is dropped.
  const [layers, setLayers] = useState<{ id: number; url: string }[]>([]);
  const nextId = useRef(0);
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    const url = albumArtUrl ?? null;
    if (url === lastUrl.current) return;
    lastUrl.current = url;
    if (!url) {
      setLayers([]);
      return;
    }
    const id = nextId.current++;
    setLayers((prev) => [...prev, { id, url }].slice(-2));
  }, [albumArtUrl]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-ink-950">
      {layers.map((layer, i) => {
        const isTop = i === layers.length - 1;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={layer.id}
            src={layer.url}
            alt=""
            onAnimationEnd={() => {
              // New layer fully faded in → discard the one beneath it.
              if (isTop && layers.length > 1) {
                setLayers((prev) => prev.slice(-1));
              }
            }}
            className={`absolute inset-0 h-full w-full object-cover ${
              isTop ? "ambient-fade" : ""
            }`}
            style={{
              transform: "scale(1.25)",
              filter: "blur(48px) saturate(1.3) brightness(0.45)",
              opacity: 0.9,
            }}
          />
        );
      })}

      {/* Dark scrim keeps lyric contrast identical to the plain background. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 30%, transparent 0%, rgba(8,9,12,0.55) 60%, rgba(8,9,12,0.82) 100%)",
        }}
      />
      {/* Faint accent wash tints the whole scene toward the album's colour. */}
      <div
        className="absolute inset-0 transition-[background] duration-700"
        style={{ background: accent, opacity: 0.06, mixBlendMode: "soft-light" }}
      />
    </div>
  );
}
