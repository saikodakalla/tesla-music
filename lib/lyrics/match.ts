/**
 * Track-title normalisation for robust lyric matching (docs/07 §7.4).
 * Strips version noise ("Remastered", "- Live", "feat. …") for comparison
 * while leaving the original intact for display.
 */

import { transliterateTelugu } from "./telugu";

const NOISE_PATTERNS: RegExp[] = [
  /\s*[([]\s*from\s+[^)\]]+[)\]]/gi,
  /\s*-\s*from\s+.+$/i,
  /\s*[([]\s*(?:original (?:motion picture )?soundtrack|telugu|official (?:video|audio)|lyric(?:al)? video)\s*[)\]]/gi,
  /\s*-\s*(remaster(ed)?|live|mono|stereo|radio edit|single version|album version|deluxe|expanded|bonus track).*$/i,
  /\s*\((feat\.?|ft\.?|featuring)[^)]*\)/gi,
  /\s*\[(feat\.?|ft\.?|featuring)[^\]]*\]/gi,
  /\s*\((remaster(ed)?|live|mono|stereo|radio edit|single version|album version|deluxe|expanded|bonus track|\d{4} remaster)[^)]*\)/gi,
];

export function normalizeTitle(raw: string): string {
  let s = raw;
  for (const p of NOISE_PATTERNS) s = s.replace(p, "");
  return collapse(s);
}

export function normalizeArtist(raw: string): string {
  // Use only the primary artist for matching robustness.
  return artistNames(raw)[0] ?? collapse(raw);
}

export function artistNames(raw: string): string[] {
  return raw.split(/[,;&/]|\b(?:feat\.?|ft\.?|featuring)\s+/i)
    .map(collapse).filter(Boolean);
}

/** Punctuation/spacing-insensitive comparison, including Telugu combining marks. */
export function matchText(raw: string): string {
  return collapse(raw).toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, "");
}

export function titleSimilarity(a: string, b: string): number {
  const x = matchText(transliterateTelugu(normalizeTitle(a)));
  const y = matchText(transliterateTelugu(normalizeTitle(b)));
  if (!x || !y) return 0;
  if (x === y) return 1;
  // Common romanization variants: Kaavaale / Kavale, Sree / Sri, etc.
  const roman = (s: string) => s.replace(/aa+/g, "a").replace(/ee+/g, "i")
    .replace(/oo+/g, "u").replace(/(.)\1+/g, "$1");
  if (/^[a-z]+$/.test(x) && /^[a-z]+$/.test(y) && roman(x) === roman(y)) return 0.95;
  const pairs = (s: string) => new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)));
  if (Math.min(x.length, y.length) < 5) return 0;
  const xs = pairs(x), ys = pairs(y);
  return 2 * [...xs].filter((p) => ys.has(p)).length / (xs.size + ys.size);
}

function collapse(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable cache key for a track (docs/07 §7.6). */
export function trackKey(params: {
  title: string;
  artist: string;
  durationMs: number;
  isrc?: string | null;
}): string {
  if (params.isrc) return `isrc:${params.isrc}`;
  const durSec = Math.round(params.durationMs / 1000);
  return `t:${normalizeTitle(params.title).toLowerCase()}|a:${normalizeArtist(
    params.artist,
  ).toLowerCase()}|d:${durSec}`;
}
