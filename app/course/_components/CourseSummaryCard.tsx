import Card from "@/components/Card";
import type { CourseSummary } from "../types";
import { formatSubmissionType } from "../utils";

export function CourseSummaryCard({ summary }: { summary: CourseSummary | null }) {
  return (
    <Card title="课程待办与资源" tag="进度">
      <div className="grid grid-2">
        <div className="card">
          <div className="section-title">课程模块</div>
          <div className="section-sub">共 {summary?.moduleCount ?? 0} 个模块</div>
        </div>
        <div className="card">
          <div className="section-title">课程资料</div>
          <div className="section-sub">共 {summary?.resourceCount ?? 0} 份资料</div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="section-title">近期作业</div>
        {summary?.upcomingAssignments?.length ? (
          <div className="grid" style={{ gap: 8, marginTop: 8 }}>
            {summary.upcomingAssignments.map((item) => (
              <div key={item.id} className="card">
                <div className="section-title">{item.title}</div>
                <div className="section-sub">
                  截止日期：{new Date(item.dueDate).toLocaleDateString("zh-CN")} · {formatSubmissionType(item.submissionType)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ marginTop: 6 }}>暂无待办作业。</p>
        )}
      </div>
    </Card>
  );
}
