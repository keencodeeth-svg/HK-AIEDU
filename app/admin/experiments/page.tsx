"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import {
  getRequestErrorMessage,
  getRequestStatus,
  isAuthError,
  requestJson
} from "@/lib/client-request";

type ExperimentFlag = {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout: number;
  updatedAt: string;
};

type ABVariantReport = {
  variant: "control" | "treatment";
  users: number;
  retainedUsers: number;
  retentionRate: number;
  attempts: number;
  accuracy: number;
  wrongAttemptUsers: number;
  reviewCompletedUsers: number;
  reviewCompletionRate: number;
};

type ABReport = {
  experiment: {
    key: string;
    name: string;
    enabled: boolean;
    rollout: number;
  };
  window: {
    days: number;
    from: string;
    to: string;
  };
  variants: ABVariantReport[];
  delta: {
    retentionRate: number;
    accuracy: number;
    reviewCompletionRate: number;
  };
  recommendation: {
    action: "increase" | "decrease" | "keep";
    suggestedRollout: number;
    reason: string;
  };
};

type ExperimentFlagsResponse = {
  data?: ExperimentFlag[];
};

type ExperimentABReportResponse = {
  data?: ABReport | null;
};

function getAdminExperimentsErrorMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "管理员会话已失效，请重新登录后继续操作。";
  }
  if (requestMessage === "missing key") {
    return "实验标识缺失，请刷新页面后重试。";
  }
  if (requestMessage === "missing update fields") {
    return "未检测到需要保存的灰度变更。";
  }
  return getRequestErrorMessage(error, fallback);
}

export default function AdminExperimentsPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const [flags, setFlags] = useState<ExperimentFlag[]>([]);
  const [report, setReport] = useState<ABReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [flagsPayload, reportPayload] = await Promise.all([
        requestJson<ExperimentFlagsResponse>("/api/admin/experiments/flags"),
        requestJson<ExperimentABReportResponse>(
          "/api/admin/experiments/ab-report?days=7"
        )
      ]);
      setFlags(flagsPayload.data ?? []);
      setReport(reportPayload.data ?? null);
      setAuthRequired(false);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
      }
      setError(getAdminExperimentsErrorMessage(nextError, "加载实验数据失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveFlag(flag: ExperimentFlag, patch: Partial<Pick<ExperimentFlag, "enabled" | "rollout">>) {
    setMessage(null);
    setError(null);
    const payload = {
      key: flag.key,
      enabled: patch.enabled ?? flag.enabled,
      rollout: patch.rollout ?? flag.rollout
    };
    await runWithStepUp(
      async () => {
        await requestJson("/api/admin/experiments/flags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        await load();
        setMessage("灰度开关已更新");
      },
      (error) => {
        if (isAuthError(error)) {
          setAuthRequired(true);
        }
        setError(getAdminExperimentsErrorMessage(error, "保存失败"));
      }
    );
  }

  if (authRequired) {
    return (
      <Card title="A/B 实验与灰度">
        <StatePanel
          compact
          tone="info"
          title="请先登录后进入管理端"
          description="登录管理员账号后即可查看实验数据、调整灰度比例并执行高风险变更。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>A/B 实验与灰度</h2>
          <div className="section-sub">实验开关、分组效果与发布建议。</div>
        </div>
        <span className="chip">管理端</span>
      </div>

      <Card title="灰度开关" tag="开关">
        {loading ? (
          <StatePanel compact tone="loading" title="实验数据加载中" description="正在同步灰度开关与 A/B 报告。" />
        ) : null}
        {error ? <div style={{ color: "#b42318", fontSize: 13 }}>{error}</div> : null}
        {message ? <div style={{ color: "#027a48", fontSize: 13 }}>{message}</div> : null}
        <div className="grid" style={{ gap: 10, marginTop: 8 }}>
          {flags.map((flag) => (
            <div className="card" key={flag.key}>
              <div className="section-title">{flag.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>{flag.description}</div>
              <div className="grid grid-2" style={{ marginTop: 10, alignItems: "end" }}>
                <label>
                  <div className="section-title">开关</div>
                  <select
                    value={flag.enabled ? "on" : "off"}
                    onChange={(event) => {
                      const nextEnabled = event.target.value === "on";
                      saveFlag(flag, { enabled: nextEnabled });
                    }}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                  >
                    <option value="on">开启</option>
                    <option value="off">关闭</option>
                  </select>
                </label>
                <label>
                  <div className="section-title">灰度比例（%）</div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={flag.rollout}
                    onChange={(event) => {
                      const value = Math.max(0, Math.min(100, Number(event.target.value) || 0));
                      setFlags((prev) =>
                        prev.map((item) => (item.key === flag.key ? { ...item, rollout: value } : item))
                      );
                    }}
                    onBlur={() => saveFlag(flag, { rollout: flag.rollout })}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                  />
                </label>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>
                Key: {flag.key} · 更新时间：{new Date(flag.updatedAt).toLocaleString("zh-CN")}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="A/B 结果报告" tag="报告">
        {!loading && !report ? <p>暂无报告数据。</p> : null}
        {report ? (
          <div className="grid" style={{ gap: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
              时间窗：近 {report.window.days} 天（{new Date(report.window.from).toLocaleDateString("zh-CN")} -{" "}
              {new Date(report.window.to).toLocaleDateString("zh-CN")}）
            </div>
            <div className="grid grid-2">
              {report.variants.map((item) => (
                <div className="card" key={item.variant}>
                  <div className="section-title">{item.variant === "control" ? "对照组" : "实验组"}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                    样本 {item.users} · 留存 {item.retentionRate}% · 正确率 {item.accuracy}% · 复练完成率{" "}
                    {item.reviewCompletionRate}%
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="section-title">实验组相对对照组提升</div>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                留存 {report.delta.retentionRate >= 0 ? "+" : ""}
                {report.delta.retentionRate}% · 正确率 {report.delta.accuracy >= 0 ? "+" : ""}
                {report.delta.accuracy}% · 复练完成率 {report.delta.reviewCompletionRate >= 0 ? "+" : ""}
                {report.delta.reviewCompletionRate}%
              </div>
            </div>
            <div className="card">
              <div className="section-title">发布建议</div>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                动作：{report.recommendation.action} · 建议灰度比例 {report.recommendation.suggestedRollout}%
              </div>
              <div style={{ marginTop: 6 }}>{report.recommendation.reason}</div>
            </div>
          </div>
        ) : null}
      </Card>
      {stepUpDialog}
    </div>
  );
}
