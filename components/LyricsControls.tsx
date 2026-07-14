"use client";

import { useCallback, useEffect, useState } from "react";
import type { LyricsCandidate, PlaybackState } from "@/lib/types";
import {
  FONT_MAX,
  FONT_MIN,
  FONT_STEP,
  OFFSET_MAX,
  OFFSET_MIN,
  OFFSET_STEP,
} from "@/hooks/useLyricSettings";
import {
  BACKDROP_OPTIONS,
  type BackdropStyle,
} from "@/hooks/useThemeSettings";

/**
 * The lyric-accuracy panel (docs/16): font-size (A−/A+), manual sync-offset
 * nudge (±), and a "wrong lyrics? search & re-pick" flow. Opened from the top
 * bar; parked-only by nature (the Tesla browser is disabled while driving).
 * Large touch targets (≥64px), accent-tinted active states.
 */
export default function LyricsControls({
  open,
  onClose,
  playback,
  fontScale,
  setFontScale,
  globalSyncOffsetMs,
  setGlobalSyncOffsetMs,
  trackSyncOffsetMs,
  setTrackSyncOffsetMs,
  overrideId,
  activeLyricsId,
  setOverride,
  clearOverride,
  backdrop,
  setBackdrop,
  accentLyrics,
  setAccentLyrics,
  ambientMotion,
  setAmbientMotion,
  canCalibrate,
  onStartCalibration,
}: {
  open: boolean;
  onClose: () => void;
  playback: PlaybackState | null;
  fontScale: number;
  setFontScale: (v: number) => void;
  globalSyncOffsetMs: number;
  setGlobalSyncOffsetMs: (v: number) => void;
  trackSyncOffsetMs: number;
  setTrackSyncOffsetMs: (v: number) => void;
  overrideId: string | null;
  activeLyricsId: string | null;
  setOverride: (trackId: string, recordId: string) => void;
  clearOverride: (trackId: string) => void;
  backdrop: BackdropStyle;
  setBackdrop: (v: BackdropStyle) => void;
  accentLyrics: boolean;
  setAccentLyrics: (v: boolean) => void;
  ambientMotion: boolean;
  setAmbientMotion: (v: boolean) => void;
  canCalibrate: boolean;
  onStartCalibration: () => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center">
      {/* Scrim — tap outside to close. */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      <section className="relative w-full max-w-3xl rounded-t-3xl border-t border-white/10 bg-ink-900/95 p-6 pb-8 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-lyric-active">
            Lyrics settings
          </h2>
          <button
            onClick={onClose}
            aria-label="Done"
            className="flex h-12 items-center rounded-full bg-white/10 px-6 text-base font-semibold text-lyric-active active:scale-95"
          >
            Done
          </button>
        </div>

        <FontSizeRow fontScale={fontScale} setFontScale={setFontScale} />

        <SyncOffsetRow
          label="Device delay"
          hint="Applies to every song on this display."
          syncOffsetMs={globalSyncOffsetMs}
          setSyncOffsetMs={setGlobalSyncOffsetMs}
        />

        <SyncOffsetRow
          label="This song"
          hint={
            playback?.trackId
              ? "Remembered whenever this exact track plays."
              : "Start a song to save its timing."
          }
          syncOffsetMs={trackSyncOffsetMs}
          setSyncOffsetMs={setTrackSyncOffsetMs}
          disabled={!playback?.trackId}
        />

        <Row
          label="Calibrate sync"
          hint={
            canCalibrate
              ? "Tap to the beat to tune timing automatically."
              : "Play a song with synced lyrics to calibrate."
          }
        >
          <button
            onClick={onStartCalibration}
            disabled={!canCalibrate}
            className="h-12 rounded-full bg-white/10 px-6 text-sm font-semibold text-lyric-active disabled:opacity-30 active:scale-95"
          >
            Tap to beat
          </button>
        </Row>

        <ThemeSection
          backdrop={backdrop}
          setBackdrop={setBackdrop}
          accentLyrics={accentLyrics}
          setAccentLyrics={setAccentLyrics}
          ambientMotion={ambientMotion}
          setAmbientMotion={setAmbientMotion}
        />

        <FixLyricsRow
          playback={playback}
          overrideId={overrideId}
          activeLyricsId={activeLyricsId}
          setOverride={setOverride}
          clearOverride={clearOverride}
        />
      </section>
    </div>
  );
}

/* ----------------------------- Font size ----------------------------- */

function FontSizeRow({
  fontScale,
  setFontScale,
}: {
  fontScale: number;
  setFontScale: (v: number) => void;
}) {
  return (
    <Row label="Text size">
      <Stepper
        onDec={() => setFontScale(fontScale - FONT_STEP)}
        onInc={() => setFontScale(fontScale + FONT_STEP)}
        decDisabled={fontScale <= FONT_MIN + 1e-6}
        incDisabled={fontScale >= FONT_MAX - 1e-6}
        decLabel="Smaller"
        incLabel="Larger"
        decContent={<span className="text-base font-bold">A−</span>}
        incContent={<span className="text-2xl font-bold">A+</span>}
        value={`${Math.round(fontScale * 100)}%`}
      />
    </Row>
  );
}

/* ----------------------------- Sync offset ----------------------------- */

function SyncOffsetRow({
  label,
  hint,
  syncOffsetMs,
  setSyncOffsetMs,
  disabled = false,
}: {
  label: string;
  hint: string;
  syncOffsetMs: number;
  setSyncOffsetMs: (v: number) => void;
  disabled?: boolean;
}) {
  const sign = syncOffsetMs > 0 ? "+" : "";
  return (
    <Row
      label={label}
      hint={`${hint}${
        syncOffsetMs === 0
          ? ""
          : syncOffsetMs > 0
          ? " Lyrics shown earlier."
          : " Lyrics shown later."
      }`}
    >
      <div className="flex items-center gap-3">
        <Stepper
          onDec={() => setSyncOffsetMs(syncOffsetMs - OFFSET_STEP)}
          onInc={() => setSyncOffsetMs(syncOffsetMs + OFFSET_STEP)}
          decDisabled={disabled || syncOffsetMs <= OFFSET_MIN}
          incDisabled={disabled || syncOffsetMs >= OFFSET_MAX}
          decLabel="Earlier"
          incLabel="Later"
          decContent={<span className="text-2xl font-bold">−</span>}
          incContent={<span className="text-2xl font-bold">+</span>}
          value={`${sign}${syncOffsetMs} ms`}
        />
        {!disabled && syncOffsetMs !== 0 && (
          <button
            onClick={() => setSyncOffsetMs(0)}
            className="h-12 rounded-full px-4 text-sm font-semibold text-lyric-dim active:scale-95"
          >
            Reset
          </button>
        )}
      </div>
    </Row>
  );
}

/* ----------------------------- Fix lyrics ----------------------------- */

function FixLyricsRow({
  playback,
  overrideId,
  activeLyricsId,
  setOverride,
  clearOverride,
}: {
  playback: PlaybackState | null;
  overrideId: string | null;
  activeLyricsId: string | null;
  setOverride: (trackId: string, recordId: string) => void;
  clearOverride: (trackId: string) => void;
}) {
  const trackId = playback?.trackId ?? null;
  const [openSearch, setOpenSearch] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<LyricsCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickStatus, setQuickStatus] = useState<string | null>(null);

  useEffect(() => {
    setResults(null);
    setQuickStatus(null);
  }, [trackId]);

  // Prefill the query with the current track when the search opens.
  useEffect(() => {
    if (openSearch && playback) {
      setTerm(
        [playback.title, playback.artists].filter(Boolean).join(" ").trim(),
      );
    }
  }, [openSearch, playback]);

  const runSearch = useCallback(async () => {
    const q = term.trim();
    if (!q) return;
    setLoading(true);
    setError(false);
    setResults(null);
    try {
      const res = await fetch(`/api/lyrics/search?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { candidates: LyricsCandidate[] };
      setResults(data.candidates ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [term]);

  const tryAnother = useCallback(async () => {
    if (!trackId || !playback?.title || !playback.artists) return;
    setQuickLoading(true);
    setQuickStatus(null);
    try {
      let candidates = results;
      if (!candidates) {
        const q = `${playback.title} ${playback.artists}`;
        const res = await fetch(
          `/api/lyrics/search?q=${encodeURIComponent(q)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { candidates: LyricsCandidate[] };
        candidates = data.candidates ?? [];
        setResults(candidates);
      }

      const targetSec = playback.durationMs / 1000;
      const ranked = [...candidates].sort((a, b) => {
        if (a.hasSynced !== b.hasSynced) return a.hasSynced ? -1 : 1;
        const aDelta =
          a.durationSec == null ? Number.MAX_SAFE_INTEGER : Math.abs(a.durationSec - targetSec);
        const bDelta =
          b.durationSec == null ? Number.MAX_SAFE_INTEGER : Math.abs(b.durationSec - targetSec);
        return aDelta - bDelta;
      });

      const currentId = overrideId ?? activeLyricsId;
      const currentIndex = ranked.findIndex((candidate) => candidate.id === currentId);
      const next = ranked.find(
        (candidate, index) =>
          candidate.id !== currentId && (currentIndex < 0 || index > currentIndex),
      ) ?? ranked.find((candidate) => candidate.id !== currentId);

      if (!next) {
        setQuickStatus("No other matches found.");
        return;
      }

      setOverride(trackId, next.id);
      setQuickStatus(`Trying ${next.trackName} by ${next.artistName}.`);
    } catch {
      setQuickStatus("Could not load another match.");
    } finally {
      setQuickLoading(false);
    }
  }, [activeLyricsId, overrideId, playback, results, setOverride, trackId]);

  if (!trackId) {
    return (
      <Row label="Fix lyrics">
        <span className="text-sm text-lyric-faint">
          Start a song to adjust its lyrics.
        </span>
      </Row>
    );
  }

  return (
    <div className="mt-2 border-t border-white/8 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-base font-medium text-lyric-active">Fix lyrics</p>
          <p className="text-sm text-lyric-dim">
            {overrideId
              ? "Using a manually-picked match for this song."
              : "Wrong words or timing? Pick the right match."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => void tryAnother()}
            disabled={quickLoading}
            className="h-12 rounded-full px-5 text-sm font-semibold text-black disabled:opacity-40 active:scale-95"
            style={{ background: "var(--accent)" }}
          >
            {quickLoading ? "Finding…" : "Try another"}
          </button>
          {overrideId && (
            <button
              onClick={() => clearOverride(trackId)}
              className="h-12 rounded-full px-4 text-sm font-semibold text-lyric-dim active:scale-95"
            >
              Use automatic
            </button>
          )}
          <button
            onClick={() => setOpenSearch((v) => !v)}
            className="h-12 rounded-full bg-white/10 px-5 text-sm font-semibold text-lyric-active active:scale-95"
          >
            {openSearch ? "Hide search" : "Search lyrics"}
          </button>
        </div>
      </div>

      {quickStatus && (
        <p className="mb-3 text-sm text-lyric-dim" role="status">
          {quickStatus}
        </p>
      )}

      {openSearch && (
        <div>
          <div className="flex gap-2">
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
              placeholder="Search by song and artist"
              className="h-12 min-w-0 flex-1 rounded-full bg-ink-800 px-5 text-base text-lyric-active outline-none placeholder:text-lyric-faint focus:ring-2"
              style={{ ["--tw-ring-color" as string]: "var(--accent)" }}
            />
            <button
              onClick={() => void runSearch()}
              disabled={loading || !term.trim()}
              className="h-12 rounded-full px-5 text-sm font-semibold text-black disabled:opacity-40 active:scale-95"
              style={{ background: "var(--accent)" }}
            >
              {loading ? "…" : "Go"}
            </button>
          </div>

          <div className="mt-3 max-h-[34vh] overflow-y-auto">
            {error && (
              <p className="px-1 py-3 text-sm text-amber-300">
                Search failed — try again.
              </p>
            )}
            {results && results.length === 0 && !error && (
              <p className="px-1 py-3 text-sm text-lyric-dim">
                No matches found.
              </p>
            )}
            {results?.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setOverride(trackId, c.id);
                  setOpenSearch(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left active:scale-[0.99] ${
                  overrideId === c.id ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium text-lyric-active">
                    {c.trackName}
                  </span>
                  <span className="block truncate text-sm text-lyric-dim">
                    {c.artistName}
                    {c.albumName ? ` · ${c.albumName}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {c.durationSec != null && (
                    <span className="text-xs text-lyric-faint">
                      {formatDuration(c.durationSec)}
                    </span>
                  )}
                  {c.instrumental ? (
                    <Badge>Instrumental</Badge>
                  ) : c.hasSynced ? (
                    <Badge accent>♪ Synced</Badge>
                  ) : (
                    <Badge>Text</Badge>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Theme ------------------------------- */

function ThemeSection({
  backdrop,
  setBackdrop,
  accentLyrics,
  setAccentLyrics,
  ambientMotion,
  setAmbientMotion,
}: {
  backdrop: BackdropStyle;
  setBackdrop: (v: BackdropStyle) => void;
  accentLyrics: boolean;
  setAccentLyrics: (v: boolean) => void;
  ambientMotion: boolean;
  setAmbientMotion: (v: boolean) => void;
}) {
  return (
    <>
      <Row label="Background">
        <Segmented
          value={backdrop}
          options={BACKDROP_OPTIONS}
          onChange={setBackdrop}
        />
      </Row>
      <Row label="Accent on lyrics" hint="Tint the active line with album colour.">
        <Toggle on={accentLyrics} onChange={setAccentLyrics} label="Accent on lyrics" />
      </Row>
      <Row label="Ambient motion" hint="Slow drifting background.">
        <Toggle on={ambientMotion} onChange={setAmbientMotion} label="Ambient motion" />
      </Row>
    </>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full bg-ink-800 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="h-11 rounded-full px-4 text-sm font-semibold transition active:scale-95"
            style={
              active
                ? { background: "var(--accent)", color: "#000" }
                : { color: "#9aa0ad" }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-9 w-16 rounded-full transition active:scale-95"
      style={{ background: on ? "var(--accent)" : "rgba(255,255,255,0.15)" }}
    >
      <span
        className="absolute top-1 h-7 w-7 rounded-full bg-white transition-[left]"
        style={{ left: on ? "2.0rem" : "0.25rem" }}
      />
    </button>
  );
}

/* ----------------------------- Shared bits ----------------------------- */

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/8 py-4">
      <div>
        <p className="text-base font-medium text-lyric-active">{label}</p>
        {hint && <p className="text-sm text-lyric-dim">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Stepper({
  onDec,
  onInc,
  decDisabled,
  incDisabled,
  decLabel,
  incLabel,
  decContent,
  incContent,
  value,
}: {
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
  incDisabled?: boolean;
  decLabel: string;
  incLabel: string;
  decContent: React.ReactNode;
  incContent: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <StepButton onClick={onDec} disabled={decDisabled} label={decLabel}>
        {decContent}
      </StepButton>
      <span className="min-w-[5.5rem] text-center text-base font-semibold tabular-nums text-lyric-active">
        {value}
      </span>
      <StepButton onClick={onInc} disabled={incDisabled} label={incLabel}>
        {incContent}
      </StepButton>
    </div>
  );
}

function StepButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-lyric-active transition active:scale-95 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold"
      style={
        accent
          ? { color: "var(--accent)", background: "rgba(255,255,255,0.08)" }
          : { color: "#9aa0ad", background: "rgba(255,255,255,0.06)" }
      }
    >
      {children}
    </span>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
