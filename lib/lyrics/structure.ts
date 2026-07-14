import type { LyricLine } from "../types";

export interface LyricSection {
  startIndex: number;
  endIndex: number;
  label: string;
}

interface RefrainCandidate {
  length: number;
  starts: number[];
  score: number;
}

function normalizeLine(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstContentIndex(
  normalized: string[],
  start: number,
  end: number,
): number | null {
  for (let index = start; index <= end; index += 1) {
    if (normalized[index]) return index;
  }
  return null;
}

/**
 * Detect a repeated refrain locally, then label the conservative ranges around
 * it. Exact repeated blocks are favored so labels disappear rather than guess
 * when a song has no clear lyric structure.
 */
export function detectLyricSections(lines: LyricLine[]): LyricSection[] {
  if (lines.length < 6) return [];
  const normalized = lines.map((line) => normalizeLine(line.text));
  let best: RefrainCandidate | null = null;

  for (let length = 2; length <= 6; length += 1) {
    const windows = new Map<string, number[]>();
    for (let start = 0; start + length <= normalized.length; start += 1) {
      const block = normalized.slice(start, start + length);
      if (block.some((line) => !line)) continue;
      const key = block.join("\n");
      if (key.replace(/\s/g, "").length < 16) continue;
      const starts = windows.get(key) ?? [];
      starts.push(start);
      windows.set(key, starts);
    }

    for (const [key, starts] of windows) {
      const nonOverlapping: number[] = [];
      for (const start of starts) {
        const previous = nonOverlapping[nonOverlapping.length - 1];
        if (previous === undefined || start >= previous + length) {
          nonOverlapping.push(start);
        }
      }
      if (nonOverlapping.length < 2) continue;
      const score =
        length * nonOverlapping.length * 10 + Math.min(20, key.length / 12);
      if (!best || score > best.score) {
        best = { length, starts: nonOverlapping, score };
      }
    }
  }

  if (!best) return [];

  const sections: LyricSection[] = [];
  let verse = 1;
  const addRange = (start: number, end: number, label: string) => {
    if (end < start) return;
    const contentStart = firstContentIndex(normalized, start, end);
    if (contentStart === null) return;
    sections.push({ startIndex: contentStart, endIndex: end, label });
  };

  addRange(0, best.starts[0] - 1, `Verse ${verse++}`);

  best.starts.forEach((chorusStart, occurrence) => {
    const chorusEnd = Math.min(lines.length - 1, chorusStart + best!.length - 1);
    sections.push({ startIndex: chorusStart, endIndex: chorusEnd, label: "Chorus" });

    const nextChorusStart = best!.starts[occurrence + 1];
    if (nextChorusStart !== undefined) {
      const rangeStart = chorusEnd + 1;
      const rangeEnd = nextChorusStart - 1;
      const contentCount = normalized
        .slice(rangeStart, rangeEnd + 1)
        .filter(Boolean).length;
      const isBridge =
        best!.starts.length >= 3 &&
        occurrence === best!.starts.length - 2 &&
        contentCount > 0 &&
        contentCount <= 8;
      addRange(
        rangeStart,
        rangeEnd,
        isBridge ? "Bridge" : `Verse ${verse++}`,
      );
    } else {
      addRange(chorusEnd + 1, lines.length - 1, "Outro");
    }
  });

  return sections.sort((a, b) => a.startIndex - b.startIndex);
}
