import Card from "@/components/Card";
import type { GradebookSummary } from "../types";

type GradebookSummaryCardProps = {
  summary: GradebookSummary | null;
  assignmentFilter: string;
  visibleAssignmentsCount: number;
  overdueStudentCount: number;
  followUpStudentCount: number;
  urgentAssignmentCount: number;
  onExportCsv: () => void;
  onExportExcel: () => void;
};

export default function GradebookSummaryCard({
  summary,
  assignmentFilter,
  visibleAssignmentsCount,
  overdueStudentCount,
  followUpStudentCount,
  urgentAssignmentCount,
  onExportCsv,
  onExportExcel
}: GradebookSummaryCardProps) {
  return (
    <Card title="班级收口概览" tag="Close">
      <div className="grid grid-2">
        <div className="card">
          <div className="section-title">完成率</div>
          <p>{summary?.completionRate ?? 0}%</p>
        </div>
        <div className="card">
          <div className="section-title">平均分</div>
          <p>{summary?.avgScore ?? 0}</p>
        </div>
        <div className="card">
          <div className="section-title">待跟进学生</div>
          <p>{followUpStudentCount}</p>
        </div>
        <div className="card">
          <div className="section-title">临近截止作业</div>
          <p>{urgentAssignmentCount}</p>
        </div>
      </div>
      <div className="pill-list" style={{ marginTop: 12 }}>
        <span className="pill">学生 {summary?.students ?? 0} 人</span>
        <span className="pill">作业 {summary?.assignments ?? 0} 份</span>
        <span className="pill">逾期学生 {overdueStudentCount} 人</span>
        <span className="pill">待跟进学生 {followUpStudentCount} 人</span>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-1)" }}>
        {assignmentFilter !== "all"
          ? "当前只聚焦 1 份作业，适合做定点收口。"
          : `当前默认展示最近 ${visibleAssignmentsCount} 份作业，先看最需要收口的部分。`}
      </div>
      <div className="cta-row" style={{ marginTop: 12 }}>
        <button className="button secondary" type="button" onClick={onExportCsv}>
          导出 CSV
        </button>
        <button className="button ghost" type="button" onClick={onExportExcel}>
          导出 Excel
        </button>
      </div>
    </Card>
  );
}
