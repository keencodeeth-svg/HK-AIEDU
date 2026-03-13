import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import type { ExamDetail } from "../types";

type ExamOverviewCardProps = {
  data: ExamDetail;
  updatingStatus: boolean;
  publishingReviewPack: boolean;
  statusError: string | null;
  publishMessage: string | null;
  publishError: string | null;
  onStatusAction: (action: "close" | "reopen") => void | Promise<void>;
  onPublishReviewPack: (dryRun: boolean) => void | Promise<void>;
};

export default function ExamOverviewCard({
  data,
  updatingStatus,
  publishingReviewPack,
  statusError,
  publishMessage,
  publishError,
  onStatusAction,
  onPublishReviewPack
}: ExamOverviewCardProps) {
  return (
    <Card title="考试概览" tag="概览">
      <div className="grid grid-2">
        <div className="card feature-card">
          <EduIcon name="board" />
          <div className="section-title">考试时间</div>
          <p>截止 {new Date(data.exam.endAt).toLocaleString("zh-CN")}</p>
          <div className="pill-list">
            {data.exam.startAt ? (
              <span className="pill">开始 {new Date(data.exam.startAt).toLocaleString("zh-CN")}</span>
            ) : (
              <span className="pill">开始时间不限</span>
            )}
            <span className="pill">发布 {data.exam.publishMode === "teacher_assigned" ? "班级统一" : "定向"}</span>
            <span className="pill">防作弊 {data.exam.antiCheatLevel === "basic" ? "基础监测" : "关闭"}</span>
            <span className="pill">时长 {data.exam.durationMinutes ? `${data.exam.durationMinutes} 分钟` : "不限"}</span>
          </div>
        </div>
        <div className="card feature-card">
          <EduIcon name="chart" />
          <div className="section-title">班级进度</div>
          <div className="pill-list">
            <span className="pill">已分配 {data.summary.assigned}</span>
            <span className="pill">已提交 {data.summary.submitted}</span>
            <span className="pill">待提交 {data.summary.pending}</span>
            <span className="pill">平均分 {data.summary.avgScore}%</span>
            <span className="pill">离屏 {data.summary.totalVisibilityHiddenCount}</span>
            <span className="pill">切屏 {data.summary.totalBlurCount}</span>
            <span className="pill">高风险 {data.summary.highRiskCount}</span>
            <span className="pill">中风险 {data.summary.mediumRiskCount}</span>
          </div>
        </div>
      </div>
      {data.exam.description ? (
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--ink-1)" }}>{data.exam.description}</div>
      ) : null}
      <div className="cta-row" style={{ marginTop: 12 }}>
        <Link className="button ghost" href="/teacher/exams">
          返回考试列表
        </Link>
        {data.exam.status === "closed" ? (
          <button className="button primary" type="button" disabled={updatingStatus} onClick={() => onStatusAction("reopen")}>
            {updatingStatus ? "处理中..." : "重新开放考试"}
          </button>
        ) : (
          <button className="button secondary" type="button" disabled={updatingStatus} onClick={() => onStatusAction("close")}>
            {updatingStatus ? "处理中..." : "关闭考试"}
          </button>
        )}
        <a className="button secondary" href={`/api/teacher/exams/${data.exam.id}/export`}>
          导出成绩 CSV
        </a>
        <button
          className="button primary"
          type="button"
          disabled={publishingReviewPack || data.summary.submitted <= 0}
          onClick={() => onPublishReviewPack(false)}
        >
          {publishingReviewPack ? "发布中..." : "发布高风险复盘任务"}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={publishingReviewPack || data.summary.submitted <= 0}
          onClick={() => onPublishReviewPack(true)}
        >
          {publishingReviewPack ? "处理中..." : "预览发布范围"}
        </button>
        <Link className="button secondary" href="/teacher/exams/create">
          再发布一场考试
        </Link>
      </div>
      <div id="exam-review-pack">
        {statusError ? <div className="status-note error">{statusError}</div> : null}
        {publishMessage ? <div className="status-note success">{publishMessage}</div> : null}
        {publishError ? <div className="status-note error">{publishError}</div> : null}
      </div>
    </Card>
  );
}
