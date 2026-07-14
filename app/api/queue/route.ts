import { NextResponse } from "next/server";
import { readSession, writeSession } from "@/lib/session";
import {
  ensureFreshSession,
  fetchQueue,
  SpotifyAuthError,
  SpotifyForbiddenError,
  SpotifyRateLimitError,
} from "@/lib/spotify";

export const dynamic = "force-dynamic";

/** Session-gated BFF proxy for Spotify's current playback queue. */
export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    let { session: fresh, changed } = await ensureFreshSession(session);
    let tracks;
    try {
      tracks = await fetchQueue(fresh.accessToken);
    } catch (error) {
      if (error instanceof SpotifyAuthError && !changed) {
        const refreshed = await ensureFreshSession({ ...fresh, expiresAt: 0 });
        fresh = refreshed.session;
        changed = true;
        tracks = await fetchQueue(fresh.accessToken);
      } else {
        throw error;
      }
    }

    if (changed) await writeSession(fresh);
    return NextResponse.json(
      { tracks },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof SpotifyAuthError) {
      return NextResponse.json({ error: "reauth_required" }, { status: 401 });
    }
    if (error instanceof SpotifyForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (error instanceof SpotifyRateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: error.retryAfterSeconds },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        },
      );
    }
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
