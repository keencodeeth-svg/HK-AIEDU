"use client";

import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { AdminRecoveryRequestsDetailCard } from "./_components/AdminRecoveryRequestsDetailCard";
import { AdminRecoveryRequestsListCard } from "./_components/AdminRecoveryRequestsListCard";
import { AdminRecoveryRequestsServiceCard } from "./_components/AdminRecoveryRequestsServiceCard";
import { useAdminRecoveryRequestsPageView } from "./useAdminRecoveryRequestsPageView";

export default function AdminRecoveryRequestsPage() {
  const recoveryPage = useAdminRecoveryRequestsPageView();

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>账号恢复工单台</h2>
          <div className="section-sub">处理忘记密码、找回账号与锁定解封请求，形成完整人工恢复闭环。</div>
        </div>
        <div className="cta-row" style={{ alignItems: "center", gap: 8 }}>
          {recoveryPage.lastLoadedAtLabel ? <span className="chip">更新于 {recoveryPage.lastLoadedAtLabel}</span> : null}
          <button className="button secondary" type="button" onClick={recoveryPage.reload} disabled={recoveryPage.refreshing}>
            {recoveryPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      <AdminRecoveryRequestsServiceCard {...recoveryPage.serviceCardProps} />

      {!recoveryPage.loading && !recoveryPage.pageError && recoveryPage.hasOverdueItems ? (
        <StatePanel
          tone="error"
          title={`当前有 ${recoveryPage.overdueCount} 条恢复工单超出 SLA`}
          description="请优先处理超时与账号锁定类工单，避免持续影响用户登录与账号找回。"
        />
      ) : !recoveryPage.loading && !recoveryPage.pageError && recoveryPage.hasPriorityQueue ? (
        <StatePanel
          tone="info"
          title={`优先队列：紧急 ${recoveryPage.urgentCount} 条，高优先 ${recoveryPage.highPriorityCount} 条`}
          description="列表已按优先级、状态与等待时长自动排序，建议从上往下处理。"
        />
      ) : null}

      {recoveryPage.pageError && recoveryPage.hasItems ? <div className="status-note error">最新刷新失败：{recoveryPage.pageError}</div> : null}

      {recoveryPage.loading && !recoveryPage.hasItems ? (
        <StatePanel title="恢复工单加载中" description="正在同步最近的账号恢复请求与处理状态。" tone="loading" />
      ) : null}

      {!recoveryPage.loading && recoveryPage.pageError && !recoveryPage.hasItems ? (
        <StatePanel
          title={recoveryPage.authRequired ? "暂无权限查看工单台" : "恢复工单加载失败"}
          description={recoveryPage.pageError}
          tone="error"
          action={
            <button className="button secondary" type="button" onClick={recoveryPage.loadInitial}>
              重新加载
            </button>
          }
        />
      ) : null}

      {!recoveryPage.loading && !recoveryPage.pageError ? (
        <div className="grid" style={{ gap: 18, gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)" }}>
          <AdminRecoveryRequestsListCard {...recoveryPage.listCardProps} />
          <AdminRecoveryRequestsDetailCard {...recoveryPage.detailCardProps} />
        </div>
      ) : null}
      {recoveryPage.stepUpDialog}
    </div>
  );
}
