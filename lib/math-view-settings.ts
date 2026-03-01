"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

export type MathLineMode = "compact" | "comfortable";

type MathViewStyle = CSSProperties & Record<`--${string}`, string>;

const MIN_FONT_SCALE = 0.9;
const MAX_FONT_SCALE = 1.2;
const FONT_STEP = 0.05;

function clampScale(value: number) {
  if (Number.isNaN(value)) return 1;
  return Math.max(MIN_FONT_SCALE, Math.min(MAX_FONT_SCALE, value));
}

export function useMathViewSettings(storageKey: string) {
  const [fontScale, setFontScale] = useState(1);
  const [lineMode, setLineMode] = useState<MathLineMode>("comfortable");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(`math-view:${storageKey}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { fontScale?: number; lineMode?: MathLineMode };
      if (typeof parsed.fontScale === "number") {
        setFontScale(clampScale(parsed.fontScale));
      }
      if (parsed.lineMode === "compact" || parsed.lineMode === "comfortable") {
        setLineMode(parsed.lineMode);
      }
    } catch {
      // ignore malformed localStorage payload
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      `math-view:${storageKey}`,
      JSON.stringify({ fontScale, lineMode })
    );
  }, [fontScale, lineMode, storageKey]);

  const style = useMemo(
    () =>
      ({
        "--math-scale": String(fontScale),
        "--math-line-height": lineMode === "compact" ? "1.6" : "1.9"
      }) as MathViewStyle,
    [fontScale, lineMode]
  );

  return {
    fontScale,
    lineMode,
    style,
    setLineMode,
    decreaseFontScale: () => setFontScale((prev) => clampScale(prev - FONT_STEP)),
    increaseFontScale: () => setFontScale((prev) => clampScale(prev + FONT_STEP)),
    resetView: () => {
      setFontScale(1);
      setLineMode("comfortable");
    }
  };
}

