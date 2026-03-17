import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { LibraryDetailItem, LibraryKnowledgePoint } from "./types";

function getLibraryDetailRequest(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase();
}

export function getLibraryDetailRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getLibraryDetailRequest(error);

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后再查看资料。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "资料不存在，或当前账号无权访问。";
  }
  if (requestMessage === "quote required") {
    return "请先选中或填写需要标注的原文片段。";
  }
  if (requestMessage === "knowledgepointids required") {
    return "请至少选择一个知识点后再保存。";
  }
  if (requestMessage === "knowledgepointids not match subject/grade") {
    return "所选知识点与当前资料的学科或年级不匹配，请重新选择。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function isMissingLibraryItemError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getLibraryDetailRequest(error) === "not found";
}

export function resolveLibrarySelectedKnowledgePointIds(
  item: Pick<LibraryDetailItem, "grade" | "knowledgePointIds" | "subject"> | null,
  knowledgePoints: Pick<LibraryKnowledgePoint, "grade" | "id" | "subject">[],
  selectedKnowledgePointIds: string[]
) {
  if (!item) {
    return [];
  }

  const allowedIds = new Set(
    knowledgePoints
      .filter((kp) => kp.subject === item.subject && kp.grade === item.grade)
      .map((kp) => kp.id)
  );
  const candidates = selectedKnowledgePointIds.length ? selectedKnowledgePointIds : item.knowledgePointIds ?? [];

  return Array.from(new Set(candidates.filter((id) => allowedIds.has(id))));
}
