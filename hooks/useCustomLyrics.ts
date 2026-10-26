"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { customLyrics } from "@/lib/lyrics/custom";

const KEY = "tl_custom_lyrics_v1";
interface Saved { text: string; updatedAt: number }
type SavedMap = Record<string, Saved>;

export function useCustomLyrics(trackId?: string | null, durationMs = 0) {
  const [saved, setSaved] = useState<SavedMap>({});
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      if (data && typeof data === "object" && !Array.isArray(data)) {
        setSaved(Object.fromEntries(Object.entries(data).filter(([, value]) => {
          const entry = value as Saved | null;
          return entry && typeof entry.text === "string" && entry.text.length <= 24_000 && Number.isFinite(entry.updatedAt);
        })) as SavedMap);
      }
    } catch { /* Keep automatic lyrics if stored data is unavailable. */ }
  }, []);
  const entry = trackId ? saved[trackId] : null;
  const doc = useMemo(() => {
    if (!entry || !trackId || !durationMs) return null;
    try { return customLyrics(entry.text, trackId, durationMs, entry.updatedAt); }
    catch { return null; }
  }, [entry, trackId, durationMs]);

  const persist = useCallback((next: SavedMap) => {
    try {
      const trimmed = Object.fromEntries(Object.entries(next).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 40));
      localStorage.setItem(KEY, JSON.stringify(trimmed));
      setSaved(trimmed);
      setStorageError("");
      return true;
    } catch {
      setStorageError("Could not save on this browser. Free some browser storage and try again.");
      return false;
    }
  }, []);
  const save = (text: string) => {
    if (!trackId) return false;
    const updatedAt = Date.now();
    customLyrics(text, trackId, durationMs, updatedAt);
    return persist({ ...saved, [trackId]: { text, updatedAt } });
  };
  const clear = () => {
    if (!trackId) return;
    const next = { ...saved };
    delete next[trackId];
    persist(next);
  };
  return { doc, text: entry?.text ?? "", save, clear, storageError };
}
