import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSession, writeSession } from "@/lib/session";
import {
  ensureFreshSession,
  sendPlaybackCommand,
  SpotifyAuthError,
  SpotifyForbiddenError,
  SpotifyNoActiveDeviceError,
  SpotifyRateLimitError,
} from "@/lib/spotify";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  command: z.enum(["play", "pause", "next", "previous"]),
});

/** Session-gated playback command proxy. Tokens remain server-side. */
export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    let { session: fresh, changed } = await ensureFreshSession(session);
    try {
      await sendPlaybackCommand(fresh.accessToken, parsed.data.command);
    } catch (error) {
      if (error instanceof SpotifyAuthError && !changed) {
        const refreshed = await ensureFreshSession({ ...fresh, expiresAt: 0 });
        fresh = refreshed.session;
        changed = true;
        await sendPlaybackCommand(fresh.accessToken, parsed.data.command);
      } else {
        throw error;
      }
    }

    if (changed) await writeSession(fresh);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof SpotifyAuthError) {
      return NextResponse.json({ error: "reauth_required" }, { status: 401 });
    }
    if (error instanceof SpotifyForbiddenError) {
      return NextResponse.json(
        { error: "control_forbidden" },
        { status: 403 },
      );
    }
    if (error instanceof SpotifyNoActiveDeviceError) {
      return NextResponse.json(
        { error: "no_active_device" },
        { status: 409 },
      );
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
