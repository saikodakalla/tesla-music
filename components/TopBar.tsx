"use client";

import SpotifyMark from "./SpotifyMark";
import type { PlaybackState, QueueTrack } from "@/lib/types";

/**
 * Slim, quiet top bar (docs/08 §8.2): album art, title/artist, the required
 * Spotify attribution, a dim toggle, fullscreen, and logout. Auto-hides; tap
 * anywhere reveals it. Controls are large touch targets (≥64px, §8.5).
 */
export default function TopBar({
  playback,
  nextTrack,
  visible,
  dimmed,
  onToggleDim,
  onToggleFullscreen,
  onOpenSettings,
  reconnecting,
}: {
  playback: PlaybackState | null;
  nextTrack: QueueTrack | null;
  visible: boolean;
  dimmed: boolean;
  onToggleDim: () => void;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  reconnecting: boolean;
}) {
  return (
    <header
      className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 px-6 py-4 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Now playing */}
      <div className="pointer-events-auto flex min-w-0 items-center gap-4">
        {playback?.albumArtUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={playback.albumArtUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg shadow-lg"
          />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-lg bg-ink-800" />
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-lyric-active">
            {playback?.title ?? "Tesla Lyrics"}
          </p>
          <p className="truncate text-sm text-lyric-dim">
            {playback?.artists ?? "Waiting for Spotify…"}
          </p>
          {nextTrack && (
            <p className="mt-1 truncate text-xs text-lyric-faint">
              Next: {nextTrack.title} · {nextTrack.artists}
            </p>
          )}
        </div>
      </div>

      {/* Attribution + controls */}
      <div className="pointer-events-auto flex items-center gap-2">
        {reconnecting && (
          <span className="mr-1 hidden text-sm text-amber-400/80 sm:inline">
            Reconnecting…
          </span>
        )}
        {playback?.spotifyUrl ? (
          <a
            href={playback.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            className="mr-1 flex h-16 items-center rounded-xl px-3"
            aria-label="Open in Spotify"
          >
            <SpotifyMark />
          </a>
        ) : (
          <SpotifyMark className="mr-1" />
        )}

        <ControlButton label="Lyrics settings" onClick={onOpenSettings}>
          <SlidersIcon />
        </ControlButton>

        <ControlButton label={dimmed ? "Brighten" : "Dim"} onClick={onToggleDim}>
          {dimmed ? <SunIcon /> : <MoonIcon />}
        </ControlButton>

        <ControlButton label="Fullscreen" onClick={onToggleFullscreen}>
          <ExpandIcon />
        </ControlButton>

        <form action="/api/auth/logout" method="post" className="contents">
          <button
            type="submit"
            aria-label="Log out"
            className="flex h-16 w-16 items-center justify-center rounded-xl text-lyric-dim transition active:scale-95 active:bg-ink-800"
          >
            <LogoutIcon />
          </button>
        </form>
      </div>
    </header>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-16 w-16 items-center justify-center rounded-xl text-lyric-dim transition active:scale-95 active:bg-ink-800"
    >
      {children}
    </button>
  );
}

const iconClass = "h-7 w-7";

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  );
}
function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
