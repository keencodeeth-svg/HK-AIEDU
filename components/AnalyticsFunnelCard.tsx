"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";

type FunnelStage = {
  key: string;
  label: string;
  users: number;
  conversionFromPrevious: number;
  conversionFromFirst: number;
};

type FunnelPayload = {
  totalEvents: number;
  totalActors: number;
  stages: FunnelStage[];
};

type FunnelResponse = {
  data?: FunnelPayload;
};

function toIsoDay(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

export default function AnalyticsFunnelCard() {
  const [data, setData] = useState<FunnelPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("from", toIsoDay(-7));
    params.set("to", toIsoDay(0));
    return params.toString();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFunnel() {
      try {
        const json = await requestJson<FunnelResponse>(`/api/analytics/funnel?${query}`);
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

    void loadFunnel();

    return () => {
      cancelled = true;
    };
  }, [query]);

  if (error) {
    return <p style={{ color: "var(--ink-1)" }}>漏斗加载失败：{error}</p>;
  }

  if (!data) {
    return <p style={{ color: "var(--ink-1)" }}>漏斗加载中...</p>;
  }

  return (
    <div className="grid" style={{ gap: 10 }}>
      <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
        最近7天 · 事件 {data.totalEvents} 条 · 参与者 {data.totalActors} 人
      </div>
      {data.stages.map((stage) => (
        <div key={stage.key} className="card" style={{ padding: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{stage.label}</div>
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
              {stage.users} 人 · {stage.conversionFromPrevious}%
            </div>
          </div>
          <div style={{ marginTop: 8, height: 8, background: "rgba(30,90,122,0.08)", borderRadius: 999 }}>
            <div
              style={{
                width: `${Math.max(0, Math.min(100, stage.conversionFromFirst))}%`,
                height: 8,
                borderRadius: 999,
                background: "var(--brand-0)"
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
