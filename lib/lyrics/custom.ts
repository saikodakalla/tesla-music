import type { LyricsDoc, LyricLine } from "../types";
import { parseLrc } from "./lrc";

export function customLyrics(text: string, trackId: string, durationMs: number, revision: number): LyricsDoc {
  if (!text.trim() || text.length > 24_000) throw new Error("Paste up to 24,000 characters of lyrics.");
  const rows = text.split(/\r?\n/);
  if (rows.length > 600 || rows.some((line) => line.length > 500)) throw new Error("Use up to 600 lines, with 500 characters per line.");
  const lines = parseLrc(text);
  if (lines.length > 600) throw new Error("Use up to 600 timed lines.");
  if (lines.length && (!lines.some((line) => line.text.trim()) || lines.some((line) => line.tMs > durationMs))) {
    throw new Error("The lyric timestamps must fit this recording's length.");
  }
  if (/\[\d{1,3}:/.test(text) && !lines.length) throw new Error("No valid LRC timestamps found.");
  return {
    source: "custom", trackKey: `custom:${trackId}:${revision}`, durationMs,
    synced: lines.length > 0, instrumental: false, notFound: false, lines,
    plain: lines.length ? lines.map((line) => line.text).join("\n") : text.trim(),
  };
}

export function toLrc(lines: LyricLine[]): string {
  return lines.map(({ tMs, text }) => {
    const time = Math.max(0, Math.round(tMs));
    const minutes = String(Math.floor(time / 60_000)).padStart(2, "0");
    const seconds = String(Math.floor(time / 1000) % 60).padStart(2, "0");
    const milliseconds = String(time % 1000).padStart(3, "0");
    return `[${minutes}:${seconds}.${milliseconds}] ${text}`;
  }).join("\n");
}
