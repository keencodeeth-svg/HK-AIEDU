import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { ExamDetail } from "../types";
import { formatRemain } from "../utils";

type ExamOverviewCardProps = {
  data: ExamDetail;
  submitted: boolean;
  online: boolean;
  answerCount: number;
  unansweredCount: number;
  totalScore: number;
  remainingSeconds: number | null;
  startedAt: string | null;
  saving: boolean;
  savedAt: string | null;
  syncNotice: string | null;
  actionMessage: string | null;
  actionError: string | null;
  lockReason: string | null;
  finalScore: number;
  finalTotal: number;
  submitting: boolean;
  lockedByTime: boolean;
  lockedByServer: boolean;
  stageTitle: string;
  stageDescription: string;
  firstUnansweredQuestionId: string | null;
  feedbackTargetId: string | null;
  onSaveDraft: () => void;
};

export default function ExamOverviewCard({
  data,
  submitted,
  online,
  answerCount,
  unansweredCount,
  totalScore,
  remainingSeconds,
  startedAt,
  saving,
  savedAt,
  syncNotice,
  actionMessage,
  actionError,
  lockReason,
  finalScore,
  finalTotal,
  submitting,
  lockedByTime,
  lockedByServer,
  stageTitle,
  stageDescription,
  firstUnansweredQuestionId,
  feedbackTargetId,
  onSaveDraft
}: ExamOverviewCardProps) {
  return (
    <Card title="考试信息" tag="概览">
      <div className="exam-stage-banner">
        <div className="exam-stage-kicker">当前阶段</div>
        <div className="exam-stage-title">{stageTitle}</div>
        <p className="exam-stage-description">{stageDescription}</p>
        <div className="pill-list">
          <span className="pill">已答 {answerCount}/{data.questions.length}</span>
          <span className="pill">未答 {unansweredCount}</span>
          {!submitted && remainingSeconds !== null ? <span className="pill">剩余 {formatRemain(remainingSeconds)}</span> : null}
          <span className="pill">网络 {online ? "在线" : "离线"}</span>
        </div>
      </div>

      {actionMessage ? <div className="status-note success">{actionMessage}</div> : null}
      {actionError ? <div className="status-note error">{actionError}</div> : null}
      {syncNotice ? <div className="status-note info">{syncNotice}</div> : null}

      <div className="grid grid-2">
        <div className="card feature-card">
          <EduIcon name="board" />
          <div className="section-title">考试说明</div>
          <p>{data.exam.description || "请认真作答，按时提交。"}</p>
          <div className="pill-list">
            {data.exam.startAt ? (
              <span className="pill">开始 {new Date(data.exam.startAt).toLocaleString("zh-CN")}</span>
            ) : (
              <span className="pill">可立即开始</span>
            )}
            <span className="pill">截止 {new Date(data.exam.endAt).toLocaleString("zh-CN")}</span>
            <span className="pill">状态 {data.exam.status === "closed" ? "已关闭" : "开放中"}</span>
            <span className="pill">监测 {data.exam.antiCheatLevel === "basic" ? "切屏/离屏记录中" : "关闭"}</span>
            <span className="pill">
              {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
            </span>
          </div>
        </div>
        <div className="card feature-card">
          <EduIcon name="chart" />
          <div className="section-title">作答状态</div>
          <div className="pill-list">
            <span className="pill">总分 {totalScore}</span>
            <span className="pill">时长 {data.exam.durationMinutes ? `${data.exam.durationMinutes} 分钟` : "不限"}</span>
            {!submitted && remainingSeconds !== null ? <span className="pill">剩余 {formatRemain(remainingSeconds)}</span> : null}
            {!submitted && data.exam.durationMinutes && !startedAt ? <span className="pill">开始作答后计时</span> : null}
          </div>
          {submitted ? (
            <div className="exam-meta-line">成绩：{finalScore}/{finalTotal}</div>
          ) : (
            <div className="exam-meta-line">
              {saving ? "自动保存中..." : savedAt ? `最近保存：${new Date(savedAt).toLocaleTimeString("zh-CN")}` : "尚未保存"}
            </div>
          )}
          {lockReason ? <div className="exam-meta-line error">{lockReason}，当前仅可查看作答记录。</div> : null}
        </div>
      </div>
      <div className="cta-row exam-inline-actions" style={{ marginTop: 12 }}>
        <Link className="button ghost" href="/student/exams">
          返回考试列表
        </Link>
        {!submitted && firstUnansweredQuestionId ? (
          <a className="button ghost" href={`#exam-question-${firstUnansweredQuestionId}`}>
            继续未答题
          </a>
        ) : null}
        {feedbackTargetId ? (
          <a className="button ghost" href={`#${feedbackTargetId}`}>
            {feedbackTargetId === "exam-review-pack" ? "查看复盘" : "查看结果"}
          </a>
        ) : null}
        {!submitted ? (
          <button
            className="button secondary"
            type="button"
            onClick={onSaveDraft}
            disabled={saving || submitting || lockedByTime || lockedByServer}
          >
            {saving ? "保存中..." : "保存进度"}
          </button>
        ) : null}
      </div>
    </Card>
  );
}
