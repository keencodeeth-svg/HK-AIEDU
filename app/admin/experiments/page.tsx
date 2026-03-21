"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { useAdminExperimentsPageView } from "./useAdminExperimentsPageView";

export default function AdminExperimentsPage() {
  const experimentsPage = useAdminExperimentsPageView();

  if (experimentsPage.authRequired) {
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
        {experimentsPage.loading ? (
          <StatePanel compact tone="loading" title="实验数据加载中" description="正在同步灰度开关与 A/B 报告。" />
        ) : null}
        {experimentsPage.error ? <div style={{ color: "#b42318", fontSize: 13 }}>{experimentsPage.error}</div> : null}
        {experimentsPage.message ? <div style={{ color: "#027a48", fontSize: 13 }}>{experimentsPage.message}</div> : null}
        <div className="grid" style={{ gap: 10, marginTop: 8 }}>
          {experimentsPage.flags.map((flag) => (
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
                      experimentsPage.onSaveFlag(flag.key, { enabled: nextEnabled });
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
                      experimentsPage.onFlagRolloutChange(flag.key, Number(event.target.value) || 0);
                    }}
                    onBlur={(event) => {
                      experimentsPage.onSaveFlag(flag.key, {
                        rollout: Number(event.currentTarget.value) || 0
                      });
                    }}
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
        {!experimentsPage.loading && !experimentsPage.report ? <p>暂无报告数据。</p> : null}
        {experimentsPage.report ? (
          <div className="grid" style={{ gap: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
              时间窗：{experimentsPage.reportWindowLabel}
            </div>
            <div className="grid grid-2">
              {experimentsPage.report.variants.map((item) => (
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
                留存 {experimentsPage.report.delta.retentionRate >= 0 ? "+" : ""}
                {experimentsPage.report.delta.retentionRate}% · 正确率 {experimentsPage.report.delta.accuracy >= 0 ? "+" : ""}
                {experimentsPage.report.delta.accuracy}% · 复练完成率 {experimentsPage.report.delta.reviewCompletionRate >= 0 ? "+" : ""}
                {experimentsPage.report.delta.reviewCompletionRate}%
              </div>
            </div>
            <div className="card">
              <div className="section-title">发布建议</div>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                动作：{experimentsPage.report.recommendation.action} · 建议灰度比例 {experimentsPage.report.recommendation.suggestedRollout}%
              </div>
              <div style={{ marginTop: 6 }}>{experimentsPage.report.recommendation.reason}</div>
            </div>
          </div>
        ) : null}
      </Card>
      {experimentsPage.stepUpDialog}
    </div>
  );
}
