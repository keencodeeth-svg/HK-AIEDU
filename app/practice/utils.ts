import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { KnowledgePoint, PracticeMode } from "./types";

function getPracticeRequestMessage(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase();
}

function getPracticeBaseRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续练习。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function isPracticeNoQuestionsError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getPracticeRequestMessage(error) === "no questions";
}

export function isPracticeQuestionMissingError(error: unknown) {
  if ((getRequestStatus(error) ?? 0) !== 404) {
    return false;
  }

  const requestMessage = getPracticeRequestMessage(error);
  return requestMessage === "not found" || requestMessage === "question not found";
}

export function getPracticeKnowledgePointsRequestMessage(error: unknown, fallback: string) {
  if ((getRequestStatus(error) ?? 0) === 401 || (getRequestStatus(error) ?? 0) === 403) {
    return "学生登录状态已失效，请重新登录后继续加载知识点。";
  }

  return getPracticeBaseRequestMessage(error, fallback);
}

export function getPracticeNextQuestionRequestMessage(
  error: unknown,
  next: { knowledgePointId?: string; mode: PracticeMode }
) {
  if (isPracticeNoQuestionsError(error)) {
    if (next.mode === "review") {
      return "当前还没有到期的复练题目，可先做普通练习或错题练习。";
    }
    if (next.mode === "wrong") {
      return "当前错题范围内还没有可练习的题目。";
    }
    if (next.knowledgePointId) {
      return "当前知识点下暂无题目，可清空筛选或切换知识点后再试。";
    }
    return "当前条件下暂无题目，可切换模式、学科或年级后再试。";
  }

  if ((getRequestStatus(error) ?? 0) === 401 || (getRequestStatus(error) ?? 0) === 403) {
    return "学生登录状态已失效，请重新登录后继续获取练习题目。";
  }

  return getPracticeBaseRequestMessage(error, "暂无题目");
}

function getPracticeQuestionRequestMessage(error: unknown, fallback: string, authCopy: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return authCopy;
  }
  if (isPracticeQuestionMissingError(error)) {
    return "当前题目已失效，请重新获取新题后继续练习。";
  }

  return getPracticeBaseRequestMessage(error, fallback);
}

export function getPracticeSubmitRequestMessage(error: unknown, fallback: string) {
  return getPracticeQuestionRequestMessage(error, fallback, "学生登录状态已失效，请重新登录后继续提交答案。");
}

export function getPracticeExplainRequestMessage(error: unknown, fallback: string) {
  return getPracticeQuestionRequestMessage(error, fallback, "学生登录状态已失效，请重新登录后继续生成 AI 讲解。");
}

export function getPracticeFavoriteRequestMessage(error: unknown, fallback: string) {
  return getPracticeQuestionRequestMessage(error, fallback, "学生登录状态已失效，请重新登录后继续处理收藏。");
}

export function getPracticeVariantRequestMessage(error: unknown, fallback: string) {
  return getPracticeQuestionRequestMessage(error, fallback, "学生登录状态已失效，请重新登录后继续生成变式训练。");
}

export function resolvePracticeKnowledgePointId(
  knowledgePoints: Pick<KnowledgePoint, "id">[],
  knowledgePointId?: string
) {
  if (!knowledgePointId) {
    return undefined;
  }

  return knowledgePoints.some((kp) => kp.id === knowledgePointId) ? knowledgePointId : undefined;
}
