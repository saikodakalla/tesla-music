import type { NextRequest } from "next/server";

/** The fixed path Spotify redirects back to after authorization. */
export const OAUTH_CALLBACK_PATH = "/api/auth/callback";

/**
 * Resolve the OAuth redirect URI from the ACTUAL request the user made.
 *
 * Spotify requires the `redirect_uri` we send to `/authorize` to (a) match an
 * entry in the app's dashboard allow-list and (b) be a host the browser can
 * actually return to. A hardcoded `http://127.0.0.1:3000/...` fails both when
 * the app is reached from the Tesla browser on a deployed domain — Spotify
 * answers "redirect_uri: Not matching configuration".
 *
 * Deriving it from the request (honoring `x-forwarded-*` set by Vercel/proxies)
 * means the value always matches whatever host the user is on. That exact value
 * must also be added to the Spotify Developer Dashboard allow-list (exact match
 * including scheme, host, port and path).
 *
 * `SPOTIFY_REDIRECT_URI` is honored only as a fallback when the host can't be
 * derived (e.g. a non-HTTP invocation).
 */
export function resolveRedirectUri(req: NextRequest): string {
  // x-forwarded-* can be comma-separated lists ("https,http"); take the first.
  const first = (v: string | null) => v?.split(",")[0]?.trim() || null;

  const host =
    first(req.headers.get("x-forwarded-host")) ??
    first(req.headers.get("host")) ??
    req.nextUrl.host ??
    null;

  if (host) {
    const proto =
      first(req.headers.get("x-forwarded-proto")) ??
      req.nextUrl.protocol.replace(/:$/, "") ??
      "https";
    return `${proto}://${host}${OAUTH_CALLBACK_PATH}`;
  }

  const fallback = process.env.SPOTIFY_REDIRECT_URI?.trim();
  if (fallback) return fallback;

  throw new Error("Unable to determine OAuth redirect URI from request.");
}
