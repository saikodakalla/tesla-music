/**
 * Track-title normalisation for robust lyric matching (docs/07 §7.4).
 * Strips version noise ("Remastered", "- Live", "feat. …") for comparison
 * while leaving the original intact for display.
 */

const NOISE_PATTERNS: RegExp[] = [
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
  return collapse(raw.split(/,|&|feat\.?|ft\.?/i)[0] ?? raw);
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
