"use client";

import { useEffect, useState } from "react";

type DensityMode = "comfortable" | "compact";

const STORAGE_KEY = "hk_ai_ui_density";

function readStoredMode(): DensityMode {
  if (typeof window === "undefined") return "comfortable";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "compact" ? "compact" : "comfortable";
}

export default function DensityToggle() {
  const [mode, setMode] = useState<DensityMode>("comfortable");

  useEffect(() => {
    setMode(readStoredMode());
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-density", mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
  }, [mode]);

  return (
    <button
      className="button ghost"
      type="button"
      onClick={() => setMode((prev) => (prev === "compact" ? "comfortable" : "compact"))}
      style={{ padding: "6px 12px", fontSize: 12 }}
      title={mode === "compact" ? "当前：紧凑模式" : "当前：舒适模式"}
    >
      密度：{mode === "compact" ? "紧凑" : "舒适"}
    </button>
  );
}
