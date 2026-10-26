"use client";

import { useMemo, useState } from "react";
import type { PlaybackAnchor } from "@/hooks/usePlayback";
import type { LyricLine } from "@/lib/types";
import { customLyrics, toLrc } from "@/lib/lyrics/custom";

export default function CustomLyricsEditor({ initialText, trackId, title, durationMs, anchor, onSave, onClose, storageError }: {
  initialText: string; trackId: string; title: string; durationMs: number;
  anchor: PlaybackAnchor | null; onSave: (text: string) => boolean;
  onClose: () => void; storageError: string;
}) {
  const [text, setText] = useState(initialText);
  const [timing, setTiming] = useState(false);
  const [stamps, setStamps] = useState<LyricLine[]>([]);
  const [error, setError] = useState("");
  const rows = useMemo(() => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean), [text]);
  const save = (value: string) => {
    try {
      customLyrics(value, trackId, durationMs, Date.now());
      if (onSave(value)) onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save lyrics."); }
  };
  const tap = () => {
    if (!anchor?.isPlaying || stamps.length >= rows.length) return;
    const tMs = Math.round(anchor.progressMs + performance.now() - anchor.receivedAt);
    if (tMs < 0 || tMs > durationMs || (stamps.length && tMs <= stamps[stamps.length - 1].tMs + 100)) {
      setError("Keep playback moving forward. Undo a tap or restart timing after seeking.");
      return;
    }
    setError("");
    setStamps((previous) => [...previous, { tMs, text: rows[previous.length] }]);
  };
  return (
    <section role="dialog" aria-modal="true" aria-label="Add or time lyrics" className="absolute inset-0 z-40 overflow-y-auto bg-ink-950/95 px-[7vw] py-8 backdrop-blur">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold">{timing ? "Tap each line as it starts" : "Add or time lyrics"}</h2>
          <button onClick={onClose} className="min-h-16 rounded-full bg-white/10 px-6">Close</button>
        </div>
        <p className="mt-2 text-lyric-dim">{title} · Saved for this recording on this browser.</p>
        {!timing ? <>
          <p className="my-4 text-lyric-dim">Paste Telugu or romanized lyrics, or import an LRC file with timestamps. Plain text can be timed by tapping along to the song.</p>
          <label className="mb-4 block">Import .lrc or .txt
            <input type="file" accept=".lrc,.txt,text/plain" className="ml-4" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 100_000) { setError("Choose a file smaller than 100 KB."); return; }
              try { setText(await file.text()); setError(""); } catch { setError("Could not read this file."); }
            }} />
          </label>
          <textarea aria-label="Lyrics text or LRC" value={text} onChange={(event) => setText(event.target.value)} maxLength={24_000} rows={10} className="w-full rounded-2xl bg-ink-800 p-4 text-lg" placeholder="Paste lyrics here…" />
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => save(text)} disabled={!text.trim()} className="min-h-16 rounded-full bg-white px-6 font-semibold text-black disabled:opacity-40">Save lyrics</button>
            <button onClick={() => {
              try {
                const doc = customLyrics(text, trackId, durationMs, Date.now());
                if (doc.synced) { setError("These lyrics already have timestamps. Save them directly."); return; }
                setError(""); setStamps([]); setTiming(true);
              } catch (failure) { setError((failure as Error).message); }
            }} disabled={!text.trim()} className="min-h-16 rounded-full bg-white/10 px-6 disabled:opacity-40">Time these lyrics</button>
          </div>
        </> : <>
          <p className="my-5 text-lyric-dim">Start the song from the beginning in Spotify, then tap when each displayed line begins. Pause or undo whenever needed.</p>
          <p className="text-lyric-dim">{stamps.length} / {rows.length} lines timed</p>
          <button onClick={tap} disabled={!anchor?.isPlaying || stamps.length >= rows.length} className="my-5 min-h-40 w-full rounded-3xl bg-white p-6 text-3xl font-semibold text-black disabled:opacity-40">
            {rows[stamps.length] ?? "All lines timed"}
          </button>
          {!anchor?.isPlaying && <p role="status">Play the song in Spotify to record a timestamp.</p>}
          <p className="mb-5 text-lyric-dim">Next: {rows[stamps.length + 1] ?? "End"}</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setStamps((previous) => previous.slice(0, -1))} disabled={!stamps.length} className="min-h-16 rounded-full bg-white/10 px-6 disabled:opacity-40">Undo last tap</button>
            <button onClick={() => { setTiming(false); setStamps([]); }} className="min-h-16 rounded-full bg-white/10 px-6">Edit text / restart</button>
            <button onClick={() => save(toLrc(stamps))} disabled={stamps.length !== rows.length} className="min-h-16 rounded-full bg-white px-6 text-black disabled:opacity-40">Save synced lyrics</button>
          </div>
        </>}
        {(error || storageError) && <p role="alert" className="mt-4 text-amber-300">{error || storageError}</p>}
      </div>
    </section>
  );
}
