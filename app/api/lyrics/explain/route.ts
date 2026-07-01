import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/session";
import { explainLine } from "@/lib/lyrics/deepseek";
import {
  explainCacheKey,
  getCachedExplanation,
  setCachedExplanation,
} from "@/lib/lyrics/explainCache";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  trackKey: z.string().min(1).max(200),
  lineIndex: z.number().int().min(0).max(5000),
  line: z.string().min(1).max(500),
  prevLine: z.string().max(500).optional(),
  nextLine: z.string().max(500).optional(),
  title: z.string().min(1).max(400),
  artist: z.string().min(1).max(400),
});

/**
 * On-demand AI lyric-line explanation, via DeepSeek. Requires a session so
 * it isn't an open LLM proxy. Only the tapped line (plus a line of context
 * either side) is ever sent — never the full song — and nothing is
 * persisted beyond the transient in-memory cache: this is a pass-through
 * interpretation call, not model training or lyric redistribution
 * (Spotify §III.14).
 */
export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const b = parsed.data;

  const key = explainCacheKey(b.trackKey, b.lineIndex, b.line);
  const cached = getCachedExplanation(key);
  if (cached) {
    return NextResponse.json({ explanation: cached, cached: true });
  }

  try {
    const explanation = await explainLine({
      title: b.title,
      artist: b.artist,
      line: b.line,
      prevLine: b.prevLine,
      nextLine: b.nextLine,
    });
    setCachedExplanation(key, explanation);
    return NextResponse.json({ explanation, cached: false });
  } catch {
    return NextResponse.json(
      { error: "explanation_unavailable" },
      { status: 502 },
    );
  }
}
