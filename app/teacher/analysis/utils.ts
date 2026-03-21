import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  AnalysisAlertImpactData,
  AnalysisAlertItem,
  AnalysisAlertKind,
  AnalysisActionType,
  AnalysisClassItem,
  AnalysisHeatItem,
  AnalysisReportData
} from "./types";

export const ACTION_TYPE_LABEL: Record<AnalysisActionType, string> = {
  assign_review: "布置修复",
  notify_student: "提醒学生/班级",
  auto_chain: "一键闭环",
  mark_done: "确认完成"
};

export function getAlertTypeLabel(type: AnalysisAlertKind) {
  return type === "student-risk" ? "学生风险" : "知识点风险";
}

export function getAlertNotificationLabel(type: AnalysisAlertKind) {
  return type === "student-risk" ? "提醒学生" : "提醒全班";
}

export function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN") : "-";
}

export function ratioColor(ratio: number) {
  if (ratio < 60) return "var(--danger)";
  if (ratio < 80) return "var(--warning)";
  return "var(--success)";
}

export function getTeacherAnalysisRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续查看分析看板。";
  }
  if (lower === "invalid alert id") {
    return "当前预警标识无效，请刷新列表后重试。";
  }
  if (lower === "invalid actiontype") {
    return "当前预警动作不可用，请刷新列表后重试。";
  }
  if (lower === "alert has no target students") {
    return "该预警当前没有可执行的学生对象，建议刷新列表后重试。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getTeacherAnalysisClassRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (requestMessage === "class not found" || (status === 404 && requestMessage === "not found")) {
    return "当前班级不存在，或你已失去访问权限。";
  }

  return getTeacherAnalysisRequestMessage(error, fallback);
}

export function getTeacherAnalysisFavoritesRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 404 && requestMessage === "not found") {
    return "该学生已不在当前班级中，暂时无法查看收藏。";
  }

  return getTeacherAnalysisRequestMessage(error, fallback);
}

export function getTeacherAnalysisAlertRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 404 && requestMessage === "not found") {
    return "该预警已不存在，列表将按最新状态刷新。";
  }

  return getTeacherAnalysisRequestMessage(error, fallback);
}

export function isMissingTeacherAnalysisClassError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();
  return requestMessage === "class not found" || (status === 404 && requestMessage === "not found");
}

export function isMissingTeacherAnalysisAlertError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();
  return requestMessage === "invalid alert id" || (status === 404 && requestMessage === "not found");
}

export function resolveTeacherAnalysisClassId(
  currentClassId: string,
  classes: Array<{ id: string }>
) {
  if (currentClassId && classes.some((item) => item.id === currentClassId)) {
    return currentClassId;
  }
  return classes[0]?.id ?? "";
}

export function resolveTeacherAnalysisStudentId(
  currentStudentId: string,
  students: Array<{ id: string }>,
  preferredStudentId?: string
) {
  if (preferredStudentId && students.some((item) => item.id === preferredStudentId)) {
    return preferredStudentId;
  }
  if (currentStudentId && students.some((item) => item.id === currentStudentId)) {
    return currentStudentId;
  }
  return students[0]?.id ?? "";
}

export function removeTeacherAnalysisClassSnapshot<T extends { id: string }>(
  previousClasses: T[],
  missingClassId: string
) {
  const classes = previousClasses.filter((item) => item.id !== missingClassId);
  return {
    classes,
    classId: resolveTeacherAnalysisClassId("", classes)
  };
}

export function removeTeacherAnalysisAlertImpact(
  previousImpactByAlertId: Record<string, AnalysisAlertImpactData>,
  alertId: string
) {
  if (!previousImpactByAlertId[alertId]) {
    return previousImpactByAlertId;
  }

  const nextImpactByAlertId = { ...previousImpactByAlertId };
  delete nextImpactByAlertId[alertId];
  return nextImpactByAlertId;
}

export function getTeacherAnalysisPageDerivedState({
  alerts,
  classId,
  classes,
  heatmap,
  heatmapLoading,
  report,
  reportLoading
}: {
  alerts: AnalysisAlertItem[];
  classId: string;
  classes: AnalysisClassItem[];
  heatmap: AnalysisHeatItem[];
  heatmapLoading: boolean;
  report: AnalysisReportData | null;
  reportLoading: boolean;
}) {
  const visibleHeatmap = heatmap.slice(0, 40);
  const weakestKnowledgePoint =
    [...visibleHeatmap].sort((left, right) => {
      if (left.ratio !== right.ratio) {
        return left.ratio - right.ratio;
      }
      return right.total - left.total;
    })[0] ?? null;

  return {
    heatmap: visibleHeatmap,
    showHeatmapSkeleton: heatmapLoading && visibleHeatmap.length === 0,
    showReportSkeleton: reportLoading && !report,
    selectedClass: classes.find((item) => item.id === classId) ?? null,
    activeAlertCount: alerts.filter((item) => item.status === "active").length,
    weakestKnowledgePoint
  };
}
