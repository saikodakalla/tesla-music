"use client";

/**
 * Living gradient-mesh background (docs/16: art-driven ambient). A few large,
 * heavily-blurred colour blobs from the album palette slowly drift over the
 * near-black base, under a scrim that preserves lyric contrast.
 *
 * GPU-light by design: each blob is one element animated with `transform` only
 * (composited), no layout/paint per frame. Motion freezes under
 * prefers-reduced-motion or when the user turns ambient motion off.
 */

// Fixed anchor positions + drift classes per blob index, so up to 4 colours
// spread across the screen rather than stacking.
const BLOBS = [
  { top: "-10%", left: "-5%", anim: "mesh-drift-a" },
  { top: "20%", left: "55%", anim: "mesh-drift-b" },
  { top: "55%", left: "5%", anim: "mesh-drift-c" },
  { top: "45%", left: "60%", anim: "mesh-drift-d" },
];

export default function GradientMesh({
  palette,
  motion = true,
}: {
  palette: string[];
  motion?: boolean;
}) {
  const colors = palette.slice(0, BLOBS.length);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-ink-950">
      {colors.map((color, i) => {
        const b = BLOBS[i];
        return (
          <div
            key={i}
            className={motion ? b.anim : undefined}
            style={{
              position: "absolute",
              top: b.top,
              left: b.left,
              width: "70vw",
              height: "70vw",
              borderRadius: "9999px",
              background: `radial-gradient(circle at center, ${color} 0%, transparent 70%)`,
              filter: "blur(40px)",
              opacity: 0.55,
              willChange: motion ? "transform" : undefined,
            }}
          />
        );
      })}

      {/* Scrim keeps lyric contrast identical to the plain background. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 35%, rgba(8,9,12,0.30) 0%, rgba(8,9,12,0.62) 60%, rgba(8,9,12,0.85) 100%)",
        }}
      />
    </div>
  );
}
