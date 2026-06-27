import SpotifyMark from "./SpotifyMark";

const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch: "Login security check failed. Please try again.",
  missing_params: "Login didn't complete. Please try again.",
  exchange_failed:
    "Couldn't connect to Spotify. Please try again in a moment.",
  access_denied: "Login was cancelled.",
  not_configured:
    "Spotify isn't configured yet. Add your real SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.local (see the README), then restart the dev server.",
};

/**
 * One-tap login (docs/08 §8.5). A single big button does a full-page redirect
 * to Spotify — the only keyboard moment in the whole app is the Spotify
 * password on Spotify's own page.
 */
export default function LoginScreen({ authError }: { authError?: string }) {
  const message = authError
    ? ERROR_MESSAGES[authError] ??
      "This app is in Spotify development mode and limited to 5 approved users."
    : null;

  return (
    <main className="flex h-full w-full flex-col items-center justify-center px-8 text-center">
      <h1 className="mb-3 text-[clamp(2rem,5vw,3.5rem)] font-semibold tracking-tight text-lyric-active">
        Tesla Lyrics
      </h1>
      <p className="mb-12 max-w-2xl text-[clamp(1rem,2.2vw,1.5rem)] leading-relaxed text-lyric-dim">
        Synced lyrics for whatever you&apos;re playing on Spotify. Keep playing
        in your Spotify app — this just shows the words, in time.
      </p>

      {/* Big, glove-friendly touch target (≥64px, docs/08 §8.5). */}
      <a
        href="/api/auth/login"
        className="flex min-h-[72px] items-center justify-center gap-3 rounded-full bg-spotify px-12 py-5 text-2xl font-semibold text-black shadow-lg transition active:scale-[0.98]"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.32a.75.75 0 01-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.16a.75.75 0 11-.33-1.46c4.57-1.04 8.5-.59 11.66 1.34.35.22.46.68.25 1.03zm1.47-3.27a.94.94 0 01-1.29.31c-3.23-1.98-8.15-2.56-11.97-1.4a.94.94 0 11-.54-1.8c4.37-1.32 9.79-.68 13.5 1.6.44.27.58.85.3 1.29zm.13-3.4C15.73 8.28 8.5 8.05 4.78 9.18a1.12 1.12 0 11-.65-2.15c4.27-1.3 12.25-1.05 16.55 1.5a1.12 1.12 0 11-1.16 1.92z" />
        </svg>
        Log in with Spotify
      </a>

      {message && (
        <p className="mt-8 max-w-xl text-base text-amber-400/90">{message}</p>
      )}

      <div className="absolute bottom-8 flex flex-col items-center gap-2 text-xs text-lyric-faint">
        <SpotifyMark />
        <span>
          Lyrics are for personal use. Audio plays in your Spotify app.
        </span>
      </div>
    </main>
  );
}
