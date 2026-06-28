import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/session";
import { getLyricsProvider } from "@/lib/lyrics/provider";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().min(1).max(400),
});

/**
 * Lyrics search endpoint for the "wrong lyrics? re-pick" flow. Session-gated so
 * it isn't an open proxy. Returns a candidate list (or [] if the active
 * provider can't search). Never cached — the user is actively browsing.
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

  const provider = getLyricsProvider();
  if (!provider.search) {
    return NextResponse.json({ candidates: [] });
  }

  try {
    const candidates = await provider.search(parsed.data.q);
    return NextResponse.json(
      { candidates },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "search_unavailable" }, { status: 502 });
  }
}
