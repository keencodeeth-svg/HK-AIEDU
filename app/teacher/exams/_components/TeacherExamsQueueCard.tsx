import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS, getGradeLabel } from "@/lib/constants";
import type { TeacherExamItem } from "../types";
import {
  formatDateTime,
  getDueRelativeLabel,
  getPublishModeLabel,
  getPriorityLabel,
  getRecommendedAction,
  getSubmissionRate,
  STATUS_LABELS
} from "../utils";

type TeacherExamsQueueCardProps = {
  list: TeacherExamItem[];
  filtered: TeacherExamItem[];
  topPriorityExam: TeacherExamItem | null;
  now: number;
  onClearFilters: () => void;
};

export default function TeacherExamsQueueCard({
  list,
  filtered,
  topPriorityExam,
  now,
  onClearFilters
}: TeacherExamsQueueCardProps) {
  return (
    <Card title="考试优先队列" tag="Queue">
      <div className="teacher-exams-list" id="exam-management-list">
        {list.length === 0 ? (
          <StatePanel
            compact
            tone="empty"
            title="当前还没有发布过考试"
            description="创建第一场考试后，这里会自动把进行中考试按优先级排好。"
            action={
              <Link className="button primary" href="/teacher/exams/create">
                创建第一场考试
              </Link>
            }
          />
        ) : filtered.length === 0 ? (
          <StatePanel
            compact
            tone="empty"
            title="当前筛选条件下没有考试"
            description="可以清空筛选查看全盘，或直接创建下一场考试。"
            action={
              <div className="cta-row cta-row-tight no-margin">
                <button className="button secondary" type="button" onClick={onClearFilters}>
                  清空筛选
                </button>
                <Link className="button primary" href="/teacher/exams/create">
                  发布新考试
                </Link>
              </div>
            }
          />
        ) : (
          filtered.map((item) => {
            const submissionRate = getSubmissionRate(item);
            const pendingCount = Math.max(0, item.assignedCount - item.submittedCount);
            const isPriority = topPriorityExam?.id === item.id && item.status === "published";
            const priorityLabel = getPriorityLabel(item, now);

            return (
              <div className={`teacher-exams-item${isPriority ? " priority" : ""}`} key={item.id}>
                <div className="teacher-exams-item-header">
                  <div>
                    <div className="teacher-exams-item-kicker">{priorityLabel}</div>
                    <div className="teacher-exams-item-title">{item.title}</div>
                    <div className="meta-text">
                      {item.className} · {SUBJECT_LABELS[item.classSubject] ?? item.classSubject} · {getGradeLabel(item.classGrade)}
                    </div>
                  </div>
                  <div className="teacher-exams-item-badges">
                    <span className={`teacher-exams-status-pill ${item.status === "published" ? "active" : "closed"}`}>
                      {item.status === "published" ? "进行中" : "已关闭"}
                    </span>
                    {isPriority ? <span className="teacher-exams-status-pill priority">今日优先</span> : null}
                  </div>
                </div>

                <div className="teacher-exams-item-progress">
                  <div className="teacher-exams-item-progress-head">
                    <span>提交进度</span>
                    <strong>
                      {item.submittedCount}/{item.assignedCount} · {submissionRate}%
                    </strong>
                  </div>
                  <div className="teacher-exams-item-progress-track" aria-hidden="true">
                    <div className="teacher-exams-item-progress-fill" style={{ width: `${Math.min(submissionRate, 100)}%` }} />
                  </div>
                  <div className="meta-text">
                    {item.status === "published" ? `待提交 ${pendingCount} 人` : "已完成收口"} · 截止 {formatDateTime(item.endAt)} · {getDueRelativeLabel(item.endAt, now)}
                  </div>
                </div>

                <div className="teacher-exams-item-summary-grid">
                  <div className="teacher-exams-item-summary-card">
                    <div className="teacher-exams-item-summary-label">发布方式</div>
                    <div className="teacher-exams-item-summary-value">{getPublishModeLabel(item.publishMode)}</div>
                  </div>
                  <div className="teacher-exams-item-summary-card">
                    <div className="teacher-exams-item-summary-label">平均分</div>
                    <div className="teacher-exams-item-summary-value">{item.avgScore}%</div>
                  </div>
                  <div className="teacher-exams-item-summary-card">
                    <div className="teacher-exams-item-summary-label">监测</div>
                    <div className="teacher-exams-item-summary-value">{item.antiCheatLevel === "basic" ? "基础防作弊" : "已关闭"}</div>
                  </div>
                  <div className="teacher-exams-item-summary-card">
                    <div className="teacher-exams-item-summary-label">时长</div>
                    <div className="teacher-exams-item-summary-value">{item.durationMinutes ? `${item.durationMinutes} 分钟` : "不限"}</div>
                  </div>
                </div>

                <div className="workflow-card-meta">
                  {item.startAt ? <span className="pill">开始 {formatDateTime(item.startAt)}</span> : null}
                  <span className="pill">创建于 {formatDateTime(item.createdAt)}</span>
                  <span className="pill">状态 {STATUS_LABELS[item.status]}</span>
                </div>

                {item.description ? (
                  <div className="teacher-exams-item-description">
                    <div className="feature-card">
                      <EduIcon name="board" />
                      <p>{item.description}</p>
                    </div>
                  </div>
                ) : null}

                <div className="meta-text teacher-exams-item-action-note">{getRecommendedAction(item, now)}</div>

                <div className="cta-row" style={{ marginTop: 12 }}>
                  <Link className={isPriority ? "button primary" : "button secondary"} href={`/teacher/exams/${item.id}`}>
                    {item.status === "published" ? "进入考试详情" : "查看收口详情"}
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
