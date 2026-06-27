import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/session";
import { getLyricsProvider } from "@/lib/lyrics/provider";
import { getCached, setCached } from "@/lib/lyrics/cache";
import { trackKey } from "@/lib/lyrics/match";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  title: z.string().min(1).max(400),
  artist: z.string().min(1).max(400),
  album: z.string().max(400).optional(),
  durationMs: z.coerce.number().int().positive().max(60 * 60 * 1000),
  isrc: z.string().max(40).optional(),
});

/**
 * Lyrics endpoint: validates the query (zod, docs/14), serves from the
 * in-memory cache, and otherwise fetches via the swappable LyricsProvider
 * (LRCLIB by default). Requires a session so it isn't an open lyrics proxy.
 */
export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const q = parsed.data;

  const key = trackKey({
    title: q.title,
    artist: q.artist,
    durationMs: q.durationMs,
    isrc: q.isrc ?? null,
  });

  const cached = getCached(key);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "private, max-age=86400" },
    });
  }

  try {
    const doc = await getLyricsProvider().getLyrics({
      title: q.title,
      artist: q.artist,
      album: q.album ?? null,
      durationMs: q.durationMs,
      isrc: q.isrc ?? null,
    });
    setCached(key, doc);
    return NextResponse.json(doc, {
      headers: { "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return NextResponse.json({ error: "lyrics_unavailable" }, { status: 502 });
  }
}
