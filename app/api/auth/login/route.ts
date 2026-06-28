import { NextRequest, NextResponse } from "next/server";
import { env, SPOTIFY_SCOPES, spotifyCredentialsConfigured } from "@/lib/env";
import {
  generateCodeVerifier,
  deriveCodeChallenge,
  generateState,
} from "@/lib/pkce";
import { setOAuthTransientCookies } from "@/lib/session";
import { resolveRedirectUri } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/**
 * Begin OAuth (Authorization Code + PKCE). Generates the verifier/state, parks
 * them in short-lived httpOnly cookies (safer than localStorage on the fragile
 * Tesla browser, docs/05 §5.7), and does a FULL-PAGE redirect to Spotify —
 * popups are unreliable in the Tesla browser (docs/05 §5.3 step 2).
 */
export async function GET(req: NextRequest) {
  // Fail loud and in-app if the Spotify credentials are missing/placeholder,
  // rather than redirecting to Spotify with an invalid client_id.
  if (!spotifyCredentialsConfigured()) {
    const home = new URL("/", req.nextUrl.origin);
    home.searchParams.set("auth_error", "not_configured");
    return NextResponse.redirect(home.toString());
  }

  const verifier = generateCodeVerifier();
  const challenge = deriveCodeChallenge(verifier);
  const state = generateState();

  // Derive the redirect_uri from the host the user is actually on (the Tesla
  // browser hits the deployed domain, not 127.0.0.1) so it matches the dashboard
  // allow-list. Replay the exact same value at the token exchange via the cookie.
  const redirectUri = resolveRedirectUri(req);
  setOAuthTransientCookies(verifier, state, redirectUri);

  const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", env.spotifyClientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", SPOTIFY_SCOPES);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("code_challenge", challenge);

  return NextResponse.redirect(authorizeUrl.toString());
}
