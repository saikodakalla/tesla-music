/**
 * Spotify wordmark + logo for the required attribution (docs/06 §6.6).
 * Inline SVG so there's no extra network request on the slow browser.
 */
export default function SpotifyMark({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-lyric-dim ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5 shrink-0"
        fill="#1db954"
      >
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.32a.75.75 0 01-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.16a.75.75 0 11-.33-1.46c4.57-1.04 8.5-.59 11.66 1.34.35.22.46.68.25 1.03zm1.47-3.27a.94.94 0 01-1.29.31c-3.23-1.98-8.15-2.56-11.97-1.4a.94.94 0 11-.54-1.8c4.37-1.32 9.79-.68 13.5 1.6.44.27.58.85.3 1.29zm.13-3.4C15.73 8.28 8.5 8.05 4.78 9.18a1.12 1.12 0 11-.65-2.15c4.27-1.3 12.25-1.05 16.55 1.5a1.12 1.12 0 11-1.16 1.92z" />
      </svg>
      <span className="text-sm font-medium tracking-wide">Spotify</span>
    </span>
  );
}
