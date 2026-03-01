"use client";

import type { MathLineMode } from "@/lib/math-view-settings";

type MathViewControlsProps = {
  fontScale: number;
  lineMode: MathLineMode;
  onDecrease: () => void;
  onIncrease: () => void;
  onReset: () => void;
  onLineModeChange: (mode: MathLineMode) => void;
};

export default function MathViewControls({
  fontScale,
  lineMode,
  onDecrease,
  onIncrease,
  onReset,
  onLineModeChange
}: MathViewControlsProps) {
  return (
    <div className="math-view-controls" role="group" aria-label="公式阅读设置">
      <div className="math-view-controls-label">公式阅读</div>
      <div className="math-view-controls-group">
        <button type="button" className="math-view-control-btn" onClick={onDecrease}>
          A-
        </button>
        <div className="math-view-control-value">{Math.round(fontScale * 100)}%</div>
        <button type="button" className="math-view-control-btn" onClick={onIncrease}>
          A+
        </button>
      </div>
      <div className="math-view-controls-group">
        <button
          type="button"
          className={`math-view-control-btn ${lineMode === "compact" ? "active" : ""}`}
          onClick={() => onLineModeChange("compact")}
        >
          紧凑
        </button>
        <button
          type="button"
          className={`math-view-control-btn ${lineMode === "comfortable" ? "active" : ""}`}
          onClick={() => onLineModeChange("comfortable")}
        >
          舒适
        </button>
      </div>
      <button type="button" className="math-view-control-btn ghost" onClick={onReset}>
        重置
      </button>
    </div>
  );
}

