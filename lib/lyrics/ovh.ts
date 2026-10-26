import type { LyricsDoc } from "../types";
import type { TrackQuery } from "./provider";
import { artistNames, normalizeTitle, trackKey } from "./match";
import { transliterateTelugu } from "./telugu";

/** A second public source for text when LRCLIB has no usable document. */
export async function lookupPlainLyrics(query: TrackQuery): Promise<LyricsDoc | null> {
  const artists = artistNames(query.artist);
  const names = [...new Set([artists[0], artists[artists.length - 1]])].filter(Boolean);
  const title = normalizeTitle(query.title);
  const titles = [...new Set([title, transliterateTelugu(title)])];
  const requests = names.flatMap((artist) => titles.map((name) => ({ artist, name })));
  const results = await Promise.allSettled(requests.map(async ({ artist, name }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(name)}`, {
        signal: controller.signal, cache: "no-store",
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`lyrics.ovh: HTTP ${res.status}`);
      const data = await res.json() as { lyrics?: unknown };
      if (typeof data.lyrics !== "string" || !data.lyrics.trim()) return null;
      return {
        source: "lyrics.ovh", trackKey: trackKey(query), durationMs: query.durationMs,
        synced: false, instrumental: false, lines: [],
        plain: data.lyrics.trim(), notFound: false,
      } satisfies LyricsDoc;
    } finally { clearTimeout(timer); }
  }));
  for (const result of results) if (result.status === "fulfilled" && result.value) return result.value;
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  return null;
}
