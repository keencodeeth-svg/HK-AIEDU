import {
  getRequestErrorMessage,
  getRequestStatus
} from "@/lib/client-request";
import { SUBJECT_LABELS, getGradeLabel } from "@/lib/constants";
import type {
  ClassItem,
  ClassStudent,
  Difficulty,
  FormState,
  KnowledgePoint,
  PoolRisk,
  PublishMode,
  ScheduleStatus
} from "./types";

export const INITIAL_TEACHER_EXAM_CREATE_FORM: FormState = {
  classId: "",
  title: "",
  description: "",
  publishMode: "teacher_assigned",
  antiCheatLevel: "basic",
  studentIds: [],
  startAt: "",
  endAt: getDefaultEndAt(),
  durationMinutes: 60,
  questionCount: 10,
  knowledgePointId: "",
  difficulty: "medium",
  questionType: "choice",
  includeIsolated: false
};

export const DIFFICULTY_OPTIONS: Array<{ value: Difficulty; label: string }> = [
  { value: "easy", label: "简单" },
  { value: "medium", label: "中等" },
  { value: "hard", label: "困难" }
];

export const QUESTION_TYPE_OPTIONS = [
  { value: "choice", label: "选择题" },
  { value: "fill", label: "填空题" },
  { value: "qa", label: "问答题" }
];

export const PUBLISH_MODE_OPTIONS: Array<{ value: PublishMode; label: string }> = [
  { value: "teacher_assigned", label: "班级统一发布" },
  { value: "targeted", label: "定向发布" }
];

export function getDefaultEndAt() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function formatLoadedTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getQuestionTypeLabel(value: string) {
  return QUESTION_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export function getDifficultyLabel(value: Difficulty) {
  return DIFFICULTY_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export function getPublishModeLabel(value: PublishMode) {
  return PUBLISH_MODE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export function formatClassLabel(klass: ClassItem | undefined) {
  if (!klass) return "未选择班级";
  return `${klass.name} · ${SUBJECT_LABELS[klass.subject] ?? klass.subject} · ${getGradeLabel(klass.grade)}`;
}

export function normalizeCreateErrorMessage(message: string) {
  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (lower === "endat must be after startat") return "截止时间必须晚于开始时间。";
  if (lower === "invalid datetime format") return "时间格式不正确，请重新选择开始和截止时间。";
  if (lower === "questioncount must be greater than 0") return "题目数量至少为 1。";
  if (lower === "studentids required when publishmode is targeted") return "定向发布至少需要选择 1 名学生。";
  if (lower === "body.studentids must contain at least 1 items") return "定向发布至少需要选择 1 名学生。";
  if (lower === "studentids must belong to class") return "定向学生必须属于当前班级。";
  if (lower === "class not found" || lower === "not found") return "当前班级不存在或你没有发布权限。";
  if (lower === "questionids contains invalid item") return "所选题目中包含无效题目，请刷新题库后重新选择。";
  if (lower === "questionids must match class subject and grade") {
    return "所选题目与当前班级的学科或年级不匹配，请重新选择。";
  }
  if (normalized === "题库数量不足，无法生成考试") {
    return "当前题库数量不足，无法按现有条件生成考试。";
  }
  if (normalized.startsWith("题目包含隔离池高风险题")) {
    return `${normalized}。`;
  }
  if (lower === "body.classid must be at least 1 chars") return "请先选择班级后再发布考试。";
  if (lower === "body.title must be at least 1 chars" || lower === "body.title cannot be empty") {
    return "考试标题不能为空。";
  }
  if (lower === "body.endat must be at least 1 chars" || lower === "body.endat cannot be empty") {
    return "请先设置截止时间后再发布考试。";
  }
  return normalized;
}

export function getTeacherExamCreateRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const normalizedMessage = normalizeCreateErrorMessage(requestMessage);

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续发布考试。";
  }
  if (
    requestMessage.toLowerCase() === "class not found" ||
    (status === 404 && requestMessage.toLowerCase() === "not found")
  ) {
    return "当前班级不存在，或你已失去该班级的发布权限。";
  }
  return normalizedMessage || fallback;
}

export function isTeacherExamCreateClassMissingError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();
  return requestMessage === "class not found" || (status === 404 && requestMessage === "not found");
}

export function syncTeacherExamCreateFormWithConfig(
  prev: FormState,
  nextClasses: ClassItem[],
  nextKnowledgePoints: KnowledgePoint[]
) {
  const nextClassId =
    prev.classId && nextClasses.some((item) => item.id === prev.classId)
      ? prev.classId
      : nextClasses[0]?.id ?? "";
  const nextClass = nextClasses.find((item) => item.id === nextClassId);
  const nextKnowledgePointId =
    prev.knowledgePointId &&
    nextClass &&
    nextKnowledgePoints.some(
      (item) =>
        item.id === prev.knowledgePointId &&
        item.subject === nextClass.subject &&
        item.grade === nextClass.grade
    )
      ? prev.knowledgePointId
      : "";

  return {
    nextClassId,
    nextForm: {
      ...prev,
      classId: nextClassId,
      knowledgePointId: nextKnowledgePointId,
      studentIds: nextClassId === prev.classId ? prev.studentIds : [],
      endAt: prev.endAt || getDefaultEndAt()
    }
  };
}

export function pruneTeacherExamCreateStudentIds(studentIds: string[], students: Array<{ id: string }>) {
  return studentIds.filter((studentId) =>
    students.some((student) => student.id === studentId)
  );
}

export function getTeacherExamCreateTargetCount(
  publishMode: PublishMode,
  selectedStudentCount: number,
  classStudentsCount: number
) {
  return publishMode === "targeted" ? selectedStudentCount : classStudentsCount;
}

export function buildTeacherExamCreateScopeLabel(
  selectedPoint: KnowledgePoint | null,
  subject: string | undefined,
  questionCount: number
) {
  if (selectedPoint) {
    return `${selectedPoint.chapter} · ${selectedPoint.title} · ${questionCount} 题`;
  }
  return `${SUBJECT_LABELS[subject ?? ""] ?? "当前学科"}全范围 · ${questionCount} 题`;
}

export function buildTeacherExamCreateTargetLabel(
  publishMode: PublishMode,
  targetCount: number,
  classStudentsCount: number
) {
  return publishMode === "targeted"
    ? `定向 ${targetCount}/${classStudentsCount || 0} 人`
    : `全班 ${classStudentsCount || 0} 人`;
}

export function getTeacherExamCreateCanSubmit(options: {
  classId: string;
  title: string;
  publishMode: PublishMode;
  scheduleReady: boolean;
  configLoading: boolean;
  saving: boolean;
  targetCount: number;
  studentsLoading: boolean;
}) {
  const {
    classId,
    title,
    publishMode,
    scheduleReady,
    configLoading,
    saving,
    targetCount,
    studentsLoading
  } = options;

  return (
    Boolean(classId && title.trim()) &&
    scheduleReady &&
    !configLoading &&
    !saving &&
    !(publishMode === "targeted" && targetCount === 0) &&
    !(publishMode === "targeted" && studentsLoading)
  );
}

export function getTeacherExamCreatePageDerivedState(options: {
  classes: ClassItem[];
  knowledgePoints: KnowledgePoint[];
  classStudents: ClassStudent[];
  form: FormState;
  configLoading: boolean;
  saving: boolean;
  studentsLoading: boolean;
  lastLoadedAt: string | null;
}) {
  const selectedClass =
    options.classes.find((item) => item.id === options.form.classId);
  const filteredPoints = selectedClass
    ? options.knowledgePoints.filter(
        (item) =>
          item.subject === selectedClass.subject &&
          item.grade === selectedClass.grade
      )
    : [];
  const selectedPoint =
    filteredPoints.find((item) => item.id === options.form.knowledgePointId) ??
    null;
  const scheduleStatus = getScheduleStatus(options.form);
  const poolRisk = getPoolRisk(options.form, filteredPoints);
  const targetCount = getTeacherExamCreateTargetCount(
    options.form.publishMode,
    options.form.studentIds.length,
    options.classStudents.length
  );

  return {
    selectedClass,
    filteredPoints,
    selectedPoint,
    scheduleStatus,
    poolRisk,
    targetCount,
    canSubmit: getTeacherExamCreateCanSubmit({
      classId: options.form.classId,
      title: options.form.title,
      publishMode: options.form.publishMode,
      scheduleReady: scheduleStatus.canSubmit,
      configLoading: options.configLoading,
      saving: options.saving,
      targetCount,
      studentsLoading: options.studentsLoading
    }),
    classLabel: formatClassLabel(selectedClass),
    scopeLabel: buildTeacherExamCreateScopeLabel(
      selectedPoint,
      selectedClass?.subject,
      options.form.questionCount
    ),
    targetLabel: buildTeacherExamCreateTargetLabel(
      options.form.publishMode,
      targetCount,
      options.classStudents.length
    ),
    lastLoadedAtLabel: formatLoadedTime(options.lastLoadedAt)
  };
}

export function buildTeacherExamCreateSubmitPayload(form: FormState) {
  return {
    classId: form.classId,
    title: form.title.trim(),
    description: form.description.trim(),
    publishMode: form.publishMode,
    antiCheatLevel: form.antiCheatLevel,
    studentIds: form.publishMode === "targeted" ? form.studentIds : undefined,
    startAt: form.startAt || undefined,
    endAt: form.endAt || undefined,
    durationMinutes: form.durationMinutes || undefined,
    questionCount: form.questionCount,
    knowledgePointId: form.knowledgePointId || undefined,
    difficulty: form.difficulty || undefined,
    questionType: form.questionType || undefined,
    includeIsolated: form.includeIsolated
  };
}

export function buildTeacherExamCreateSuccessMessage(
  message: string | undefined,
  warnings: string[] | undefined
) {
  const normalizedWarnings = Array.isArray(warnings)
    ? warnings.filter((warning) => Boolean(warning))
    : [];
  const baseMessage = message ?? "考试发布成功";

  return normalizedWarnings.length
    ? `${baseMessage} ${normalizedWarnings.join("；")}`
    : baseMessage;
}

export function getScheduleStatus(form: FormState): ScheduleStatus {
  const now = Date.now();
  const endAtTs = new Date(form.endAt).getTime();

  if (!form.endAt) {
    return {
      tone: "error",
      title: "截止时间未设置",
      description: "考试必须有明确的截止时间，否则学生端无法判断可作答区间。",
      summary: "未设置截止时间",
      meta: "先设置截止时间，再确认是否需要开始时间。",
      canSubmit: false
    };
  }

  if (!Number.isFinite(endAtTs)) {
    return {
      tone: "error",
      title: "截止时间格式不正确",
      description: "请重新选择截止时间，避免学生端出现不可作答或提前结束。",
      summary: "截止时间格式异常",
      meta: "建议重新选择截止时间。",
      canSubmit: false
    };
  }

  if (endAtTs <= now) {
    return {
      tone: "error",
      title: "截止时间已经过去",
      description: "当前配置会让考试一发布就立刻失效，学生无法正常进入作答。",
      summary: "截止时间已过",
      meta: "把截止时间调到未来，再继续发布。",
      canSubmit: false
    };
  }

  if (!form.startAt) {
    const hoursUntilEnd = Math.ceil((endAtTs - now) / (60 * 60 * 1000));
    const urgent = hoursUntilEnd <= 24;
    return {
      tone: urgent ? "info" : "success",
      title: urgent ? "考试将立即开放，且关闭时间较近" : "考试将立即开放给目标学生",
      description: urgent
        ? "没有设置开始时间意味着学生现在就能看到这场考试。如果这是今天课堂内测，这种方式更直接。"
        : "当前设置适合直接开考，老师发布后学生即可进入作答。",
      summary: urgent ? "立即开放，24 小时内截止" : "立即开放",
      meta: `截止 ${new Date(form.endAt).toLocaleString("zh-CN")} · 时长 ${form.durationMinutes} 分钟`,
      canSubmit: true
    };
  }

  const startAtTs = new Date(form.startAt).getTime();
  if (!Number.isFinite(startAtTs)) {
    return {
      tone: "error",
      title: "开始时间格式不正确",
      description: "请重新选择开始时间，确保发布时间和作答窗口一致。",
      summary: "开始时间格式异常",
      meta: "建议重新选择开始时间。",
      canSubmit: false
    };
  }

  if (startAtTs >= endAtTs) {
    return {
      tone: "error",
      title: "开始时间晚于截止时间",
      description: "这会让考试在时间上自相矛盾，学生端会直接无法作答。",
      summary: "时间窗口冲突",
      meta: "确保开始时间早于截止时间。",
      canSubmit: false
    };
  }

  const startsSoon = startAtTs - now <= 24 * 60 * 60 * 1000;
  return {
    tone: startsSoon ? "info" : "success",
    title: startsSoon ? "考试将在 24 小时内开放" : "发布时间已排好",
    description: startsSoon
      ? "这适合明确课堂开考时点的场景。发布后学生会在开始时间到达时进入可作答状态。"
      : "当前时间窗口更适合阶段测或跨天安排，学生会按计划收到并按时进入。",
    summary: startsSoon ? "即将开放" : "已排期",
    meta: `开始 ${new Date(form.startAt).toLocaleString("zh-CN")} · 截止 ${new Date(form.endAt).toLocaleString("zh-CN")}`,
    canSubmit: true
  };
}

export function getPoolRisk(form: FormState, filteredPoints: KnowledgePoint[]): PoolRisk {
  if (filteredPoints.length === 0) {
    return {
      tone: "info",
      label: "待确认",
      title: "当前班级还没有可选知识点目录",
      description: "你仍然可以按班级题库直接组卷，但知识点级精确控制暂时不可用。",
      meta: "如果后续题量不足，优先减少难度和题型限制。"
    };
  }

  let narrowness = 0;
  if (form.knowledgePointId) narrowness += 2;
  if (form.difficulty === "hard") narrowness += 1;
  if (form.questionType !== "choice") narrowness += 1;
  if (form.questionCount >= 16) narrowness += 1;
  if (!form.includeIsolated) narrowness += 1;
  if (filteredPoints.length <= 6) narrowness += 1;

  if (narrowness >= 5) {
    return {
      tone: "error",
      label: "高",
      title: "当前筛选比较窄，可能触发自动放宽条件",
      description: "如果题库不够，系统会依次放宽题型、难度和知识点。现在就应该预期这件事，而不是等提交失败后再猜原因。",
      meta: "优先减少题量、清空知识点，或改用中等难度。"
    };
  }

  if (narrowness >= 3) {
    return {
      tone: "info",
      label: "中",
      title: "当前题库约束适中，但仍需留意题量",
      description: "这类配置通常能组出卷，但当班级题库较薄或知识点覆盖少时，仍有可能触发部分放宽。",
      meta: "如果追求稳定发布，先从 10-12 题开始更稳。"
    };
  }

  return {
    tone: "success",
    label: "低",
    title: "当前筛选更偏稳妥，发布成功率较高",
    description: "以班级全量题库为主，系统更容易在不放宽条件的前提下完成组卷。",
    meta: "如果需要更精确的教学对齐，再逐步收窄知识点或题型。"
  };
}
