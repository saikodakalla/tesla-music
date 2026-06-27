"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayback } from "@/hooks/usePlayback";
import { useLyrics } from "@/hooks/useLyrics";
import LyricsView from "./LyricsView";
import PlainLyrics from "./PlainLyrics";
import StatusCard from "./StatusCard";
import TopBar from "./TopBar";

const UI_IDLE_MS = 4500; // hide chrome + cursor after this much inactivity

export default function Player() {
  const router = useRouter();
  const { playback, anchor, status, outageMs } = usePlayback();
  const { lyrics, loading } = useLyrics(playback);

  const [uiVisible, setUiVisible] = useState(true);
  const [dimmed, setDimmed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session ended server-side → re-render the home route to show the login.
  useEffect(() => {
    if (status === "reauth") router.refresh();
  }, [status, router]);

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
    >
      <TopBar
        playback={playback}
        visible={uiVisible}
        dimmed={dimmed}
        onToggleDim={() => {
          setDimmed((d) => !d);
          poke();
        }}
        onToggleFullscreen={toggleFullscreen}
        reconnecting={reconnecting}
      />

      <div
        className="h-full w-full transition-[filter] duration-500"
        style={{ filter: dimmed ? "brightness(0.55)" : "none" }}
      >
        <CenterContent
          status={status}
          playback={playback}
          anchor={anchor}
          lyrics={lyrics}
          loading={loading}
        />
      </div>

      {/* Paused indicator — lyrics stay frozen behind it (docs/10 #7). */}
      {playback?.isActive &&
        playback.type === "track" &&
        !playback.isPlaying &&
        status === "ok" && (
          <BottomPill text="Paused" />
        )}

      {showReconnectHint && <BottomPill text="Reconnecting…" tone="warn" />}
    </main>
  );
}

function CenterContent({
  status,
  playback,
  anchor,
  lyrics,
  loading,
}: {
  status: ReturnType<typeof usePlayback>["status"];
  playback: ReturnType<typeof usePlayback>["playback"];
  anchor: ReturnType<typeof usePlayback>["anchor"];
  lyrics: ReturnType<typeof useLyrics>["lyrics"];
  loading: boolean;
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
    return (
      <StatusCard
        title="Nothing playing"
        subtitle="Start a song in the Spotify app on your Tesla and the lyrics will appear here."
      />
    );
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
    return <LyricsView lines={lyrics.lines} anchor={anchor} />;
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
