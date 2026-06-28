import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/session";
import { getLyricsProvider } from "@/lib/lyrics/provider";
import { getCached, setCached } from "@/lib/lyrics/cache";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  id: z.string().min(1).max(64),
});

/**
 * Fetch a specific lyrics record by provider id — the document the user picked
 * in the "wrong lyrics? re-pick" flow. Session-gated and cached (the same
 * manual pick is replayed every time that song comes back).
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
  const id = parsed.data.id;

  const provider = getLyricsProvider();
  if (!provider.getById) {
    return NextResponse.json({ error: "not_supported" }, { status: 400 });
  }

  const key = `lrclib:id:${id}`;
  const cached = getCached(key);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "private, max-age=86400" },
    });
  }

  try {
    const doc = await provider.getById(id);
    setCached(key, doc);
    return NextResponse.json(doc, {
      headers: { "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return NextResponse.json({ error: "lyrics_unavailable" }, { status: 502 });
  }
}
