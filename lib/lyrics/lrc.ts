import type { LyricLine } from "../types";

/**
 * Parse LRC text into sorted, absolute-ms lyric lines (docs/07 §7.5).
 *
 * Handles:
 *   [mm:ss.xx] text
 *   [mm:ss.xxx] text
 *   [mm:ss] text
 *   [00:12.34][00:45.67] text   (multiple timestamps share one line)
 * Ignores metadata tags like [ar:], [ti:], [by:].
 */
const TIME_TAG = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];

  for (const rawLine of lrc.split(/\r?\n/)) {
    TIME_TAG.lastIndex = 0;
    const stamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastTagEnd = 0;

    while ((match = TIME_TAG.exec(rawLine)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const fracRaw = match[3] ?? "0";
      // Normalise fractional seconds to ms (".34" → 340ms, ".340" → 340ms).
      const frac = parseInt(fracRaw.padEnd(3, "0").slice(0, 3), 10);
      stamps.push(min * 60_000 + sec * 1_000 + frac);
      lastTagEnd = TIME_TAG.lastIndex;
    }

    if (stamps.length === 0) continue; // metadata or untimed line
    const text = rawLine.slice(lastTagEnd).trim();
    for (const tMs of stamps) {
      lines.push({ tMs, text });
    }
  }

  lines.sort((a, b) => a.tMs - b.tMs);
  return lines;
}
