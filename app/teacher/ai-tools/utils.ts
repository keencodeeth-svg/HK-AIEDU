import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  ClassItem,
  KnowledgePoint,
  OutlineFormState,
  PaperFormState,
  PaperQuickFixAction,
  QuestionCheckFormState,
  ReviewPackDispatchSummary,
  ReviewPackFailedItem,
  WrongReviewFormState
} from "./types";

type TeacherAiToolsErrorScope =
  | "bootstrap"
  | "paper"
  | "outline"
  | "wrong_review"
  | "review_pack"
  | "review_pack_dispatch"
  | "question_check";

export function aiRiskLabel(level?: string) {
  if (level === "high") return "高";
  if (level === "medium") return "中";
  return "低";
}

export function resolveTeacherAiToolsClassId(currentClassId: string, classes: Array<{ id: string }>) {
  if (currentClassId && classes.some((item) => item.id === currentClassId)) {
    return currentClassId;
  }
  return classes[0]?.id ?? "";
}

export function hasTeacherAiToolsClassChanged(previousClassId: string, nextClassId: string) {
  return Boolean(previousClassId && previousClassId !== nextClassId);
}

export function filterTeacherAiToolsKnowledgePoints(
  knowledgePoints: KnowledgePoint[],
  klass: ClassItem | undefined
) {
  if (!klass) {
    return [];
  }
  return knowledgePoints.filter(
    (item) => item.subject === klass.subject && item.grade === klass.grade
  );
}

export function pruneTeacherAiToolsKnowledgePointIds(
  currentIds: string[],
  availableIds: Set<string>
) {
  return currentIds.filter((id) => availableIds.has(id));
}

export function resetTeacherAiToolsPaperFormScope(
  form: PaperFormState,
  nextClassId = ""
) {
  return {
    ...form,
    classId: nextClassId,
    knowledgePointIds: []
  };
}

export function resetTeacherAiToolsOutlineFormScope(
  form: OutlineFormState,
  nextClassId = ""
) {
  return {
    ...form,
    classId: nextClassId,
    knowledgePointIds: []
  };
}

export function resetTeacherAiToolsWrongFormScope(
  form: WrongReviewFormState,
  nextClassId = ""
) {
  return {
    ...form,
    classId: nextClassId
  };
}

type TeacherAiToolsDerivedStateInput = {
  classes: ClassItem[];
  knowledgePoints: KnowledgePoint[];
  paperForm: PaperFormState;
  outlineForm: OutlineFormState;
  checkForm: QuestionCheckFormState;
};

export function getTeacherAiToolsDerivedState({
  classes,
  knowledgePoints,
  paperForm,
  outlineForm,
  checkForm
}: TeacherAiToolsDerivedStateInput) {
  const paperClass = classes.find((item) => item.id === paperForm.classId);
  const outlineClass = classes.find((item) => item.id === outlineForm.classId);
  const paperPoints = filterTeacherAiToolsKnowledgePoints(knowledgePoints, paperClass);
  const outlinePoints = filterTeacherAiToolsKnowledgePoints(knowledgePoints, outlineClass);
  const paperPointIdSet = new Set(paperPoints.map((kp) => kp.id));
  const outlinePointIdSet = new Set(outlinePoints.map((kp) => kp.id));
  const checkPreviewOptions = buildTeacherAiToolsCheckPreviewOptions(checkForm.options);

  return {
    paperPoints,
    outlinePoints,
    paperPointIdSet,
    outlinePointIdSet,
    checkPreviewOptions,
    hasCheckPreview: hasTeacherAiToolsCheckPreview(checkForm, checkPreviewOptions)
  };
}

export function buildTeacherAiToolsCheckPreviewOptions(options: string[]) {
  return options.map((item) => item.trim()).filter(Boolean);
}

export function hasTeacherAiToolsCheckPreview(
  checkForm: QuestionCheckFormState,
  checkPreviewOptions: string[]
) {
  return Boolean(
    checkForm.stem.trim() ||
      checkPreviewOptions.length ||
      checkForm.answer.trim() ||
      checkForm.explanation.trim()
  );
}

export function applyTeacherPaperQuickFix(form: PaperFormState, action: PaperQuickFixAction) {
  const nextForm: PaperFormState = { ...form };
  let hint = "";

  if (action === "clear_filters") {
    nextForm.knowledgePointIds = [];
    nextForm.difficulty = "all";
    nextForm.questionType = "all";
    hint = "已清空知识点/难度/题型筛选，正在重试。";
  } else if (action === "switch_ai") {
    nextForm.mode = "ai";
    hint = "已切换为 AI 补题模式，正在重试。";
  } else if (action === "reduce_count") {
    if (nextForm.questionCount <= 0) {
      nextForm.questionCount = Math.max(6, Math.floor(nextForm.durationMinutes / 3));
    } else {
      nextForm.questionCount = Math.max(5, nextForm.questionCount - 3);
    }
    hint = `已降低题量到 ${nextForm.questionCount} 题，正在重试。`;
  } else if (action === "allow_isolated") {
    nextForm.includeIsolated = true;
    hint = "已允许使用隔离池高风险题，正在重试（请人工复核）。";
  }

  return {
    nextForm,
    hint
  };
}

export function buildTeacherReviewPackDispatchMessage(
  summary: ReviewPackDispatchSummary | null | undefined,
  mode: "single" | "batch" | "retry" = "single"
) {
  if (!summary || summary.created <= 0) {
    return null;
  }
  if (mode === "retry") {
    return `失败项重试完成：新增下发 ${summary.created}/${summary.requested} 条，自动放宽 ${summary.relaxedCount ?? 0} 条。`;
  }

  const prefix = mode === "batch" ? "已批量下发" : "已下发";
  const quality = summary.qualityGovernance;
  return `${prefix} ${summary.created}/${summary.requested} 条，通知学生 ${summary.studentsNotified} 人，家长 ${summary.parentsNotified} 人。${
    quality && !quality.includeIsolated ? ` 已排除隔离池候选 ${quality.isolatedExcludedCount} 次。` : ""
  }${(summary.relaxedCount ?? 0) > 0 ? ` 已自动放宽 ${summary.relaxedCount} 条。` : ""}`;
}

export function summarizeTeacherReviewPackFailedItems(failedItems: ReviewPackFailedItem[], prefix: string) {
  if (!failedItems.length) {
    return null;
  }
  const brief = failedItems
    .slice(0, 3)
    .map((item) => `${item?.title ?? "未命名复练"}：${item?.reason ?? prefix}`)
    .join("；");
  return `${prefix} ${failedItems.length} 条：${brief}`;
}

export function isMissingTeacherAiToolsClassError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();
  return requestMessage === "class not found" || (status === 404 && requestMessage === "not found");
}

export function isMissingTeacherAiToolsQuestionError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}

export function getTeacherAiToolsRequestMessage(
  error: unknown,
  fallback: string,
  scope: TeacherAiToolsErrorScope = "bootstrap"
) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续使用 AI 工具。";
  }
  if (scope === "question_check" && isMissingTeacherAiToolsQuestionError(error)) {
    return "当前题目不存在，请刷新题库后重试。";
  }
  if (isMissingTeacherAiToolsClassError(error)) {
    return "当前班级不存在，或你已失去该班级的操作权限。";
  }
  if (lower === "missing fields") {
    return "请先补全题干、选项和答案后再做纠错检查。";
  }
  if (lower === "body.items must contain at least 1 items") {
    return "请至少选择 1 条复练单后再下发。";
  }
  if (requestMessage === "当前班级题库为空，无法布置复练单") {
    return "当前班级题库为空，暂时无法布置复练单。";
  }
  if (requestMessage === "组卷失败：未生成到可用题目") {
    return "当前条件下未生成到可用题目，请放宽筛选或切换模式后重试。";
  }

  return getRequestErrorMessage(error, fallback);
}
