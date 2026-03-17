import Card from "@/components/Card";
import type { WeeklyReportStats } from "../types";

export function ReportOverviewCard({
  stats,
  previousStats
}: {
  stats: WeeklyReportStats | null;
  previousStats: WeeklyReportStats | null;
}) {
  return (
    <Card title="学习报告" tag="统计">
      <div className="grid grid-2">
        <div className="card">
          <div className="section-title">本周练习题量</div>
          <p>{stats?.total ?? 0} 题</p>
        </div>
        <div className="card">
          <div className="section-title">正确率</div>
          <p>{stats?.accuracy ?? 0}%</p>
        </div>
      </div>
      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <div className="card">
          <div className="section-title">上周练习题量</div>
          <p>{previousStats?.total ?? 0} 题</p>
        </div>
        <div className="card">
          <div className="section-title">上周正确率</div>
          <p>{previousStats?.accuracy ?? 0}%</p>
        </div>
      </div>
    </Card>
  );
}
