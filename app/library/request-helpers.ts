import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";

export function getLibraryPageBaseRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续管理资料库。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "资料不存在，可能已被删除或你已失去访问权限。";
  }
  return getRequestErrorMessage(error, fallback);
}

export function getLibraryImportRequestMessage(error: unknown, fallback: string) {
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (requestMessage === "missing fields") {
    return "请补全标题、学科和年级后再提交。";
  }
  if (requestMessage === "textbook requires file source") {
    return "教材资源仅支持文件导入，请切换为文件上传。";
  }
  if (requestMessage === "file content required" || requestMessage === "missing file content") {
    return "请先上传文件内容后再提交。";
  }
  if (requestMessage === "link required" || requestMessage === "missing link") {
    return "请填写有效链接后再提交。";
  }
  if (requestMessage === "text content required" || requestMessage === "missing text content") {
    return "请填写资料正文后再提交。";
  }
  return getLibraryPageBaseRequestMessage(error, fallback);
}

export function getLibraryBatchImportRequestMessage(error: unknown, fallback: string) {
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (requestMessage === "textbooks or questions required") {
    return "批量导入至少需要提供教材或习题数据。";
  }
  return getLibraryPageBaseRequestMessage(error, fallback);
}

export function getLibraryAiGenerateRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (requestMessage === "missing fields") {
    return "请先选择班级并填写主题后再生成。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "当前班级不存在，或你无权向该班级生成资料。";
  }
  return getLibraryPageBaseRequestMessage(error, fallback);
}

export function normalizeLibraryBatchFailedReason(reason: string) {
  const normalized = reason.trim().toLowerCase();

  if (normalized === "missing fields") return "缺少必填字段";
  if (normalized === "invalid subject") return "学科不合法";
  if (normalized === "textbook requires file source") return "教材仅支持文件来源";
  if (normalized === "missing file content") return "缺少文件内容";
  if (normalized === "missing link") return "缺少链接";
  if (normalized === "missing text content") return "缺少正文内容";
  if (normalized === "duplicate stem skipped") return "题干重复，已跳过";
  if (normalized === "knowledge point id mismatch") return "知识点与题目学科或年级不匹配";
  if (normalized === "knowledge point missing") return "未找到可用知识点";
  if (normalized === "create question failed") return "题目录入失败";
  return reason;
}

export function isMissingLibraryItemError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}

export function removeFacetCount(
  facets: Array<{ value: string; count: number }>,
  value: string
) {
  return facets.reduce<Array<{ value: string; count: number }>>((acc, item) => {
    if (item.value !== value) {
      acc.push(item);
      return acc;
    }

    if (item.count > 1) {
      acc.push({ ...item, count: item.count - 1 });
    }
    return acc;
  }, []);
}
