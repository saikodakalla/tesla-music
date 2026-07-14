import { createHash } from "crypto";
import type { LyricTransformKind } from "./deepseek";

interface Entry {
  lines: string[];
  expiresAt: number;
}

const TTL_MS = 1000 * 60 * 60 * 24;
const MAX_ENTRIES = 100;
const store = new Map<string, Entry>();

export function transformCacheKey(
  trackKey: string,
  kind: LyricTransformKind,
  targetLanguage: string,
  lines: string[],
): string {
  const contentHash = createHash("sha1").update(lines.join("\n")).digest("hex");
  return `${trackKey}|${kind}|${targetLanguage.toLowerCase()}|${contentHash}`;
}

export function getCachedTransform(key: string): string[] | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  store.delete(key);
  store.set(key, entry);
  return entry.lines;
}

export function setCachedTransform(key: string, lines: string[]) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { lines, expiresAt: Date.now() + TTL_MS });
}
