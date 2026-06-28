/**
 * Client-side colour extraction from album art, for the ambient accent and the
 * gradient-mesh background (docs/16 art-driven palette). No library: draw the
 * already-small Spotify art downscaled to a tiny canvas, sample pixels, and pick
 * the dominant vivid colours, normalised for night readability.
 *
 * The Spotify image CDN (i.scdn.co) sends `access-control-allow-origin: *`, so
 * the canvas usually isn't tainted. If it is, `getImageData` throws and we
 * return null — callers fall back to a neutral default.
 */

const SAMPLE_SIZE = 32;

/**
 * Extract up to `maxColors` dominant, vivid, hue-diverse colours from the art,
 * ordered most-dominant first. Returns null on no art / CORS taint / no vivid
 * colour. The first entry doubles as the accent.
 */
export async function extractPalette(
  url: string,
  maxColors = 4,
): Promise<string[] | null> {
  const img = await loadImage(url);
  if (!img) return null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    // Bucket vivid pixels by a coarse RGB key, accumulating averages.
    const buckets = new Map<
      string,
      { count: number; r: number; g: number; b: number }
    >();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 200) continue;
      const { s, v } = rgbToHsv(r, g, b);
      if (v < 0.15 || v > 0.97) continue; // too dark / blown out
      if (s < 0.18) continue; // greyish
      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const e = buckets.get(key);
      if (e) {
        e.count++;
        e.r += r;
        e.g += g;
        e.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }

    if (buckets.size === 0) return null;

    // Average each bucket, sort by dominance.
    const candidates = Array.from(buckets.values())
      .map((e) => {
        const r = Math.round(e.r / e.count);
        const g = Math.round(e.g / e.count);
        const b = Math.round(e.b / e.count);
        return { r, g, b, count: e.count, h: rgbToHsv(r, g, b).h };
      })
      .sort((a, b) => b.count - a.count);

    // Greedily pick hue-diverse colours so the mesh has variety, not four
    // shades of the same blue.
    const picked: typeof candidates = [];
    for (const c of candidates) {
      if (picked.length >= maxColors) break;
      const tooClose = picked.some((p) => hueDistance(p.h, c.h) < 22);
      if (!tooClose) picked.push(c);
    }
    // If everything was one hue, fall back to the top buckets regardless.
    if (picked.length === 0) picked.push(candidates[0]);

    return picked.map((c) => normalizeForNight(c.r, c.g, c.b));
  } catch {
    return null; // tainted canvas (CORS) or draw failure → neutral fallback
  }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Clamp lightness and lift saturation so a colour reads on a near-black UI. */
function normalizeForNight(r: number, g: number, b: number): string {
  const { h, s } = rgbToHsv(r, g, b);
  const sat = Math.min(1, Math.max(0.5, s));
  const val = 0.82; // bright but not blown out
  const [nr, ng, nb] = hsvToRgb(h, sat, val);
  return `rgb(${nr}, ${ng}, ${nb})`;
}

function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}
