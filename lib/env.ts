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
  get spotifyRedirectUri() {
    return required("SPOTIFY_REDIRECT_URI");
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
};

/** Spotify OAuth scopes we request — the minimum needed (docs/05 §5.2). */
export const SPOTIFY_SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
].join(" ");
