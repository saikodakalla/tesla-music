"use client";

/**
 * Unsynced lyrics fallback (docs/10 #2). A static, readable block clearly
 * marked "(not synced)" — better than nothing when only plain lyrics exist.
 */
export default function PlainLyrics({ text }: { text: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center px-8 pt-[12vh]">
      <span className="mb-6 rounded-full border border-lyric-faint/40 px-4 py-1 text-sm uppercase tracking-widest text-lyric-faint">
        Not synced
      </span>
      <div className="max-h-[72vh] w-full max-w-3xl overflow-y-auto text-center">
        {text.split(/\r?\n/).map((line, i) => (
          <p
            key={i}
            className="py-1 leading-snug text-lyric-dim"
            style={{
              fontSize: "calc(clamp(1.4rem, 3vw, 2.2rem) * var(--lyric-scale, 1))",
            }}
          >
            {line || " "}
          </p>
        ))}
      </div>
    </div>
  );
}
