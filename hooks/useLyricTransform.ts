"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LyricLine } from "@/lib/types";

export type LyricTransformKind = "translation" | "romanization";
export type LyricDisplayMode = "original" | "both" | "transformed";

const KIND_KEY = "tl_transform_kind";
const LANGUAGE_KEY = "tl_transform_language";
const DISPLAY_KEY = "tl_transform_display";

export const LANGUAGE_OPTIONS = [
  "English",
  "French",
  "Spanish",
  "German",
  "Japanese",
  "Korean",
] as const;

export interface UseLyricTransformResult {
  kind: LyricTransformKind;
  setKind: (kind: LyricTransformKind) => void;
  targetLanguage: string;
  setTargetLanguage: (language: string) => void;
  displayMode: LyricDisplayMode;
  setDisplayMode: (mode: LyricDisplayMode) => void;
  transformedLines: string[] | null;
  status: "idle" | "loading" | "success" | "error";
  canTransform: boolean;
  generate: () => void;
}

export function useLyricTransform({
  trackKey,
  title,
  artist,
  lines,
}: {
  trackKey?: string | null;
  title?: string | null;
  artist?: string | null;
  lines?: LyricLine[] | null;
}): UseLyricTransformResult {
  const [kind, setKindState] = useState<LyricTransformKind>("translation");
  const [targetLanguage, setTargetLanguageState] = useState("English");
  const [displayMode, setDisplayModeState] = useState<LyricDisplayMode>("both");
  const [transformedLines, setTransformedLines] = useState<string[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const storedKind = localStorage.getItem(KIND_KEY);
      if (storedKind === "translation" || storedKind === "romanization") {
        setKindState(storedKind);
      }
      const storedLanguage = localStorage.getItem(LANGUAGE_KEY);
      if (storedLanguage) setTargetLanguageState(storedLanguage);
      const storedDisplay = localStorage.getItem(DISPLAY_KEY);
      if (
        storedDisplay === "original" ||
        storedDisplay === "both" ||
        storedDisplay === "transformed"
      ) {
        setDisplayModeState(storedDisplay);
      }
    } catch {
      /* Keep defaults when storage is unavailable. */
    }
  }, []);

  useEffect(() => {
    controllerRef.current?.abort();
    setTransformedLines(null);
    setStatus("idle");
  }, [trackKey, kind, targetLanguage]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const persist = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Ignore storage failures. */
    }
  };

  const setKind = useCallback((value: LyricTransformKind) => {
    setKindState(value);
    persist(KIND_KEY, value);
  }, []);
  const setTargetLanguage = useCallback((value: string) => {
    setTargetLanguageState(value);
    persist(LANGUAGE_KEY, value);
  }, []);
  const setDisplayMode = useCallback((value: LyricDisplayMode) => {
    setDisplayModeState(value);
    persist(DISPLAY_KEY, value);
  }, []);

  const canTransform = !!trackKey && !!title && !!artist && !!lines?.length;
  const generate = useCallback(() => {
    if (!trackKey || !title || !artist || !lines?.length) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("loading");

    fetch("/api/lyrics/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackKey,
        title,
        artist,
        kind,
        targetLanguage,
        lines: lines.map((line) => line.text),
      }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { lines: string[] }) => {
        setTransformedLines(data.lines);
        setStatus("success");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
  }, [artist, kind, lines, targetLanguage, title, trackKey]);

  return {
    kind,
    setKind,
    targetLanguage,
    setTargetLanguage,
    displayMode,
    setDisplayMode,
    transformedLines,
    status,
    canTransform,
    generate,
  };
}
