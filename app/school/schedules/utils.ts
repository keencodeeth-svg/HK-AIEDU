import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { SchoolScheduleTemplate } from "@/lib/school-schedule-templates";
import type { TeacherScheduleRule } from "@/lib/teacher-schedule-rules";
import type {
  AiScheduleFormState,
  ScheduleFormState,
  ScheduleViewItem,
  TeacherRuleFormState,
  TeacherUnavailableFormState,
  TemplateFormState
} from "./types";

export const WEEKDAY_OPTIONS = [
  { value: "1", label: "周一" },
  { value: "2", label: "周二" },
  { value: "3", label: "周三" },
  { value: "4", label: "周四" },
  { value: "5", label: "周五" },
  { value: "6", label: "周六" },
  { value: "7", label: "周日" }
] as const;

export const fieldStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)",
  background: "var(--card)",
  color: "var(--ink)"
} as const;

export const EMPTY_FORM: ScheduleFormState = {
  classId: "",
  weekday: "1",
  startTime: "08:00",
  endTime: "08:45",
  slotLabel: "",
  room: "",
  campus: "",
  focusSummary: "",
  note: ""
};

export const DEFAULT_AI_FORM: AiScheduleFormState = {
  mode: "fill_missing",
  weeklyLessonsPerClass: "5",
  lessonDurationMinutes: "45",
  periodsPerDay: "6",
  dayStartTime: "08:00",
  shortBreakMinutes: "10",
  lunchBreakAfterPeriod: "4",
  lunchBreakMinutes: "60",
  campus: "主校区",
  weekdays: ["1", "2", "3", "4", "5"]
};

export const DEFAULT_TEMPLATE_FORM: TemplateFormState = {
  grade: "",
  subject: "",
  weeklyLessonsPerClass: "5",
  lessonDurationMinutes: "45",
  periodsPerDay: "6",
  dayStartTime: "08:00",
  shortBreakMinutes: "10",
  lunchBreakAfterPeriod: "4",
  lunchBreakMinutes: "60",
  campus: "主校区",
  weekdays: ["1", "2", "3", "4", "5"]
};

export const DEFAULT_TEACHER_RULE_FORM: TeacherRuleFormState = {
  teacherId: "",
  weeklyMaxLessons: "",
  maxConsecutiveLessons: "",
  minCampusGapMinutes: ""
};

export const DEFAULT_TEACHER_UNAVAILABLE_FORM: TeacherUnavailableFormState = {
  teacherId: "",
  weekday: "1",
  startTime: "08:00",
  endTime: "08:45",
  reason: ""
};

export function formatSubjectLine(item: Pick<ScheduleViewItem, "subject" | "grade" | "teacherName" | "teacherId">) {
  return `${item.subject} · ${item.grade} 年级 · ${item.teacherName ?? item.teacherId ?? "未绑定教师"}`;
}

export function toOptionalNumber(value: string) {
  const next = value.trim();
  return next ? Number(next) : undefined;
}

export function addMinutesToTime(time: string, minutes: number) {
  const [hourPart, minutePart] = time.split(":").map(Number);
  if (!Number.isFinite(hourPart) || !Number.isFinite(minutePart) || !Number.isFinite(minutes)) {
    return time;
  }
  const totalMinutes = hourPart * 60 + minutePart + minutes;
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const nextHour = String(Math.floor(normalized / 60)).padStart(2, "0");
  const nextMinute = String(normalized % 60).padStart(2, "0");
  return `${nextHour}:${nextMinute}`;
}

export function formatTeacherRuleSummary(rule: TeacherScheduleRule) {
  const parts: string[] = [];
  if (rule.weeklyMaxLessons) parts.push(`周上限 ${rule.weeklyMaxLessons} 节`);
  if (rule.maxConsecutiveLessons) parts.push(`最多连堂 ${rule.maxConsecutiveLessons} 节`);
  if (rule.minCampusGapMinutes) parts.push(`跨校区缓冲 ${rule.minCampusGapMinutes} 分钟`);
  return parts.join(" · ");
}

export function applyTemplateToAiForm(template: SchoolScheduleTemplate): AiScheduleFormState {
  return {
    mode: "fill_missing",
    weeklyLessonsPerClass: String(template.weeklyLessonsPerClass),
    lessonDurationMinutes: String(template.lessonDurationMinutes),
    periodsPerDay: String(template.periodsPerDay),
    dayStartTime: template.dayStartTime,
    shortBreakMinutes: String(template.shortBreakMinutes),
    lunchBreakAfterPeriod: template.lunchBreakAfterPeriod ? String(template.lunchBreakAfterPeriod) : "",
    lunchBreakMinutes: String(template.lunchBreakMinutes),
    campus: template.campus ?? "主校区",
    weekdays: template.weekdays.map((item) => String(item))
  };
}

export function getSchoolSchedulesRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const normalizedMessage = requestMessage.toLowerCase();

  if (status === 401) {
    return "登录状态已失效，请重新登录后继续管理课程表。";
  }
  if (normalizedMessage.startsWith("class not found")) {
    return "所选班级不存在，请刷新班级列表后重试。";
  }
  if (normalizedMessage === "schedule not found") {
    return "该课程节次不存在，可能已被其他管理员删除。";
  }
  if (normalizedMessage === "schedule template not found") {
    return "课时模板不存在，可能已被删除。";
  }
  if (normalizedMessage === "teacher schedule rule not found") {
    return "教师排课规则不存在，可能已被删除。";
  }
  if (normalizedMessage === "teacher unavailable slot not found") {
    return "教师禁排时段不存在，可能已被删除。";
  }
  if (normalizedMessage === "ai schedule preview not found") {
    return "这次 AI 预演已失效，请重新预演后再写入。";
  }
  if (normalizedMessage === "ai schedule operation not found") {
    return "没有找到可回滚的 AI 排课记录。";
  }
  if (normalizedMessage === "schoolid required for platform admin") {
    return "请先选择学校后再管理课程表。";
  }
  if (normalizedMessage === "school not bound") {
    return "当前账号尚未绑定学校，暂时无法管理课程表。";
  }
  if (normalizedMessage === "cross school access denied") {
    return "当前账号不能访问这所学校的课程表数据，请切换到有权限的学校后再试。";
  }
  if (status === 403 || normalizedMessage === "unauthorized" || normalizedMessage === "forbidden") {
    return "当前账号没有课程表管理权限，请使用学校管理员或平台主管账号登录。";
  }
  if (status === 404) {
    return fallback;
  }

  return getRequestErrorMessage(error, fallback);
}

export function isMissingSchoolScheduleClassError(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase().startsWith("class not found");
}

export function isMissingSchoolScheduleSessionError(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase() === "schedule not found";
}

export function isMissingSchoolScheduleTemplateError(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase() === "schedule template not found";
}

export function isMissingSchoolScheduleTeacherRuleError(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase() === "teacher schedule rule not found";
}

export function isMissingSchoolScheduleTeacherUnavailableError(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase() === "teacher unavailable slot not found";
}

export function isMissingSchoolSchedulePreviewError(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase() === "ai schedule preview not found";
}

export function isMissingSchoolScheduleOperationError(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase() === "ai schedule operation not found";
}
