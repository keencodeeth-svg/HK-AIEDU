"use client";

import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { ReportHeader } from "./_components/ReportHeader";
import { ReportOverviewCard } from "./_components/ReportOverviewCard";
import { ReportProfileHeatmapCard } from "./_components/ReportProfileHeatmapCard";
import { ReportTrendCard } from "./_components/ReportTrendCard";
import { ReportWeakPointsCard } from "./_components/ReportWeakPointsCard";
import { useReportPageView } from "./useReportPageView";

export default function ReportPage() {
  const {
    loading,
    authRequired,
    pageError,
    reportError,
    hasReportData,
    hasProfileSection,
    hasAnyData,
    headerProps,
    overviewCardProps,
    profileHeatmapCardProps,
    trendCardProps,
    weakPointsCardProps,
    reload
  } = useReportPageView();

  if (loading && !hasAnyData && !authRequired) {
    return <StatePanel title="学习报告加载中" description="正在同步近 7 天周报与知识点掌握画像。" tone="loading" />;
  }

  if (authRequired) {
    return <StatePanel title="请先登录学生账号" description="登录后即可查看近 7 天学习报告与知识点掌握画像。" tone="info" />;
  }

  if (pageError && !hasAnyData) {
    return (
      <StatePanel
        title="学习报告暂时不可用"
        description={pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={reload}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <ReportHeader {...headerProps} />

      {pageError ? (
        <StatePanel
          compact
          tone="error"
          title="本次刷新存在异常"
          description={pageError}
          action={
            <button className="button secondary" type="button" onClick={reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      {hasReportData ? (
        <>
          <ReportOverviewCard {...overviewCardProps} />
          <ReportTrendCard {...trendCardProps} />
          <ReportWeakPointsCard {...weakPointsCardProps} />
        </>
      ) : (
        <Card title="学习报告" tag="统计">
          <StatePanel
            compact
            tone={reportError ? "error" : "info"}
            title="本周周报暂不可用"
            description={reportError ?? "当前还没有可展示的近 7 天练习报告。"}
          />
        </Card>
      )}

      {hasProfileSection ? <ReportProfileHeatmapCard {...profileHeatmapCardProps} /> : null}
    </div>
  );
}
