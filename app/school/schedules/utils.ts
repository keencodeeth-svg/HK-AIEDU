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
