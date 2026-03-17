import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { ASSIGNMENT_TYPE_LABELS, SUBJECT_LABELS } from "@/lib/constants";
import type { SubmissionRow } from "../types";
import {
  getSubmissionStatusLabel,
  getSubmissionStatusPillClassName
} from "../utils";

type SubmissionSummary = {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
};

type TeacherSubmissionsInboxCardProps = {
  loading: boolean;
  error: string | null;
  pageReady: boolean;
  rows: SubmissionRow[];
  filtered: SubmissionRow[];
  filteredSummary: SubmissionSummary;
  onReload: () => void;
  onClearFilters: () => void;
};

export default function TeacherSubmissionsInboxCard({
  loading,
  error,
  pageReady,
  rows,
  filtered,
  filteredSummary,
  onReload,
  onClearFilters
}: TeacherSubmissionsInboxCardProps) {
  return (
    <Card title="提交跟进明细" tag="Inbox">
      {loading && !rows.length ? (
        <StatePanel
          compact
          tone="loading"
          title="提交记录加载中"
          description="正在同步各班级学生的提交进度与批改数据。"
        />
      ) : error && !pageReady ? (
        <StatePanel
          compact
          tone="error"
          title="提交箱加载失败"
          description={error}
          action={
            <button className="button secondary" type="button" onClick={onReload}>
              重新加载
            </button>
          }
        />
      ) : !rows.length ? (
        <StatePanel
          compact
          tone="empty"
          title="当前还没有可追踪的提交"
          description="先去教师端发布作业，提交箱会自动沉淀待交、逾期和已交学生名单。"
          action={
            <Link className="button secondary" href="/teacher">
              去教师端工作台
            </Link>
          }
        />
      ) : !filtered.length ? (
        <StatePanel
          compact
          tone="empty"
          title="没有匹配的提交记录"
          description="试试清空筛选条件，或者换个关键词重新搜索。"
          action={
            <button className="button secondary" type="button" onClick={onClearFilters}>
              清空筛选
            </button>
          }
        />
      ) : (
        <>
          <div className="workflow-card-meta">
            <span className="pill">已提交 {filteredSummary.completed}</span>
            <span className="pill">待提交 {filteredSummary.pending}</span>
            <span className="pill">已逾期 {filteredSummary.overdue}</span>
          </div>
          <div className="meta-text" style={{ marginTop: 12 }}>
            表格已默认按优先级排序：先逾期、再待交、最后已提交。这样不需要你自己在列表里重新筛最先该处理的记录。
          </div>
          <div id="submission-list" style={{ overflowX: "auto" }}>
            <table className="gradebook-table">
              <thead>
                <tr>
                  <th>学生</th>
                  <th>班级</th>
                  <th>作业</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>得分</th>
                  <th>提交时间</th>
                  <th>截止日期</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={`${row.assignmentId}-${row.studentId}`}>
                    <td>
                      <div>{row.studentName}</div>
                      <div className="workflow-summary-helper">{row.studentEmail}</div>
                    </td>
                    <td>
                      <div>{row.className}</div>
                      <div className="workflow-summary-helper">
                        {SUBJECT_LABELS[row.subject] ?? row.subject} · {row.grade} 年级
                      </div>
                    </td>
                    <td>{row.assignmentTitle}</td>
                    <td>
                      {ASSIGNMENT_TYPE_LABELS[row.submissionType as "quiz"] ?? row.submissionType}
                      {row.uploadCount ? <div className="workflow-summary-helper">上传 {row.uploadCount} 个文件</div> : null}
                    </td>
                    <td>
                      <span className={getSubmissionStatusPillClassName(row.status)}>{getSubmissionStatusLabel(row.status)}</span>
                    </td>
                    <td>
                      {row.status === "completed" && row.total !== null
                        ? `${row.score ?? 0}/${row.total ?? 0}`
                        : row.status === "completed"
                          ? "已交"
                          : "-"}
                    </td>
                    <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString("zh-CN") : "-"}</td>
                    <td>{new Date(row.dueDate).toLocaleDateString("zh-CN")}</td>
                    <td>
                      {row.status === "completed" ? (
                        <Link className="button ghost" href={`/teacher/assignments/${row.assignmentId}/reviews/${row.studentId}`}>
                          查看/批改
                        </Link>
                      ) : (
                        <Link className="button ghost" href={`/teacher/assignments/${row.assignmentId}`}>
                          查看作业
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
