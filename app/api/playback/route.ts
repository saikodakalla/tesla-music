import { NextResponse } from "next/server";
import { readSession, writeSession } from "@/lib/session";
import {
  ensureFreshSession,
  fetchPlayback,
  SpotifyAuthError,
  SpotifyForbiddenError,
  SpotifyRateLimitError,
} from "@/lib/spotify";

export const dynamic = "force-dynamic";

/**
 * BFF playback proxy (docs/05 Variant B). The browser never holds a Spotify
 * token: it polls this route, we use the server-held token to call
 * /me/player, refresh proactively/reactively, and return a normalised snapshot.
 *
 * Status codes the client understands:
 *   200 → PlaybackState
 *   401 → not logged in / refresh failed → show login
 *   403 → Spotify forbidden (usually the dev-mode 5-user cap)
 *   429 → rate limited (Retry-After echoed)
 */
export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    // Proactive refresh at T-60s.
    let { session: fresh, changed } = await ensureFreshSession(session);

    let playback;
    try {
      playback = await fetchPlayback(fresh.accessToken);
    } catch (e) {
      // Reactive refresh on a 401 we didn't anticipate, then retry once.
      if (e instanceof SpotifyAuthError && !changed) {
        const refreshed = await ensureFreshSession({
          ...fresh,
          expiresAt: 0, // force refresh
        });
        fresh = refreshed.session;
        changed = true;
        playback = await fetchPlayback(fresh.accessToken);
      } else {
        throw e;
      }
    }

    if (changed) await writeSession(fresh);

    return NextResponse.json(playback, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof SpotifyAuthError) {
      return NextResponse.json({ error: "reauth_required" }, { status: 401 });
    }
    if (e instanceof SpotifyForbiddenError) {
      return NextResponse.json(
        { error: "forbidden_dev_mode" },
        { status: 403 },
      );
    }
    if (e instanceof SpotifyRateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: e.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(e.retryAfterSeconds) } },
      );
    }
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
