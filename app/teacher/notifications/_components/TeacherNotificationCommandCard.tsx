import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime } from "@/lib/client-request";
import type { HistoryClassResult, HistoryResponse, PreviewData } from "../types";
import type { NotificationCommandState } from "../utils";

type TeacherNotificationCommandCardProps = {
  preview: PreviewData | null;
  historySummary: HistoryResponse["summary"] | null;
  commandState: NotificationCommandState;
  previewTargetDelta: number | null;
  latestClassResult: HistoryClassResult | null;
};

export default function TeacherNotificationCommandCard({
  preview,
  historySummary,
  commandState,
  previewTargetDelta,
  latestClassResult
}: TeacherNotificationCommandCardProps) {
  return (
    <Card title="提醒指挥台" tag="Ops">
      <div className="teacher-notification-command-grid">
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">待触达作业</div>
          <div className="workflow-summary-value">{preview?.summary.assignmentTargets ?? 0}</div>
          <div className="workflow-summary-helper">当前草稿预估会触发提醒的作业数</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">覆盖学生</div>
          <div className="workflow-summary-value">{preview?.summary.uniqueStudents ?? 0}</div>
          <div className="workflow-summary-helper">预计会被提醒到的学生人数</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">逾期优先</div>
          <div className="workflow-summary-value">{preview?.summary.overdueAssignments ?? 0}</div>
          <div className="workflow-summary-helper">需要优先处理的逾期作业数量</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">最近一次发送</div>
          <div className="workflow-summary-value">{historySummary?.totalRuns ?? 0}</div>
          <div className="workflow-summary-helper">
            {historySummary?.lastRunAt ? `最近于 ${formatLoadedTime(historySummary.lastRunAt)}` : "当前班级还没有发送历史"}
          </div>
        </div>
      </div>

      <StatePanel compact tone={commandState.tone} title={commandState.title} description={commandState.description} />

      <div className="pill-list" style={{ marginTop: 12 }}>
        <span className="pill">学生提醒 {preview?.summary.studentTargets ?? 0} 条</span>
        <span className="pill">家长提醒 {preview?.summary.parentTargets ?? 0} 条</span>
        <span className="pill">截止前提醒 {preview?.summary.dueSoonAssignments ?? 0} 份</span>
        {previewTargetDelta !== null ? (
          <span className="pill">较上次学生触达 {previewTargetDelta > 0 ? `+${previewTargetDelta}` : previewTargetDelta}</span>
        ) : null}
      </div>

      <div className="meta-text" style={{ marginTop: 12 }}>
        {latestClassResult
          ? `最近一次发送覆盖学生 ${latestClassResult.studentTargets} 条、家长 ${latestClassResult.parentTargets} 条。真正的效果，还要回提交箱和成绩册看新增提交与完成率。`
          : "发送历史会告诉你曾经发了多少，但无法替代业务结果验证。第一次发送后，记得回提交箱和成绩册验收。"}
      </div>

      <div className="cta-row" style={{ marginTop: 12 }}>
        <Link className="button secondary" href="/teacher/submissions">
          去提交箱
        </Link>
        <Link className="button secondary" href="/teacher/gradebook">
          去成绩册
        </Link>
        <Link className="button ghost" href="/teacher/analysis">
          去学情分析
        </Link>
      </div>
    </Card>
  );
}
