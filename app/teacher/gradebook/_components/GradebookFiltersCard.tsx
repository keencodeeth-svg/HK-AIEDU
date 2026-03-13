import Link from "next/link";
import Card from "@/components/Card";
import { SUBJECT_LABELS } from "@/lib/constants";
import type {
  GradebookAssignment,
  GradebookClass,
  GradebookStatusFilter,
  GradebookViewMode
} from "../types";

type GradebookFiltersCardProps = {
  classes: GradebookClass[];
  assignments: GradebookAssignment[];
  classId: string;
  viewMode: GradebookViewMode;
  assignmentFilter: string;
  studentKeyword: string;
  statusFilter: GradebookStatusFilter;
  error: string | null;
  onClassChange: (value: string) => void;
  onViewModeChange: (value: GradebookViewMode) => void;
  onAssignmentFilterChange: (value: string) => void;
  onStudentKeywordChange: (value: string) => void;
  onStatusFilterChange: (value: GradebookStatusFilter) => void;
};

export default function GradebookFiltersCard({
  classes,
  assignments,
  classId,
  viewMode,
  assignmentFilter,
  studentKeyword,
  statusFilter,
  error,
  onClassChange,
  onViewModeChange,
  onAssignmentFilterChange,
  onStudentKeywordChange,
  onStatusFilterChange
}: GradebookFiltersCardProps) {
  return (
    <Card title="班级与视图筛选" tag="Scope">
      <div className="grid grid-2" style={{ alignItems: "end" }}>
        <label>
          <div className="section-title">选择班级</div>
          <select
            value={classId}
            onChange={(event) => onClassChange(event.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          >
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name} · {SUBJECT_LABELS[klass.subject] ?? klass.subject} · {klass.grade} 年级
              </option>
            ))}
          </select>
        </label>
        <div className="card" style={{ alignSelf: "stretch" }}>
          <div className="section-title">快速入口</div>
          <div className="cta-row" style={{ marginTop: 10 }}>
            <Link className="button secondary" href="/teacher">
              教师工作台
            </Link>
            <Link className="button ghost" href="/teacher/analysis">
              学情分析
            </Link>
          </div>
        </div>
      </div>
      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <label>
          <div className="section-title">视图</div>
          <select
            value={viewMode}
            onChange={(event) => onViewModeChange(event.target.value as GradebookViewMode)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          >
            <option value="student">按学生</option>
            <option value="assignment">按作业</option>
          </select>
        </label>
        <label>
          <div className="section-title">作业筛选</div>
          <select
            value={assignmentFilter}
            onChange={(event) => onAssignmentFilterChange(event.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          >
            <option value="all">全部作业</option>
            {assignments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">学生筛选</div>
          <input
            value={studentKeyword}
            onChange={(event) => onStudentKeywordChange(event.target.value)}
            placeholder="姓名/邮箱"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          />
        </label>
        <label>
          <div className="section-title">状态筛选</div>
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as GradebookStatusFilter)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          >
            <option value="all">全部</option>
            <option value="pending">有待交</option>
            <option value="overdue">有逾期</option>
            <option value="completed">全部完成</option>
          </select>
        </label>
      </div>
      <div className="meta-text" style={{ marginTop: 12 }}>
        先缩小到一个班，再决定按学生收口还是按作业收口。这样最容易快速定位今天真正需要跟进的人和任务。
      </div>
      {error ? <div style={{ marginTop: 10, color: "#b42318", fontSize: 13 }}>{error}</div> : null}
    </Card>
  );
}
