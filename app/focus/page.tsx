"use client";

import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { useFocusPageView } from "./useFocusPageView";

export default function FocusPage() {
  const focusPage = useFocusPageView();

  if (focusPage.authRequired) {
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

      {focusPage.pageError ? (
        <StatePanel
          compact
          tone="error"
          title="本次操作失败"
          description={focusPage.pageError}
          action={
            <button
              className="button secondary"
              type="button"
              onClick={focusPage.onReloadSummary}
              disabled={focusPage.saving}
            >
              重试统计加载
            </button>
          }
        />
      ) : null}

      <Card title="番茄钟" tag={focusPage.mode === "focus" ? "专注" : "休息"}>
        <div className="feature-card">
          <EduIcon name="board" />
          <p>建议专注 25 分钟 + 休息 5 分钟，保持节奏。</p>
        </div>
        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <label>
            <div className="section-title">模式</div>
            <select
              value={focusPage.mode}
              onChange={(event) => {
                focusPage.onModeChange(event.target.value as "focus" | "break");
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
              value={focusPage.duration}
              onChange={(event) => {
                focusPage.onDurationChange(Number(event.target.value));
              }}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {focusPage.presets.map((item) => (
                <option key={item} value={item}>
                  {item} 分钟
                </option>
              ))}
            </select>
          </label>
          <div className="card" style={{ alignSelf: "end" }}>
            <div className="section-title">剩余时间</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{focusPage.remainingTimeLabel}</div>
          </div>
        </div>
        <div className="cta-row">
          <button className="button primary" onClick={focusPage.onStartTimer} disabled={focusPage.running || focusPage.saving}>
            开始计时
          </button>
          <button className="button secondary" onClick={focusPage.onStopTimer} disabled={!focusPage.running || focusPage.saving}>
            停止
          </button>
          <button
            className="button secondary"
            onClick={focusPage.onCompleteSession}
            disabled={focusPage.running || focusPage.saving}
          >
            {focusPage.saving ? "记录中..." : "手动记录完成"}
          </button>
        </div>
      </Card>

      <Card title="专注统计" tag="数据">
        <div className="grid grid-3">
          <div className="card">
            <div className="section-title">今日专注</div>
            <p>{focusPage.summaryStats.todayMinutes} 分钟</p>
          </div>
          <div className="card">
            <div className="section-title">近 7 天</div>
            <p>{focusPage.summaryStats.weekMinutes} 分钟</p>
          </div>
          <div className="card">
            <div className="section-title">连续天数</div>
            <p>{focusPage.summaryStats.streakDays} 天</p>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="badge">休息建议</div>
          <div style={{ marginTop: 6, color: "var(--ink-1)" }}>{focusPage.suggestion}</div>
        </div>
      </Card>

      <Card title="最近记录" tag="历史">
        {focusPage.hasRecentItems ? (
          <div className="grid" style={{ gap: 8 }}>
            {focusPage.recentItems.map((item) => (
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
