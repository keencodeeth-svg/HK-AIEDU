"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { isAuthError, requestJson } from "@/lib/client-request";
import { getFocusSessionSaveRequestMessage, getFocusSummaryRequestMessage } from "./utils";

type FocusSummary = {
  summary: {
    todayMinutes: number;
    weekMinutes: number;
    focusCount: number;
    breakCount: number;
    streakDays: number;
  };
  recent: { id: string; mode: "focus" | "break"; durationMinutes: number; createdAt: string }[];
  suggestion: string;
};

export default function FocusPage() {
  const loadRequestIdRef = useRef(0);
  const hasSummarySnapshotRef = useRef(false);
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<FocusSummary | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const startedAtRef = useRef<string | null>(null);

  const resetSessionState = useCallback(() => {
    startedAtRef.current = null;
    setRunning(false);
    setSecondsLeft(0);
  }, []);

  const clearSummaryState = useCallback(() => {
    hasSummarySnapshotRef.current = false;
    setSummary(null);
  }, []);

  const clearFocusPageState = useCallback(() => {
    clearSummaryState();
    resetSessionState();
    setPageError(null);
  }, [clearSummaryState, resetSessionState]);

  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    clearFocusPageState();
    setAuthRequired(true);
  }, [clearFocusPageState]);

  const loadSummary = useCallback(async (options?: { preserveSnapshot?: boolean }) => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setPageError(null);

    try {
      const payload = await requestJson<{ data?: FocusSummary }>("/api/focus/summary");
      if (loadRequestIdRef.current !== requestId) {
        return false;
      }

      hasSummarySnapshotRef.current = true;
      setSummary(payload.data ?? null);
      setAuthRequired(false);
      return true;
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return false;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        if (!hasSummarySnapshotRef.current || options?.preserveSnapshot === false) {
          clearSummaryState();
        }
        setAuthRequired(false);
        setPageError(getFocusSummaryRequestMessage(error, "加载专注统计失败"));
      }
      return false;
    }
  }, [clearSummaryState, handleAuthRequired]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const completeSession = useCallback(async () => {
    setSaving(true);
    setPageError(null);

    try {
      await requestJson("/api/focus/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          durationMinutes: duration,
          startedAt: startedAtRef.current,
          endedAt: new Date().toISOString()
        })
      });
      resetSessionState();
      await loadSummary({ preserveSnapshot: true });
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        setPageError(getFocusSessionSaveRequestMessage(error, "记录专注时长失败"));
      }
    } finally {
      setSaving(false);
    }
  }, [duration, handleAuthRequired, loadSummary, mode, resetSessionState]);

  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setRunning(false);
          void completeSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [completeSession, running]);

  function startTimer() {
    setPageError(null);
    setSecondsLeft(duration * 60);
    setRunning(true);
    startedAtRef.current = new Date().toISOString();
  }

  function stopTimer() {
    resetSessionState();
  }

  const presets = mode === "focus" ? [15, 25, 40] : [5, 10, 15];

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可记录专注时长并查看专注统计。"
        tone="info"
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>学习时间管理</h2>
          <div className="section-sub">番茄钟专注训练 + 休息建议。</div>
        </div>
        <span className="chip">专注计时</span>
      </div>

      {pageError ? (
        <StatePanel
          compact
          tone="error"
          title="本次操作失败"
          description={pageError}
          action={
            <button className="button secondary" type="button" onClick={() => void loadSummary()} disabled={saving}>
              重试统计加载
            </button>
          }
        />
      ) : null}

      <Card title="番茄钟" tag={mode === "focus" ? "专注" : "休息"}>
        <div className="feature-card">
          <EduIcon name="board" />
          <p>建议专注 25 分钟 + 休息 5 分钟，保持节奏。</p>
        </div>
        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <label>
            <div className="section-title">模式</div>
            <select
              value={mode}
              onChange={(event) => {
                const next = event.target.value as "focus" | "break";
                setMode(next);
                setDuration(next === "focus" ? 25 : 5);
                resetSessionState();
                setPageError(null);
              }}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="focus">专注</option>
              <option value="break">休息</option>
            </select>
          </label>
          <label>
            <div className="section-title">时长（分钟）</div>
            <select
              value={duration}
              onChange={(event) => {
                setDuration(Number(event.target.value));
                resetSessionState();
                setPageError(null);
              }}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {presets.map((item) => (
                <option key={item} value={item}>
                  {item} 分钟
                </option>
              ))}
            </select>
          </label>
          <div className="card" style={{ alignSelf: "end" }}>
            <div className="section-title">剩余时间</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {secondsLeft ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : "--:--"}
            </div>
          </div>
        </div>
        <div className="cta-row">
          <button className="button primary" onClick={startTimer} disabled={running || saving}>
            开始计时
          </button>
          <button className="button secondary" onClick={stopTimer} disabled={!running || saving}>
            停止
          </button>
          <button className="button secondary" onClick={() => void completeSession()} disabled={running || saving}>
            {saving ? "记录中..." : "手动记录完成"}
          </button>
        </div>
      </Card>

      <Card title="专注统计" tag="数据">
        <div className="grid grid-3">
          <div className="card">
            <div className="section-title">今日专注</div>
            <p>{summary?.summary.todayMinutes ?? 0} 分钟</p>
          </div>
          <div className="card">
            <div className="section-title">近 7 天</div>
            <p>{summary?.summary.weekMinutes ?? 0} 分钟</p>
          </div>
          <div className="card">
            <div className="section-title">连续天数</div>
            <p>{summary?.summary.streakDays ?? 0} 天</p>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="badge">休息建议</div>
          <div style={{ marginTop: 6, color: "var(--ink-1)" }}>{summary?.suggestion ?? "保持节奏，坚持专注。"}</div>
        </div>
      </Card>

      <Card title="最近记录" tag="历史">
        {summary?.recent?.length ? (
          <div className="grid" style={{ gap: 8 }}>
            {summary.recent.map((item) => (
              <div className="card" key={item.id}>
                <div className="section-title">{item.mode === "focus" ? "专注" : "休息"}</div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  {item.durationMinutes} 分钟 · {new Date(item.createdAt).toLocaleString("zh-CN")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>暂无记录，开始第一轮专注吧。</p>
        )}
      </Card>
    </div>
  );
}
