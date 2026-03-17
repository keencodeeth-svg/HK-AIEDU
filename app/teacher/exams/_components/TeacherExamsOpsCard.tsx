import Link from "next/link";
import Card from "@/components/Card";
import type { TeacherExamItem } from "../types";

type TeacherExamsOpsCardProps = {
  overallSummary: {
    total: number;
    published: number;
    closed: number;
    dueSoon: number;
    lowCompletion: number;
  };
  filteredSummary: {
    total: number;
    published: number;
    closed: number;
  };
  topPriorityExam: TeacherExamItem | null;
  latestCreatedExam: TeacherExamItem | null;
  classOptionsCount: number;
};

export default function TeacherExamsOpsCard({
  overallSummary,
  filteredSummary,
  topPriorityExam,
  latestCreatedExam,
  classOptionsCount
}: TeacherExamsOpsCardProps) {
  return (
    <Card title="考试管理盘面" tag="Ops">
      <div className="grid grid-2">
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">待跟进考试</div>
          <div className="workflow-summary-value">{overallSummary.published}</div>
          <div className="workflow-summary-helper">当前仍在运行、需要继续催交和看风险的考试数</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">近截止</div>
          <div className="workflow-summary-value">{overallSummary.dueSoon}</div>
          <div className="workflow-summary-helper">24 小时内到期且仍有人未提交的考试数</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">低完成率</div>
          <div className="workflow-summary-value">{overallSummary.lowCompletion}</div>
          <div className="workflow-summary-helper">完成率低于 60% 的进行中考试会被提前排序</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">已收口</div>
          <div className="workflow-summary-value">{overallSummary.closed}</div>
          <div className="workflow-summary-helper">已经关闭、适合回看成绩和卷面表现的考试数</div>
        </div>
      </div>

      <div className="pill-list" style={{ marginTop: 12 }}>
        {topPriorityExam ? <span className="pill">优先处理：{topPriorityExam.title}</span> : null}
        {latestCreatedExam ? <span className="pill">最近创建：{latestCreatedExam.title}</span> : null}
        <span className="pill">覆盖班级 {classOptionsCount} 个</span>
        <span className="pill">筛选后进行中 {filteredSummary.published}</span>
        <span className="pill">筛选后已关闭 {filteredSummary.closed}</span>
      </div>

      <div className="meta-text" style={{ marginTop: 12 }}>
        {topPriorityExam
          ? `当前最值得先点开的考试是「${topPriorityExam.title}」。先处理这场，再决定是否继续扫低完成率考试或转去创建下一轮。`
          : "当前没有进行中的考试，可以直接进入创建页，续上下一轮考试安排。"}
      </div>

      <div className="cta-row" style={{ marginTop: 12 }}>
        {topPriorityExam ? (
          <Link className="button secondary" href={`/teacher/exams/${topPriorityExam.id}`}>
            打开优先考试
          </Link>
        ) : null}
        <Link className="button ghost" href="/teacher">
          返回教师端
        </Link>
      </div>
    </Card>
  );
}
