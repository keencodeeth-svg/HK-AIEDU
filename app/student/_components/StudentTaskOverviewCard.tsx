import Card from "@/components/Card";
import type { TodayTaskPayload } from "../types";

type StudentTaskOverviewCardProps = {
  todayTasks: TodayTaskPayload | null;
  totalPlanCount: number;
  weakPlanCount: number;
  refreshing: boolean;
  onRefreshPlan: () => void;
};

export default function StudentTaskOverviewCard({
  todayTasks,
  totalPlanCount,
  weakPlanCount,
  refreshing,
  onRefreshPlan
}: StudentTaskOverviewCardProps) {
  return (
    <Card title="任务概览" tag="统计">
      <div className="grid grid-2">
        <div className="kpi">
          <div className="section-title kpi-title">必做任务</div>
          <div className="kpi-value">{todayTasks?.summary?.mustDo ?? 0}</div>
        </div>
        <div className="kpi">
          <div className="section-title kpi-title">Top3 预计时长</div>
          <div className="kpi-value">{todayTasks?.summary?.top3EstimatedMinutes ?? 0} 分钟</div>
        </div>
      </div>
      <div className="badge-row summary-badges">
        <span className="badge">逾期 {todayTasks?.summary?.overdue ?? 0}</span>
        <span className="badge">今日到期 {todayTasks?.summary?.dueToday ?? 0}</span>
        <span className="badge">计划题量 {totalPlanCount}</span>
        <span className="badge">薄弱知识点 {weakPlanCount}</span>
        <span className="badge">复练任务 {todayTasks?.summary?.bySource?.wrongReview ?? 0}</span>
      </div>
      <div className="cta-row">
        <button className="button secondary" type="button" onClick={onRefreshPlan} disabled={refreshing} aria-busy={refreshing}>
          {refreshing ? "刷新中..." : "刷新学习计划"}
        </button>
      </div>
    </Card>
  );
}
