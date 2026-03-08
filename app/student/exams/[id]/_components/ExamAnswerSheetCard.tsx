import type { FormEventHandler } from "react";
import Card from "@/components/Card";
import MathText from "@/components/MathText";
import type { ExamDetail } from "../types";

type ExamAnswerSheetCardProps = {
  data: ExamDetail;
  answers: Record<string, string>;
  answerCount: number;
  unansweredCount: number;
  firstUnansweredQuestionId: string | null;
  submitted: boolean;
  lockedByTime: boolean;
  lockedByServer: boolean;
  submitting: boolean;
  online: boolean;
  lockReason: string | null;
  finalScore: number;
  finalTotal: number;
  queuedReviewCount?: number;
  feedbackTargetId: string | null;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onAnswerChange: (questionId: string, value: string) => void;
};

export default function ExamAnswerSheetCard({
  data,
  answers,
  answerCount,
  unansweredCount,
  firstUnansweredQuestionId,
  submitted,
  lockedByTime,
  lockedByServer,
  submitting,
  online,
  lockReason,
  finalScore,
  finalTotal,
  queuedReviewCount,
  feedbackTargetId,
  onSubmit,
  onAnswerChange
}: ExamAnswerSheetCardProps) {
  const submitLabel = submitting
    ? "提交中..."
    : !online
      ? "离线状态不可提交"
      : lockedByServer
        ? lockReason ?? "当前不可提交"
        : lockedByTime
          ? "时间已结束，立即提交"
          : unansweredCount > 0
            ? `还有 ${unansweredCount} 题未答，仍提交`
            : "提交考试";

  return (
    <Card title="考试作答" tag="作答">
      <form className="exam-answer-form" onSubmit={onSubmit}>
        <div className="exam-answer-progress-card">
          <div className="section-title">题号导航</div>
          <div className="exam-answer-progress-meta">已答 {answerCount}/{data.questions.length} 题，点击题号可快速跳转。</div>
          <div className="exam-answer-jump-grid">
            {data.questions.map((question, index) => {
              const answered = Boolean(answers[question.id]?.trim());
              return (
                <a
                  className={`exam-answer-jump-chip ${answered ? "answered" : "pending"}`}
                  href={`#exam-question-${question.id}`}
                  key={question.id}
                >
                  {index + 1}
                </a>
              );
            })}
          </div>
        </div>

        {data.questions.map((question, index) => {
          const answered = Boolean(answers[question.id]?.trim());
          return (
            <div className={`card exam-question-card${answered ? " answered" : ""}`} id={`exam-question-${question.id}`} key={question.id}>
              <div className="section-title">
                {index + 1}. <MathText text={question.stem} showCopyActions />
              </div>
              <div className="exam-question-options">
                {question.options.map((option, optionIndex) => (
                  <label className="exam-question-option" key={`${question.id}-${optionIndex}`}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={answers[question.id] === option}
                      disabled={submitted || lockedByTime || lockedByServer || submitting}
                      onChange={(event) => onAnswerChange(question.id, event.target.value)}
                    />
                    <MathText text={option} />
                  </label>
                ))}
              </div>
              <div className="exam-question-status">{answered ? "已选择答案，可继续下一题。" : "当前未作答，建议优先完成。"}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>分值：{question.score}</div>
            </div>
          );
        })}

        {submitted ? (
          <div className="card">
            <div className="section-title">考试已提交</div>
            <p>你的成绩：{finalScore}/{finalTotal}</p>
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
              提交时间：{data.assignment.submittedAt ? new Date(data.assignment.submittedAt).toLocaleString("zh-CN") : "-"}
            </div>
            {queuedReviewCount ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>错题已加入今日复练清单：{queuedReviewCount} 题</div>
            ) : null}
            {feedbackTargetId ? (
              <div className="cta-row exam-inline-actions" style={{ marginTop: 12 }}>
                <a className="button ghost" href={`#${feedbackTargetId}`}>
                  {feedbackTargetId === "exam-review-pack" ? "查看复盘" : "查看结果"}
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="cta-row exam-inline-actions">
            {firstUnansweredQuestionId ? (
              <a className="button ghost" href={`#exam-question-${firstUnansweredQuestionId}`}>
                跳到下一道未答题
              </a>
            ) : null}
            <button className="button primary" type="submit" disabled={submitting || !online || lockedByServer}>
              {submitLabel}
            </button>
          </div>
        )}
      </form>
    </Card>
  );
}
