import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { AssignmentStudentFilter, TeacherAssignmentStudent } from "../types";
import {
  STUDENT_FILTER_LABELS,
  formatDateTime,
  getStudentPriority,
  getStudentStatusLabel,
  getStudentStatusPillClassName
} from "../utils";

type AssignmentStudentRosterCardProps = {
  assignmentId: string;
  assignmentOverdue: boolean;
  studentFilter: AssignmentStudentFilter;
  studentKeyword: string;
  hasStudentFilters: boolean;
  filteredStudents: TeacherAssignmentStudent[];
  latestCompletedStudentName: string | null;
  onStudentFilterChange: (filter: AssignmentStudentFilter) => void;
  onStudentKeywordChange: (keyword: string) => void;
  onClearStudentFilters: () => void;
};

export default function AssignmentStudentRosterCard({
  assignmentId,
  assignmentOverdue,
  studentFilter,
  studentKeyword,
  hasStudentFilters,
  filteredStudents,
  latestCompletedStudentName,
  onStudentFilterChange,
  onStudentKeywordChange,
  onClearStudentFilters
}: AssignmentStudentRosterCardProps) {
  return (
    <Card title="学生跟进明细" tag="Roster">
      <div className="grid grid-2" style={{ alignItems: "end" }}>
        <label>
          <div className="section-title">名单筛选</div>
          <select value={studentFilter} onChange={(event) => onStudentFilterChange(event.target.value as AssignmentStudentFilter)} style={{ width: "100%" }}>
            <option value="all">全部学生</option>
            <option value="pending">未完成</option>
            <option value="review">待批改</option>
            <option value="low_score">低于 60%</option>
            <option value="completed">已完成</option>
          </select>
        </label>
        <label>
          <div className="section-title">关键字</div>
          <input value={studentKeyword} onChange={(event) => onStudentKeywordChange(event.target.value)} placeholder="学生姓名 / 邮箱 / 年级" style={{ width: "100%" }} />
        </label>
      </div>

      <div className="cta-row cta-row-tight" style={{ marginTop: 12 }}>
        <button className="button ghost" type="button" onClick={onClearStudentFilters} disabled={!hasStudentFilters}>
          清空筛选
        </button>
        <a className="button secondary" href="#assignment-notify">
          去提醒面板
        </a>
      </div>

      <div className="workflow-card-meta">
        <span className="pill">当前筛选：{STUDENT_FILTER_LABELS[studentFilter]}</span>
        <span className="pill">结果 {filteredStudents.length} 人</span>
        {latestCompletedStudentName ? <span className="pill">最新完成：{latestCompletedStudentName}</span> : null}
      </div>

      <div className="meta-text" style={{ marginTop: 12 }}>
        列表默认按优先级排序：未完成 {"->"} 待批改 {"->"} 低分复盘 {"->"} 其余已完成。这样你从提交箱点进来后，不需要再自己重排。
      </div>

      {!filteredStudents.length ? (
        <StatePanel
          compact
          tone="empty"
          title="没有匹配的学生"
          description="试试放宽筛选条件，或者切回全部学生。"
          action={
            <button className="button secondary" type="button" onClick={onClearStudentFilters}>
              清空筛选
            </button>
          }
        />
      ) : (
        <div id="assignment-students" style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="gradebook-table">
            <thead>
              <tr>
                <th>学生</th>
                <th>状态</th>
                <th>当前判断</th>
                <th>得分/批改</th>
                <th>完成时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const priority = getStudentPriority(student, assignmentOverdue);
                const hasScore = student.score !== null && student.total !== null && student.total > 0;
                const needsReview = student.status === "completed" && !hasScore;
                return (
                  <tr key={student.id}>
                    <td>
                      <div>{student.name}</div>
                      <div className="workflow-summary-helper">
                        {student.email}
                        {student.grade ? ` · ${student.grade}` : ""}
                      </div>
                    </td>
                    <td>
                      <span className={getStudentStatusPillClassName(student.status, assignmentOverdue)}>
                        {getStudentStatusLabel(student.status, assignmentOverdue)}
                      </span>
                    </td>
                    <td>
                      <div>{priority.label}</div>
                      <div className="workflow-summary-helper">{priority.detail}</div>
                    </td>
                    <td>{student.status !== "completed" ? "未提交" : hasScore ? `${student.score ?? 0}/${student.total ?? 0}` : "已提交待评分"}</td>
                    <td>{student.status === "completed" ? formatDateTime(student.completedAt) : "-"}</td>
                    <td>
                      {student.status === "completed" ? (
                        <Link className="button ghost" href={`/teacher/assignments/${assignmentId}/reviews/${student.id}`}>
                          {needsReview ? "开始批改" : "进入复盘"}
                        </Link>
                      ) : (
                        <a className="button ghost" href="#assignment-notify">
                          去发提醒
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
