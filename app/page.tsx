import { readSession } from "@/lib/session";
import { fetchPlayback } from "@/lib/spotify";
import { getLyricsProvider } from "@/lib/lyrics/provider";
import { getCached, setCached } from "@/lib/lyrics/cache";
import { trackKey } from "@/lib/lyrics/match";
import type { LyricsDoc, PlaybackState } from "@/lib/types";
import LoginScreen from "@/components/LoginScreen";
import Player from "@/components/Player";

export const dynamic = "force-dynamic";

/** Resolve `p`, but give up with `null` after `ms` so render isn't blocked. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), ms)),
  ]);
}

/**
 * Home. Server component: checks the httpOnly session cookie so there's no
 * flash of the wrong screen on load. If a session survived a Tesla browser
 * reboot, we go straight into the player and resume (docs/10 #20).
 *
 * To minimise the time from page-open → lyrics-on-screen, we PREFETCH the
 * current playback (and, best-effort, its lyrics) here on the server and hand
 * them to the Player as initial state. That removes the client's first
 * playback round-trip and, when lyrics are cached or LRCLIB is quick, paints
 * the words on the very first frame instead of after two more network hops.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: { auth_error?: string };
}) {
  const session = await readSession();

  if (!session) {
    return <LoginScreen authError={searchParams.auth_error} />;
  }

  let initialPlayback: PlaybackState | null = null;
  let initialLyrics: LyricsDoc | null = null;

  // Only prefetch while the access token is still valid: a server component
  // cannot write the refreshed cookie, so if it's near expiry we let the
  // client refresh + fetch instead.
  if (Date.now() < session.expiresAt - 60_000) {
    initialPlayback = await withTimeout(fetchPlayback(session.accessToken), 2500);

    if (
      initialPlayback?.isActive &&
      initialPlayback.type === "track" &&
      initialPlayback.trackId &&
      initialPlayback.title &&
      initialPlayback.artists
    ) {
      const key = trackKey({
        title: initialPlayback.title,
        artist: initialPlayback.artists,
        durationMs: initialPlayback.durationMs,
        isrc: initialPlayback.isrc,
      });
      const cached = getCached(key);
      if (cached) {
        initialLyrics = cached;
      } else {
        // Bounded so a slow LRCLIB never stalls the page; the client will
        // fetch the lyrics itself if we don't get them in time.
        const doc = await withTimeout(
          getLyricsProvider().getLyrics({
            title: initialPlayback.title,
            artist: initialPlayback.artists,
            album: initialPlayback.album,
            durationMs: initialPlayback.durationMs,
            isrc: initialPlayback.isrc,
          }),
          1800,
        );
        if (doc) {
          setCached(key, doc);
          initialLyrics = doc;
        }
      }
    }
  }

  return <Player initialPlayback={initialPlayback} initialLyrics={initialLyrics} />;
}
