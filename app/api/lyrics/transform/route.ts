import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/session";
import { transformLyricLines } from "@/lib/lyrics/deepseek";
import {
  getCachedTransform,
  setCachedTransform,
  transformCacheKey,
} from "@/lib/lyrics/transformCache";

export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    trackKey: z.string().min(1).max(240),
    title: z.string().min(1).max(400),
    artist: z.string().min(1).max(400),
    kind: z.enum(["translation", "romanization"]),
    targetLanguage: z.string().min(2).max(60),
    lines: z.array(z.string().max(500)).min(1).max(600),
  })
  .refine((body) => body.lines.join("\n").length <= 24_000, {
    message: "lyrics_too_long",
  });

/** Explicit, session-gated translation or romanization for one lyric document. */
export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed.data;
  const key = transformCacheKey(
    body.trackKey,
    body.kind,
    body.targetLanguage,
    body.lines,
  );
  const cached = getCachedTransform(key);
  if (cached) {
    return NextResponse.json({ lines: cached, cached: true });
  }

  try {
    const lines = await transformLyricLines(body);
    setCachedTransform(key, lines);
    return NextResponse.json({ lines, cached: false });
  } catch {
    return NextResponse.json(
      { error: "transform_unavailable" },
      { status: 502 },
    );
  }
}
