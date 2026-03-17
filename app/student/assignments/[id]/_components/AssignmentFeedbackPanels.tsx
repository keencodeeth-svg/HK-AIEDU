"use client";

import type { RefObject } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import AssignmentAiReviewCard from "./AssignmentAiReviewCard";
import AssignmentQuizResultCard from "./AssignmentQuizResultCard";
import AssignmentRubricsCard from "./AssignmentRubricsCard";
import AssignmentTeacherReviewCard from "./AssignmentTeacherReviewCard";
import AssignmentWrongQuestionsCard from "./AssignmentWrongQuestionsCard";
import type { AssignmentQuestion, AssignmentReviewPayload, SubmitResult } from "../types";

type Props = {
  feedbackSectionRef: RefObject<HTMLDivElement>;
  questions: AssignmentQuestion[];
  result: SubmitResult | null;
  review: AssignmentReviewPayload | null;
  isQuiz: boolean;
  isUpload: boolean;
  isEssay: boolean;
};

export default function AssignmentFeedbackPanels({
  feedbackSectionRef,
  questions,
  result,
  review,
  isQuiz,
  isUpload,
  isEssay
}: Props) {
  return (
    <div className="grid" id="assignment-feedback" ref={feedbackSectionRef} style={{ gap: 18 }}>
      {result && isQuiz ? <AssignmentQuizResultCard result={result} questions={questions} /> : null}

      {result && (isUpload || isEssay) ? (
        <Card title="提交结果" tag="已提交">
          <p>作业已提交，等待老师批改。</p>
          <div className="status-note info" style={{ marginTop: 8 }}>
            老师反馈生成后会继续显示在本页，无需重复上传或再次提交。
          </div>
          <div className="cta-row" style={{ marginTop: 12 }}>
            <a className="button ghost" href="#assignment-submission">
              回到作答区
            </a>
            <Link className="button secondary" href="/student/assignments">
              返回作业中心
            </Link>
          </div>
        </Card>
      ) : null}

      {review?.review ? (
        <AssignmentTeacherReviewCard
          overallComment={review.review.overallComment}
          reviewItems={review.reviewItems ?? []}
          questions={review.questions ?? []}
        />
      ) : null}

      {review?.rubrics?.length ? (
        <AssignmentRubricsCard rubrics={review.rubrics} reviewRubrics={review.reviewRubrics ?? []} />
      ) : null}

      {review?.aiReview ? <AssignmentAiReviewCard aiReview={review.aiReview} /> : null}

      {review?.questions && isQuiz ? <AssignmentWrongQuestionsCard questions={review.questions} /> : null}
    </div>
  );
}
