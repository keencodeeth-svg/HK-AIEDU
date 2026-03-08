import Link from "next/link";
import Card from "@/components/Card";
import MathText from "@/components/MathText";
import type { ReviewPackSummary, SubmitResultDetail } from "../types";

type ExamResultCardProps = {
  details: SubmitResultDetail[];
  score: number;
  total: number;
  wrongCount: number;
  queuedReviewCount: number;
  reviewPackSummary: ReviewPackSummary | null;
};

export default function ExamResultCard({
  details,
  score,
  total,
  wrongCount,
  queuedReviewCount,
  reviewPackSummary
}: ExamResultCardProps) {
  if (!details.length) return null;

  return (
    <Card title="答题结果" tag="反馈">
      <div className="exam-result-summary">
        {wrongCount > 0
          ? `本次得分 ${score}/${total}，共有 ${wrongCount} 题需要优先复盘，建议先看下方结果再打开复盘包。`
          : `本次得分 ${score}/${total}，当前没有错题，可以直接返回考试列表或继续进入日常练习。`}
      </div>
      <div className="pill-list">
        <span className="pill">成绩 {score}/{total}</span>
        <span className="pill">错题 {wrongCount}</span>
        {queuedReviewCount > 0 ? <span className="pill">已加入复练 {queuedReviewCount} 题</span> : null}
        {reviewPackSummary ? <span className="pill">预计复盘 {reviewPackSummary.estimatedMinutes} 分钟</span> : null}
      </div>
      <div className="cta-row exam-result-next-actions">
        {reviewPackSummary ? (
          <a className="button secondary" href="#exam-review-pack">
            打开考试复盘包
          </a>
        ) : null}
        <Link className="button ghost" href={wrongCount > 0 ? "/wrong-book" : "/student/exams"}>
          {wrongCount > 0 ? "打开今日复练清单" : "返回考试列表"}
        </Link>
      </div>
      <div className="grid" style={{ gap: 8 }}>
        {details.map((item, index) => (
          <div className="card" key={item.questionId}>
            <div className="section-title">
              {index + 1}. {item.correct ? "正确" : "错误"}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
              你的答案：<MathText text={item.answer || "未作答"} />；正确答案：<MathText text={item.correctAnswer} />；分值：{item.score}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
