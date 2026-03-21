import type {
  TeacherAssignmentReviewData,
  TeacherAssignmentReviewItem,
  TeacherAssignmentReviewItemState,
  TeacherAssignmentReviewQuestion,
  TeacherAssignmentReviewRubric,
  TeacherAssignmentReviewRubricState,
  TeacherAssignmentRubric
} from "./types";
import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";

export const ASSIGNMENT_REVIEW_TAGS = ["审题错误", "计算错误", "概念混淆", "步骤遗漏", "粗心", "其他"];

export function buildReviewItemState(items: TeacherAssignmentReviewItem[]): TeacherAssignmentReviewItemState {
  const nextState: TeacherAssignmentReviewItemState = {};

  items.forEach((item) => {
    nextState[item.questionId] = {
      wrongTag: item.wrongTag ?? "",
      comment: item.comment ?? ""
    };
  });

  return nextState;
}

export function buildReviewRubricState(
  reviewRubrics: TeacherAssignmentReviewRubric[],
  rubrics: TeacherAssignmentRubric[]
): TeacherAssignmentReviewRubricState {
  const nextState: TeacherAssignmentReviewRubricState = {};

  reviewRubrics.forEach((item) => {
    nextState[item.rubricId] = {
      score: Number(item.score ?? 0),
      comment: item.comment ?? ""
    };
  });

  rubrics.forEach((rubric) => {
    if (!nextState[rubric.id]) {
      nextState[rubric.id] = {
        score: 0,
        comment: ""
      };
    }
  });

  return nextState;
}

export function getTeacherAssignmentReviewDerivedState(data: TeacherAssignmentReviewData | null) {
  const wrongQuestions = (data?.questions ?? []).filter((item) => !item.correct);
  const canAiReview =
    (data?.uploads?.length ?? 0) > 0 || Boolean(data?.submission?.submissionText?.trim());
  const isEssay = data?.assignment?.submissionType === "essay";
  const isUpload = data?.assignment?.submissionType === "upload";

  return {
    wrongQuestions,
    canAiReview,
    isEssay,
    isUpload,
    isQuiz: !isEssay && !isUpload
  };
}

export function buildTeacherAssignmentReviewSubmitPayload({
  data,
  overallComment,
  wrongQuestions,
  itemState,
  rubricState
}: {
  data: TeacherAssignmentReviewData;
  overallComment: string;
  wrongQuestions: TeacherAssignmentReviewQuestion[];
  itemState: TeacherAssignmentReviewItemState;
  rubricState: TeacherAssignmentReviewRubricState;
}) {
  return {
    overallComment,
    items: wrongQuestions.map((question) => ({
      questionId: question.id,
      wrongTag: itemState[question.id]?.wrongTag || "",
      comment: itemState[question.id]?.comment || ""
    })),
    rubrics: data.rubrics.map((rubric) => ({
      rubricId: rubric.id,
      score: rubricState[rubric.id]?.score ?? 0,
      comment: rubricState[rubric.id]?.comment ?? ""
    }))
  };
}

export function getTeacherAssignmentReviewRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续批改。";
  }
  if (lower === "student not in class") {
    return "该学生已不在当前班级中，无法查看或批改这份作业。";
  }
  if (lower === "student not found") {
    return "学生不存在，可能已被移出当前班级。";
  }
  if (status === 404 && lower === "not found") {
    return "作业不存在，或当前教师账号无权查看这份批改记录。";
  }
  if (requestMessage === "该作业为在线题目，不支持 AI 批改") {
    return "该作业为在线题目，不能走 AI 作文/附件批改流程。";
  }
  if (requestMessage === "学生未上传作业") {
    return "学生尚未上传作业附件，暂时无法发起 AI 批改。";
  }
  if (requestMessage === "学生未提交作文内容或附件") {
    return "学生尚未提交作文内容或附件，暂时无法发起 AI 批改。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function isMissingTeacherAssignmentReviewError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();
  return (
    requestMessage === "student not in class" ||
    requestMessage === "student not found" ||
    (status === 404 && requestMessage === "not found")
  );
}
