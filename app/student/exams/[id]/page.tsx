"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import MathViewControls from "@/components/MathViewControls";
import { SUBJECT_LABELS } from "@/lib/constants";
import ExamAnswerSheetCard from "./_components/ExamAnswerSheetCard";
import ExamOverviewCard from "./_components/ExamOverviewCard";
import ExamResultCard from "./_components/ExamResultCard";
import ExamReviewPackCard from "./_components/ExamReviewPackCard";
import { useStudentExamDetailPage } from "./useStudentExamDetailPage";

export default function StudentExamDetailPage({ params }: { params: { id: string } }) {
  const examPage = useStudentExamDetailPage(params.id);
  const { data, result, reviewPack, reviewPackSummary } = examPage;

  if (examPage.authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录后查看考试详情"
        description="登录后即可继续作答、同步草稿并查看考试复盘。"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (examPage.pageLoading && !data && !examPage.loadError) {
    return <StatePanel tone="loading" title="考试详情加载中" description="正在同步题目、作答进度和考试时钟。" />;
  }

  if (examPage.loadError && !data) {
    return (
      <StatePanel
        tone="error"
        title="考试详情暂时不可用"
        description={examPage.loadError}
        action={
          <div className="cta-row">
            <button className="button secondary" type="button" onClick={() => void examPage.load()}>
              重新加载
            </button>
            <Link className="button ghost" href="/student/exams">
              返回考试列表
            </Link>
          </div>
        }
      />
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="grid math-view-surface" style={{ gap: 18, ...examPage.mathView.style }}>
      <div className="section-head">
        <div>
          <h2>{data.exam.title}</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <span className="chip">{examPage.stageLabel}</span>
      </div>

      <MathViewControls
        fontScale={examPage.mathView.fontScale}
        lineMode={examPage.mathView.lineMode}
        onDecrease={examPage.mathView.decreaseFontScale}
        onIncrease={examPage.mathView.increaseFontScale}
        onReset={examPage.mathView.resetView}
        onLineModeChange={examPage.mathView.setLineMode}
      />

      <div id="exam-overview">
        <ExamOverviewCard
          data={data}
          submitted={examPage.submitted}
          online={examPage.online}
          answerCount={examPage.answerCount}
          unansweredCount={examPage.unansweredCount}
          totalScore={examPage.totalScore}
          remainingSeconds={examPage.remainingSeconds}
          startedAt={examPage.startedAt}
          saving={examPage.saving}
          savedAt={examPage.savedAt}
          syncNotice={examPage.syncNotice}
          actionMessage={examPage.actionMessage}
          actionError={examPage.actionError}
          lockReason={examPage.lockReason}
          finalScore={examPage.finalScore}
          finalTotal={examPage.finalTotal}
          submitting={examPage.submitting}
          lockedByTime={examPage.lockedByTime}
          lockedByServer={examPage.lockedByServer}
          stageTitle={examPage.stageCopy.title}
          stageDescription={examPage.stageCopy.description}
          firstUnansweredQuestionId={examPage.firstUnansweredQuestionId}
          feedbackTargetId={examPage.feedbackTargetId}
          onSaveDraft={examPage.handleSaveDraft}
        />
      </div>

      <div id="exam-answer-sheet">
        <ExamAnswerSheetCard
          data={data}
          answers={examPage.answers}
          answerCount={examPage.answerCount}
          unansweredCount={examPage.unansweredCount}
          firstUnansweredQuestionId={examPage.firstUnansweredQuestionId}
          submitted={examPage.submitted}
          lockedByTime={examPage.lockedByTime}
          lockedByServer={examPage.lockedByServer}
          submitting={examPage.submitting}
          online={examPage.online}
          lockReason={examPage.lockReason}
          finalScore={examPage.finalScore}
          finalTotal={examPage.finalTotal}
          queuedReviewCount={result?.queuedReviewCount}
          feedbackTargetId={examPage.feedbackTargetId}
          onSubmit={examPage.handleSubmit}
          onAnswerChange={examPage.handleAnswerChange}
        />
      </div>

      {result ? (
        <div id="exam-result" ref={examPage.resultSectionRef}>
          <ExamResultCard
            details={result.details ?? []}
            score={result.score}
            total={result.total}
            wrongCount={result.wrongCount}
            queuedReviewCount={result.queuedReviewCount}
            reviewPackSummary={reviewPackSummary}
          />
        </div>
      ) : null}

      {examPage.hasReviewPackSection ? (
        <div id="exam-review-pack">
          <ExamReviewPackCard
            reviewPackLoading={examPage.reviewPackLoading}
            reviewPack={reviewPack}
            reviewPackSummary={reviewPackSummary}
            reviewPackError={examPage.reviewPackError}
            onLoadReviewPack={() => void examPage.loadReviewPack()}
          />
        </div>
      ) : null}
    </div>
  );
}
