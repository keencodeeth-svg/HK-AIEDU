"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import CalibrationPanel from "./_components/CalibrationPanel";
import EvalGatePanel from "./_components/EvalGatePanel";
import HealthProbePanel from "./_components/HealthProbePanel";
import MetricsPanel from "./_components/MetricsPanel";
import ProviderChainPanel from "./_components/ProviderChainPanel";
import TaskPoliciesPanel from "./_components/TaskPoliciesPanel";
import { useAdminAiModelsPageView } from "./useAdminAiModelsPageView";

export default function AdminAiModelsPage() {
  const aiModelsPage = useAdminAiModelsPageView();

  if (aiModelsPage.authRequired) {
    return (
      <Card title="AI 模型路由中心">
        <StatePanel
          compact
          tone="info"
          title="请先登录后进入管理端"
          description="登录管理员账号后即可管理模型链、任务策略与离线评测门禁。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (aiModelsPage.pageLoading) {
    return (
      <Card title="AI 模型路由中心">
        <StatePanel
          compact
          tone="loading"
          title="AI 模型路由中心加载中"
          description="正在同步模型链、任务策略和管理配置。"
        />
      </Card>
    );
  }

  if (aiModelsPage.pageError) {
    return (
      <Card title="AI 模型路由中心">
        <StatePanel
          compact
          tone="error"
          title="AI 模型路由中心加载失败"
          description={aiModelsPage.pageError}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={aiModelsPage.reload}>
                重试
              </button>
              <Link className="button ghost" href="/admin">
                返回管理首页
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>AI 模型路由中心</h2>
          <div className="section-sub">模型链、任务级策略、调用指标与连通性统一管理。</div>
        </div>
        <span className="chip">管理端</span>
      </div>

      {aiModelsPage.bootstrapNotice ? (
        <div className="status-note error">{aiModelsPage.bootstrapNotice}</div>
      ) : null}
      {aiModelsPage.metricsNotice ? (
        <div className="status-note error">{aiModelsPage.metricsNotice}</div>
      ) : null}
      {aiModelsPage.calibrationNotice ? (
        <div className="status-note error">{aiModelsPage.calibrationNotice}</div>
      ) : null}
      {aiModelsPage.evalGateNotice ? (
        <div className="status-note error">{aiModelsPage.evalGateNotice}</div>
      ) : null}

      <ProviderChainPanel {...aiModelsPage.providerChainPanelProps} />
      <TaskPoliciesPanel {...aiModelsPage.taskPoliciesPanelProps} />
      <HealthProbePanel {...aiModelsPage.healthProbePanelProps} />
      <CalibrationPanel {...aiModelsPage.calibrationPanelProps} />
      <EvalGatePanel {...aiModelsPage.evalGatePanelProps} />
      <MetricsPanel {...aiModelsPage.metricsPanelProps} />
      {aiModelsPage.stepUpDialog}
    </div>
  );
}
