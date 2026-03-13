"use client";

import { useEffect, useState } from "react";

type Alert = {
  id: string;
  title: string;
  severity: "medium" | "high" | "critical";
  message: string;
  focusLabel?: string;
  currentValue: number;
  warnThreshold: number;
  criticalThreshold: number;
  unit: "%" | "ms" | "count";
};

type Payload = {
  overallStatus: "healthy" | "degraded" | "critical";
  summary: {
    totalChecks: number;
    healthyChecks: number;
    suppressedChecks: number;
    openAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    mediumAlerts: number;
  };
  alerts: Alert[];
};

const severityLabelMap: Record<Alert["severity"], string> = {
  medium: "中",
  high: "高",
  critical: "严重"
};

const overallStatusLabelMap: Record<Payload["overallStatus"], string> = {
  healthy: "健康",
  degraded: "降级",
  critical: "严重"
};

const severityStyleMap: Record<Alert["severity"], { color: string; background: string }> = {
  medium: {
    color: "#7a5b00",
    background: "rgba(255, 216, 135, 0.3)"
  },
  high: {
    color: "#8c4f20",
    background: "rgba(234, 139, 89, 0.22)"
  },
  critical: {
    color: "#8b2f2f",
    background: "rgba(199, 84, 80, 0.18)"
  }
};

const overallStatusStyleMap: Record<Payload["overallStatus"], { color: string; background: string }> = {
  healthy: {
    color: "#285f53",
    background: "rgba(145, 216, 200, 0.26)"
  },
  degraded: {
    color: "#8c4f20",
    background: "rgba(234, 139, 89, 0.22)"
  },
  critical: {
    color: "#8b2f2f",
    background: "rgba(199, 84, 80, 0.18)"
  }
};

function formatThreshold(alert: Alert) {
  return alert.severity === "critical" ? alert.criticalThreshold : alert.warnThreshold;
}

export default function ObservabilityAlertsCard() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/observability/alerts", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "加载失败");
        }
        return json;
      })
      .then((json) => {
        setData(json?.data ?? null);
      })
      .catch((err) => {
        setError((err as Error).message);
      });
  }, []);

  if (error) {
    return <p style={{ color: "var(--ink-1)" }}>观测告警加载失败：{error}</p>;
  }

  if (!data) {
    return <p style={{ color: "var(--ink-1)" }}>观测告警加载中...</p>;
  }

  const overallStyle = overallStatusStyleMap[data.overallStatus];

  return (
    <div className="grid" style={{ gap: 10 }}>
      <div className="grid grid-3">
        <div className="card" style={{ padding: 10 }}>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>打开告警</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{data.summary.openAlerts}</div>
        </div>
        <div className="card" style={{ padding: 10 }}>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>整体状态</div>
          <div
            style={{
              display: "inline-flex",
              marginTop: 6,
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              color: overallStyle.color,
              background: overallStyle.background
            }}
          >
            {overallStatusLabelMap[data.overallStatus]}
          </div>
        </div>
        <div className="card" style={{ padding: 10 }}>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>健康 / 样本不足</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {data.summary.healthyChecks} / {data.summary.suppressedChecks}
          </div>
        </div>
      </div>

      {data.alerts.length ? (
        <div className="grid" style={{ gap: 8 }}>
          {data.alerts.slice(0, 3).map((alert) => {
            const severityStyle = severityStyleMap[alert.severity];
            return (
              <div key={alert.id} className="card" style={{ padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{alert.title}</div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: severityStyle.color,
                      background: severityStyle.background
                    }}
                  >
                    {severityLabelMap[alert.severity]}
                  </span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)", lineHeight: 1.5 }}>{alert.message}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                  {alert.focusLabel ? `${alert.focusLabel} · ` : ""}
                  当前 {alert.currentValue}
                  {alert.unit} / 阈值 {formatThreshold(alert)}
                  {alert.unit}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ color: "var(--ink-1)", fontSize: 12 }}>
          当前无超阈值告警，已通过 {data.summary.healthyChecks} 项检查。
          {data.summary.suppressedChecks > 0 ? ` 另有 ${data.summary.suppressedChecks} 项因样本不足暂不告警。` : ""}
        </p>
      )}
    </div>
  );
}

