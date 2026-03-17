"use client";

import { useEffect } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { getRequestStatus, requestJson } from "@/lib/client-request";

function truncateForTelemetry(value: string | undefined, maxLength: number) {
  if (!value) {
    return "";
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("dashboard route error", error);
    const payload = {
      component: "dashboard",
      pathname: truncateForTelemetry(window.location.pathname, 240),
      message: truncateForTelemetry(error.message || "dashboard route error", 400),
      stack: truncateForTelemetry(error.stack || "", 4000),
      digest: truncateForTelemetry(error.digest || "", 120)
    };
    void requestJson("/api/observability/client-error", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    }).catch((reportError) => {
      if (getRequestStatus(reportError) === 400) {
        return;
      }
      // Client error reporting must never block the fallback UI.
    });
  }, [error]);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>学习看板</h2>
          <div className="section-sub">看板刚刚加载失败，已为你保留核心入口和重试能力。</div>
        </div>
        <span className="chip">Recover</span>
      </div>

      <Card title="看板暂时不可用" tag="Error">
        <StatePanel
          tone="error"
          title="学习看板加载异常"
          description="你可以先重试；如果仍失败，也可以直接进入学生端、作业中心或收件箱继续使用。"
          action={
            <div className="cta-row no-margin" style={{ flexWrap: "wrap" }}>
              <button type="button" className="button primary" onClick={() => reset()}>
                重新加载
              </button>
              <Link className="button secondary" href="/student">
                进入学生端
              </Link>
              <Link className="button secondary" href="/student/assignments">
                作业中心
              </Link>
              <Link className="button ghost" href="/inbox">
                收件箱
              </Link>
            </div>
          }
        >
          {error.digest ? <div style={{ fontSize: 12, color: "var(--ink-1)" }}>错误编号：{error.digest}</div> : null}
        </StatePanel>
      </Card>
    </div>
  );
}
