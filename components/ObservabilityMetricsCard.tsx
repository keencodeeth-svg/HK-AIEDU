"use client";

import { useEffect, useState } from "react";
import {
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";

type RouteMetric = {
  key: string;
  method: string;
  path: string;
  requests: number;
  errors: number;
  errorRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
  lastStatus: number;
  lastSeenAt: string;
};

type Payload = {
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  p95DurationMs: number;
  avgDurationMs: number;
  window24h?: {
    requests: number;
    errors: number;
    errorRate: number;
    p95DurationMs: number;
  };
  statusBuckets?: {
    s2xx: number;
    s3xx: number;
    s4xx: number;
    s5xx: number;
  };
  routes: RouteMetric[];
};

type MetricsResponse = {
  data?: Payload;
};

export default function ObservabilityMetricsCard() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      try {
        const json = await requestJson<MetricsResponse>("/api/admin/observability/metrics?limit=8");
        if (cancelled) {
          return;
        }
        setData(json?.data ?? null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setError(
          isAuthError(error)
            ? "请先使用管理员账号登录"
            : getRequestErrorMessage(error, "加载失败")
        );
      }
    }

    void loadMetrics();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p style={{ color: "var(--ink-1)" }}>可观测性加载失败：{error}</p>;
  }

  if (!data) {
    return <p style={{ color: "var(--ink-1)" }}>可观测性加载中...</p>;
  }

  return (
    <div className="grid" style={{ gap: 10 }}>
      <div className="grid grid-3">
        <div className="card" style={{ padding: 10 }}>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>总请求</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{data.totalRequests}</div>
        </div>
        <div className="card" style={{ padding: 10 }}>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>错误率</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{data.errorRate}%</div>
        </div>
        <div className="card" style={{ padding: 10 }}>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>延迟 P95</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{data.p95DurationMs} ms</div>
        </div>
      </div>

      {data.window24h ? (
        <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
          最近24h：请求 {data.window24h.requests} · 错误率 {data.window24h.errorRate}% · P95{" "}
          {data.window24h.p95DurationMs}ms
        </div>
      ) : null}

      <div className="grid" style={{ gap: 8 }}>
        {data.routes.map((route) => (
          <div key={route.key} className="card" style={{ padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {route.method} {route.path}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                {route.requests} req · {route.errorRate}%
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
              Avg {route.avgDurationMs}ms · P95 {route.p95DurationMs}ms · Last {route.lastStatus}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
