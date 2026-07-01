"use client";

import { useCallback, useRef, useState } from "react";

export interface LyricExplanationParams {
  trackKey: string;
  lineIndex: number;
  line: string;
  prevLine?: string;
  nextLine?: string;
  title: string;
  artist: string;
}

/**
 * Manages the loading/result state for an on-demand AI lyric-line
 * explanation. Modeled on useLyrics.ts's abort/cancel pattern, but manually
 * triggered (`explain`) rather than effect-driven off track changes.
 */
export function useLyricExplanation() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [explanation, setExplanation] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const explain = useCallback((params: LyricExplanationParams) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("loading");
    setExplanation(null);

    fetch("/api/lyrics/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { explanation: string }) => {
        if (controller.signal.aborted) return;
        setExplanation(data.explanation);
        setStatus("success");
      })
      .catch(() => {
        if (controller.signal.aborted) return; // superseded by a newer tap
        setStatus("error");
      });
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setStatus("idle");
    setExplanation(null);
  }, []);

  return { status, explanation, explain, reset };
}
