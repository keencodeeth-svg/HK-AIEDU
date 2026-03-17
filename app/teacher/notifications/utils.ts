import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { ClassItem, PreviewAssignment, PreviewData, RuleItem } from "./types";

export type NotificationCommandState = {
  tone: "info" | "loading" | "empty" | "success";
  title: string;
  description: string;
};

export const DEFAULT_RULE: Omit<RuleItem, "id" | "classId"> = {
  enabled: true,
  dueDays: 2,
  overdueDays: 0,
  includeParents: true
};

export function buildDraftRule(classId: string, rules: RuleItem[]): RuleItem {
  const existing = rules.find((item) => item.classId === classId);
  return (
    existing ?? {
      id: "",
      classId,
      ...DEFAULT_RULE
    }
  );
}

export function getTeacherNotificationRulesRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续配置通知规则。";
  }
  if (lower === "class not found" || (status === 404 && lower === "not found")) {
    return "当前班级不存在，或你已失去该班级的配置权限。";
  }
  if (lower === "classid required when overriding rule") {
    return "使用临时规则发送提醒时，必须先选择班级。";
  }
  if (lower === "body.classid must be at least 1 chars") {
    return "请先选择班级后再操作。";
  }
  if (lower === "body.duedays must be >= 0") {
    return "截止前提醒天数不能小于 0。";
  }
  if (lower === "body.overduedays must be >= 0") {
    return "逾期提醒天数不能小于 0。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function isMissingTeacherNotificationClassError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();
  return requestMessage === "class not found" || (status === 404 && requestMessage === "not found");
}

export function isSameRule(left: RuleItem, right: RuleItem) {
  return (
    left.classId === right.classId &&
    left.enabled === right.enabled &&
    left.dueDays === right.dueDays &&
    left.overdueDays === right.overdueDays &&
    left.includeParents === right.includeParents
  );
}

export function getStageLabel(stage: PreviewAssignment["stage"]) {
  return stage === "overdue" ? "已逾期" : "即将到期";
}

export function getStageDescription(stage: PreviewAssignment["stage"]) {
  return stage === "overdue" ? "优先催交，避免继续堆积未完成。" : "适合做截止前提醒，减少下一轮逾期。";
}

export function getRuleWindowLabel(rule: RuleItem) {
  return `截止前 ${rule.dueDays} 天 · 逾期 ${rule.overdueDays} 天 · 家长抄送 ${rule.includeParents ? "开启" : "关闭"}`;
}

export function getSelectedClassLabel(selectedClass: ClassItem | null) {
  if (!selectedClass) return "未选择班级";
  return `${selectedClass.name} · ${SUBJECT_LABELS[selectedClass.subject] ?? selectedClass.subject} · ${selectedClass.grade} 年级`;
}

export function getCommandState(params: {
  draftRule: RuleItem;
  preview: PreviewData | null;
  hasUnsavedChanges: boolean;
  isPreviewCurrent: boolean;
}): NotificationCommandState {
  if (!params.draftRule.enabled) {
    return {
      tone: "info",
      title: "当前规则关闭",
      description: "关闭状态下不会发送任何提醒。先确认今天是否真的要开启这条催交流程。"
    };
  }
  if (!params.isPreviewCurrent) {
    return {
      tone: "info",
      title: "草稿已变更，请先刷新预览",
      description: "发送动作会基于当前草稿执行。先刷新预览，确认最新规则到底会触达谁，再决定是否立即发送。"
    };
  }
  if (!params.preview) {
    return {
      tone: "loading",
      title: "预览准备中",
      description: "正在同步当前班级的提醒范围。"
    };
  }
  if (!params.preview.summary.assignmentTargets) {
    return {
      tone: "empty",
      title: "当前没有待发提醒",
      description: "这套规则现在不会触发任何提醒。可以放宽阈值，或把注意力转到提交箱和成绩册。"
    };
  }
  if (params.preview.summary.overdueAssignments > 0) {
    return {
      tone: "info",
      title: "当前更适合先发逾期催交",
      description: `已逾期 ${params.preview.summary.overdueAssignments} 份作业，建议先看逾期队列，再决定是否立即发送。`
    };
  }
  return {
    tone: params.hasUnsavedChanges ? "info" : "success",
    title: params.hasUnsavedChanges ? "草稿已准备好，但还未保存为默认规则" : "当前规则已经准备好执行",
    description: `当前预览会覆盖 ${params.preview.summary.assignmentTargets} 份作业、${params.preview.summary.uniqueStudents} 名学生。`
  };
}
