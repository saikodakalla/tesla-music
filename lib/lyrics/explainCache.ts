/**
 * In-memory cache for AI-generated lyric-line explanations, mirroring
 * lib/lyrics/cache.ts's shape. Explanations don't change, so a long TTL is
 * fine; unlike lyrics lookups there's no negative caching — a failed
 * DeepSeek call simply isn't cached and the user can tap again.
 *
 * Process-local (per serverless instance); swap for Redis for a shared cache
 * across instances if needed later.
 */

interface Entry {
  explanation: string;
  expiresAt: number;
}

const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const MAX_ENTRIES = 1000;

const store = new Map<string, Entry>();

export function getCachedExplanation(key: string): string | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    return null;
  }
  // Touch for naive LRU ordering.
  store.delete(key);
  store.set(key, e);
  return e.explanation;
}

export function setCachedExplanation(key: string, explanation: string): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { explanation, expiresAt: Date.now() + TTL_MS });
}

/**
 * Folds a hash of the line text into the key (not just trackKey+lineIndex).
 * The route has no independent way to verify a client's claimed line text
 * against trackKey+lineIndex, so a mismatched/stale request just becomes its
 * own cache entry instead of serving a wrong explanation for that slot (e.g.
 * if lineIndex drifts after a mid-session lyrics re-fetch).
 */
export function explainCacheKey(
  trackKey: string,
  lineIndex: number,
  lineText: string,
): string {
  const normalized = lineText.trim().toLowerCase();
  return `${trackKey}:${lineIndex}:${djb2(normalized)}`;
}

function djb2(s: string): string {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 33) ^ s.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
