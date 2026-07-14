"use client";

import type { PlaybackCommand } from "@/hooks/usePlaybackControls";

export default function PlaybackControls({
  visible,
  isPlaying,
  pending,
  error,
  onCommand,
}: {
  visible: boolean;
  isPlaying: boolean;
  pending: PlaybackCommand | null;
  error: string | null;
  onCommand: (command: PlaybackCommand) => void;
}) {
  const disabled = !!pending;
  return (
    <div
      className={`absolute left-1/2 top-4 hidden -translate-x-1/2 flex-col items-center md:flex ${
        visible ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-2 rounded-2xl bg-ink-900/70 p-1 backdrop-blur">
        <CommandButton
          label="Previous track"
          disabled={disabled}
          onClick={() => onCommand("previous")}
        >
          <PreviousIcon />
        </CommandButton>
        <CommandButton
          label={isPlaying ? "Pause" : "Play"}
          disabled={disabled}
          primary
          onClick={() => onCommand(isPlaying ? "pause" : "play")}
        >
          {pending === "play" || pending === "pause" ? (
            <LoadingIcon />
          ) : isPlaying ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </CommandButton>
        <CommandButton
          label="Next track"
          disabled={disabled}
          onClick={() => onCommand("next")}
        >
          <NextIcon />
        </CommandButton>
      </div>
      {error && (
        <p
          className="mt-2 whitespace-nowrap rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300"
          role="status"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function CommandButton({
  label,
  disabled,
  primary = false,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  primary?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center rounded-xl transition disabled:opacity-40 active:scale-95 ${
        primary
          ? "h-16 w-16 text-black"
          : "h-14 w-14 text-lyric-active active:bg-white/10"
      }`}
      style={primary ? { background: "var(--accent)" } : undefined}
    >
      {children}
    </button>
  );
}

const iconClass = "h-6 w-6";

function PreviousIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="currentColor">
      <path d="M6 5h2v14H6zM19 6.2v11.6L10 12z" />
    </svg>
  );
}
function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="currentColor">
      <path d="M16 5h2v14h-2zM5 6.2v11.6l9-5.8z" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="currentColor">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}
function LoadingIcon() {
  return (
    <svg viewBox="0 0 24 24" className={`${iconClass} animate-spin`} fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M12 4a8 8 0 018 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
