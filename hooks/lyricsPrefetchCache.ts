import type { LyricsDoc } from "@/lib/types";

interface Entry {
  doc: LyricsDoc;
  expiresAt: number;
}

const TTL_MS = 1000 * 60 * 30;
const MAX_ENTRIES = 12;
const prefetched = new Map<string, Entry>();

export function getPrefetchedLyrics(trackId: string): LyricsDoc | null {
  const entry = prefetched.get(trackId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    prefetched.delete(trackId);
    return null;
  }
  prefetched.delete(trackId);
  prefetched.set(trackId, entry);
  return entry.doc;
}

export function setPrefetchedLyrics(trackId: string, doc: LyricsDoc) {
  if (prefetched.size >= MAX_ENTRIES) {
    const oldest = prefetched.keys().next().value;
    if (oldest !== undefined) prefetched.delete(oldest);
  }
  prefetched.set(trackId, { doc, expiresAt: Date.now() + TTL_MS });
}
