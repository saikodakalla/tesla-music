"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayback } from "@/hooks/usePlayback";
import { useLyrics } from "@/hooks/useLyrics";
import { useArtTheme } from "@/hooks/useArtTheme";
import { useLyricSettings } from "@/hooks/useLyricSettings";
import { useLyricOverride } from "@/hooks/useLyricOverride";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { useLyricExplanation } from "@/hooks/useLyricExplanation";
import { useQueue } from "@/hooks/useQueue";
import { useLyricTransform } from "@/hooks/useLyricTransform";
import AmbientBackdrop from "./AmbientBackdrop";
import ExplainSheet from "./ExplainSheet";
import GradientMesh from "./GradientMesh";
import IdleScreen from "./IdleScreen";
import LyricsControls from "./LyricsControls";
import SyncCalibrator from "./SyncCalibrator";
import LyricsView from "./LyricsView";
import PlainLyrics from "./PlainLyrics";
import StatusCard from "./StatusCard";
import TopBar from "./TopBar";
import type { LyricsDoc, PlaybackState } from "@/lib/types";

const UI_IDLE_MS = 4500; // hide chrome + cursor after this much inactivity

export default function Player({
  initialPlayback = null,
  initialLyrics = null,
}: {
  initialPlayback?: PlaybackState | null;
  initialLyrics?: LyricsDoc | null;
}) {
  const router = useRouter();
  const { playback, anchor, status, outageMs } = usePlayback(initialPlayback);
  const queue = useQueue(playback?.trackId);

  // Lyric display prefs (font size + sync nudge) and per-track manual override.
  const {
    fontScale,
    setFontScale,
    syncOffsetMs,
    globalSyncOffsetMs,
    setGlobalSyncOffsetMs,
    trackSyncOffsetMs,
    setTrackSyncOffsetMs,
  } = useLyricSettings(playback?.trackId);
  const { overrideId, setOverride, clearOverride } = useLyricOverride(
    playback?.trackId,
  );
  const { lyrics, loading } = useLyrics(playback, initialLyrics, overrideId);
  const language = useLyricTransform({
    trackKey: lyrics?.synced ? lyrics.trackKey : null,
    title: playback?.title,
    artist: playback?.artists,
    lines: lyrics?.synced ? lyrics.lines : null,
  });

  // Album-art-derived accent + palette for the ambient theme, and the look
  // preferences that decide how they're used.
  const { accent, palette } = useArtTheme(playback?.albumArtUrl);
  const theme = useThemeSettings();

  const [uiVisible, setUiVisible] = useState(true);
  const [dimmed, setDimmed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [explainIndex, setExplainIndex] = useState<number | null>(null);
  const explanation = useLyricExplanation();
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Remember the last album art so the idle screen can echo "what was on".
  const lastArtRef = useRef<string | null>(null);
  if (playback?.albumArtUrl) lastArtRef.current = playback.albumArtUrl;

  // Tap-to-beat calibration only makes sense against playing, synced lyrics.
  const canCalibrate =
    !!playback?.isPlaying && !!lyrics?.synced && lyrics.lines.length > 0;

  // Session ended server-side → re-render the home route to show the login.
  useEffect(() => {
    if (status === "reauth") router.refresh();
  }, [status, router]);

  // Dismiss any open explanation when the song changes.
  useEffect(() => {
    setExplainIndex(null);
    explanation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback?.trackId]);

  const handleLineTap = useCallback(
    (idx: number) => {
      if (!lyrics || !playback) return;
      const line = lyrics.lines[idx];
      if (!line || !line.text.trim()) return;
      setExplainIndex(idx);
      explanation.explain({
        trackKey: lyrics.trackKey,
        lineIndex: idx,
        line: line.text,
        prevLine: lyrics.lines[idx - 1]?.text,
        nextLine: lyrics.lines[idx + 1]?.text,
        title: playback.title ?? "",
        artist: playback.artists ?? "",
      });
    },
    [lyrics, playback, explanation],
  );

  // Auto-hide chrome + cursor after inactivity (docs/08 §8.5, §8.7).
  const poke = useCallback(() => {
    setUiVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setUiVisible(false), UI_IDLE_MS);
  }, []);

  useEffect(() => {
    poke();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [poke]);

  const toggleFullscreen = useCallback(() => {
    // Gesture-gated; degrades silently if the Tesla browser no-ops (docs/08 §8.7).
    const el = containerRef.current;
    try {
      if (!document.fullscreenElement && el?.requestFullscreen) {
        void el.requestFullscreen().catch(() => {});
      } else if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => {});
      }
    } catch {
      /* ignore */
    }
    poke();
  }, [poke]);

  const reconnecting = status === "reconnecting" || status === "ratelimited";
  const showReconnectHint = reconnecting && outageMs > 4000;

  return (
    <main
      ref={containerRef}
      onPointerDown={poke}
      onPointerMove={poke}
      className={`relative h-full w-full bg-ink-950 ${
        uiVisible ? "" : "cursor-idle"
      }`}
      style={
        {
          "--accent": accent,
          "--lyric-scale": fontScale,
        } as React.CSSProperties
      }
    >
      {theme.backdrop === "mesh" ? (
        <GradientMesh palette={palette} motion={theme.ambientMotion} />
      ) : theme.backdrop === "blur" ? (
        <AmbientBackdrop albumArtUrl={playback?.albumArtUrl} accent={accent} />
      ) : (
        <div className="absolute inset-0 bg-ink-950" />
      )}

      <TopBar
        playback={playback}
        nextTrack={queue[0] ?? null}
        visible={uiVisible}
        dimmed={dimmed}
        onToggleDim={() => {
          setDimmed((d) => !d);
          poke();
        }}
        onToggleFullscreen={toggleFullscreen}
        onOpenSettings={() => {
          setSettingsOpen(true);
          poke();
        }}
        reconnecting={reconnecting}
      />

      <div
        className="relative z-10 h-full w-full transition-[filter] duration-500"
        style={{ filter: dimmed ? "brightness(0.55)" : "none" }}
      >
        <CenterContent
          status={status}
          playback={playback}
          anchor={anchor}
          lyrics={lyrics}
          loading={loading}
          syncOffsetMs={syncOffsetMs}
          accentLyrics={theme.accentLyrics}
          transformedLines={language.transformedLines}
          lyricDisplayMode={language.displayMode}
          lastArtUrl={lastArtRef.current}
          onLineTap={handleLineTap}
        />
      </div>

      <LyricsControls
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        playback={playback}
        fontScale={fontScale}
        setFontScale={setFontScale}
        globalSyncOffsetMs={globalSyncOffsetMs}
        setGlobalSyncOffsetMs={setGlobalSyncOffsetMs}
        trackSyncOffsetMs={trackSyncOffsetMs}
        setTrackSyncOffsetMs={setTrackSyncOffsetMs}
        overrideId={overrideId}
        activeLyricsId={lyrics?.providerId ?? null}
        setOverride={setOverride}
        clearOverride={clearOverride}
        language={language}
        backdrop={theme.backdrop}
        setBackdrop={theme.setBackdrop}
        accentLyrics={theme.accentLyrics}
        setAccentLyrics={theme.setAccentLyrics}
        ambientMotion={theme.ambientMotion}
        setAmbientMotion={theme.setAmbientMotion}
        canCalibrate={canCalibrate}
        onStartCalibration={() => {
          setSettingsOpen(false);
          setCalibrating(true);
        }}
      />

      {calibrating && lyrics?.lines && (
        <SyncCalibrator
          lines={lyrics.lines}
          anchor={anchor}
          onApply={(off) => {
            setTrackSyncOffsetMs(off - globalSyncOffsetMs);
            setCalibrating(false);
          }}
          onCancel={() => setCalibrating(false)}
        />
      )}

      {/* Paused indicator — lyrics stay frozen behind it (docs/10 #7). */}
      {playback?.isActive &&
        playback.type === "track" &&
        !playback.isPlaying &&
        status === "ok" && (
          <BottomPill text="Paused" />
        )}

      {showReconnectHint && <BottomPill text="Reconnecting…" tone="warn" />}

      {explainIndex !== null && lyrics?.lines[explainIndex] && (
        <ExplainSheet
          line={lyrics.lines[explainIndex].text}
          status={explanation.status === "idle" ? "loading" : explanation.status}
          explanation={explanation.explanation}
          onClose={() => {
            setExplainIndex(null);
            explanation.reset();
          }}
          onRetry={() => handleLineTap(explainIndex)}
        />
      )}
    </main>
  );
}

function CenterContent({
  status,
  playback,
  anchor,
  lyrics,
  loading,
  syncOffsetMs,
  accentLyrics,
  transformedLines,
  lyricDisplayMode,
  lastArtUrl,
  onLineTap,
}: {
  status: ReturnType<typeof usePlayback>["status"];
  playback: ReturnType<typeof usePlayback>["playback"];
  anchor: ReturnType<typeof usePlayback>["anchor"];
  lyrics: ReturnType<typeof useLyrics>["lyrics"];
  loading: boolean;
  syncOffsetMs: number;
  accentLyrics: boolean;
  transformedLines: string[] | null;
  lyricDisplayMode: ReturnType<typeof useLyricTransform>["displayMode"];
  lastArtUrl: string | null;
  onLineTap: (index: number) => void;
}) {
  if (status === "forbidden") {
    return (
      <StatusCard
        title="Access not enabled"
        subtitle="This app is in Spotify development mode and limited to 5 approved users. Ask the owner to add your Spotify email in the developer dashboard."
      />
    );
  }

  if (!playback) {
    return (
      <StatusCard
        title={status === "reconnecting" ? "Connecting…" : "Loading…"}
        subtitle="Getting your playback from Spotify."
      />
    );
  }

  if (!playback.isActive) {
    return <IdleScreen lastArtUrl={lastArtUrl} />;
  }

  if (playback.type === "ad") {
    return <StatusCard title="Ad playing…" subtitle="Lyrics resume after the ad." />;
  }

  if (playback.type === "episode") {
    return (
      <StatusCard
        title={playback.title ?? "Podcast"}
        subtitle="Lyrics are for music tracks."
        albumArtUrl={playback.albumArtUrl}
        trackArtist={playback.artists}
      />
    );
  }

  // From here: a music track.
  if (lyrics?.instrumental) {
    return (
      <StatusCard
        title="Instrumental"
        albumArtUrl={playback.albumArtUrl}
        trackTitle={playback.title}
        trackArtist={playback.artists}
      />
    );
  }

  if (lyrics?.synced && lyrics.lines.length > 0) {
    return (
      <LyricsView
        key={playback.trackId ?? lyrics.trackKey}
        lines={lyrics.lines}
        anchor={anchor}
        syncOffsetMs={syncOffsetMs}
        accentLyrics={accentLyrics}
        transformedLines={transformedLines}
        displayMode={lyricDisplayMode}
        onLineTap={onLineTap}
      />
    );
  }

  if (lyrics && !lyrics.synced && lyrics.plain) {
    return <PlainLyrics text={lyrics.plain} />;
  }

  if (lyrics?.notFound) {
    return (
      <StatusCard
        title="No synced lyrics for this song"
        albumArtUrl={playback.albumArtUrl}
        trackTitle={playback.title}
        trackArtist={playback.artists}
      />
    );
  }

  // Lyrics still loading for this track — show the now-playing card meanwhile.
  return (
    <StatusCard
      title={loading ? "Finding lyrics…" : playback.title ?? ""}
      albumArtUrl={playback.albumArtUrl}
      trackTitle={loading ? playback.title : null}
      trackArtist={playback.artists}
    />
  );
}

function BottomPill({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "neutral" | "warn";
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
      <span
        className={`rounded-full px-5 py-2 text-sm font-medium backdrop-blur ${
          tone === "warn"
            ? "bg-amber-500/15 text-amber-300"
            : "bg-white/5 text-lyric-dim"
        }`}
      >
        {text}
      </span>
    </div>
  );
}
