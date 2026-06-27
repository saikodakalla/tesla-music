import type { LyricsDoc } from "../types";

/**
 * Simple in-memory lyrics cache with TTL + negative caching (docs/07 §7.6).
 *
 * Lyrics never change, so the positive TTL is long. "Not found" is cached with
 * a shorter TTL so we don't hammer LRCLIB on every poll of a song with no
 * lyrics. This is process-local (per serverless instance); for a shared cache
 * across instances, back this with Upstash Redis — same get/set shape.
 */

interface Entry {
  doc: LyricsDoc;
  expiresAt: number;
}

const POSITIVE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const NEGATIVE_TTL_MS = 1000 * 60 * 60; // 1 hour
const MAX_ENTRIES = 500;

const store = new Map<string, Entry>();

export function getCached(key: string): LyricsDoc | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    return null;
  }
  // Touch for naive LRU ordering.
  store.delete(key);
  store.set(key, e);
  return e.doc;
}

export function setCached(key: string, doc: LyricsDoc): void {
  const ttl = doc.notFound ? NEGATIVE_TTL_MS : POSITIVE_TTL_MS;
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { doc, expiresAt: Date.now() + ttl });
}
