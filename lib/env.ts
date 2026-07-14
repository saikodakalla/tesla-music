/**
 * Centralised, validated access to server-side environment variables.
 * Reading through here (instead of process.env everywhere) gives one clear
 * error when something is misconfigured, rather than a confusing 401 later.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return v;
}

export const env = {
  get spotifyClientId() {
    return required("SPOTIFY_CLIENT_ID");
  },
  get spotifyClientSecret() {
    return required("SPOTIFY_CLIENT_SECRET");
  },
  /**
   * Optional. The redirect URI is now derived per-request from the host the
   * user is actually on (see lib/oauth.ts), so it matches the dashboard
   * allow-list whether that's 127.0.0.1 locally or the deployed domain on the
   * Tesla. This env var is only consulted as a fallback when the host can't be
   * derived from the request.
   */
  get spotifyRedirectUri() {
    return process.env.SPOTIFY_REDIRECT_URI?.trim() ?? "";
  },
  get sessionSecret() {
    const s = required("SESSION_SECRET");
    if (s.length < 32) {
      throw new Error(
        "SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32",
      );
    }
    return s;
  },
  get lrclibUserAgent() {
    return (
      process.env.LRCLIB_USER_AGENT ||
      "tesla-lyrics (https://github.com/tesla-lyrics/app)"
    );
  },
  get deepseekApiKey() {
    return required("DEEPSEEK_API_KEY");
  },
};

/**
 * True only when the Spotify credentials look like real values. Catches the
 * common first-run mistake of leaving the `.env.example` placeholders in place,
 * which otherwise sends `test_client_id_placeholder` to Spotify and bounces the
 * user to Spotify's opaque "client_id: Invalid" page after they tap Log in.
 */
export function spotifyCredentialsConfigured(): boolean {
  const id = process.env.SPOTIFY_CLIENT_ID?.trim() ?? "";
  const secret = process.env.SPOTIFY_CLIENT_SECRET?.trim() ?? "";
  if (!id || !secret) return false;
  // Real Spotify client IDs are 32-char lowercase hex; reject obvious placeholders.
  if (/placeholder|changeme|your[_-]?client|test[_-]?client|xxxx/i.test(id)) {
    return false;
  }
  if (!/^[0-9a-f]{32}$/i.test(id)) return false;
  return true;
}

/** Spotify OAuth scopes we request — the minimum needed (docs/05 §5.2). */
export const SPOTIFY_SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");
