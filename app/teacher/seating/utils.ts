import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import { buildSeatPairs, getAssignedStudentIds, getFrontRowCount } from "@/lib/seat-plan-utils";
import {
  STUDENT_GENDER_LABELS
} from "@/lib/student-persona-options";
import type { AiOptions, PlanSummary, SeatPlan, TeacherSeatingStudent } from "./types";

export const DEFAULT_AI_OPTIONS: AiOptions = {
  balanceGender: true,
  pairByScoreComplement: true,
  respectHeightGradient: true
};

export const LAYOUT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

export function getTeacherSeatingRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续配置学期排座。";
  }
  if (lower === "class not found" || (status === 404 && lower === "not found")) {
    return "当前班级不存在，或你已失去该班级的排座权限。";
  }
  if (lower === "locked seat studentid is required" || /^body\.lockedseats\[\d+\]\.studentid (must be at least 1 chars|cannot be empty)$/.test(lower)) {
    return "锁定座位时必须保留学生信息。";
  }
  if (lower === "locked seat student must belong to class") {
    return "锁定的学生已不在当前班级中，请刷新后重试。";
  }
  if (lower === "duplicate locked seat position") {
    return "锁定座位中存在重复位置，请检查后重试。";
  }
  if (lower === "duplicate locked seat student" || lower === "duplicate student assignment") {
    return "同一名学生不能被分配到多个座位。";
  }
  if (lower === "duplicate seat position") {
    return "座位表中存在重复位置，请检查后重试。";
  }
  if (
    lower === "rows must be between 1 and 12" ||
    lower === "columns must be between 1 and 12" ||
    /^body\.(rows|columns) must be (>= 1|<= 12)$/.test(lower)
  ) {
    return "排座行列数需在 1 到 12 之间。";
  }
  if (
    lower === "locked seat position out of range" ||
    lower === "seat position out of range" ||
    /^body\.(lockedseats|seats)\[\d+\]\.(row|column) must be (>= 1|<= 12)$/.test(lower)
  ) {
    return "座位位置超出当前排座网格，请重新调整。";
  }
  if (
    lower === "seat position must be integer" ||
    /^body\.(rows|columns) must be an integer$/.test(lower) ||
    /^body\.(lockedseats|seats)\[\d+\]\.(row|column) must be an integer$/.test(lower)
  ) {
    return "排座的行列位置必须使用整数。";
  }
  if (lower === "body.classid must be at least 1 chars" || lower === "body.classid cannot be empty") {
    return "请先选择班级后再操作排座。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function isMissingTeacherSeatingClassError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();
  return requestMessage === "class not found" || (status === 404 && requestMessage === "not found");
}

export function getStudentDisplayName(student: TeacherSeatingStudent | null | undefined) {
  if (!student) return "未安排";
  return student.preferredName || student.name;
}

export function isFrontPriorityStudent(student: TeacherSeatingStudent | null | undefined) {
  if (!student) return false;
  return student.eyesightLevel === "front_preferred" || student.seatPreference === "front";
}

export function isFocusPriorityStudent(student: TeacherSeatingStudent | null | undefined) {
  if (!student) return false;
  return student.focusSupport === "needs_focus";
}

export function summarizePlan(plan: SeatPlan | null, students: TeacherSeatingStudent[], lockedSeatCount = 0) {
  if (!plan) return null;
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const frontRowCount = getFrontRowCount(plan.rows);
  const focusPriorityRows = Math.min(plan.rows, Math.max(frontRowCount, 2));
  const assignedIds = getAssignedStudentIds(plan.seats);
  let scoreComplementPairCount = 0;
  let mixedGenderPairCount = 0;

  buildSeatPairs(plan.seats).forEach((pair) => {
    if (pair.length < 2) return;
    const leftStudent = pair[0].studentId ? studentMap.get(pair[0].studentId) : null;
    const rightStudent = pair[1].studentId ? studentMap.get(pair[1].studentId) : null;
    if (!leftStudent || !rightStudent) return;

    if (Math.abs(leftStudent.placementScore - rightStudent.placementScore) >= 15) {
      scoreComplementPairCount += 1;
    }
    if (
      leftStudent.gender &&
      rightStudent.gender &&
      leftStudent.gender !== "undisclosed" &&
      rightStudent.gender !== "undisclosed" &&
      leftStudent.gender !== rightStudent.gender
    ) {
      mixedGenderPairCount += 1;
    }
  });

  return {
    studentCount: students.length,
    seatCapacity: plan.rows * plan.columns,
    assignedCount: assignedIds.length,
    unassignedCount: Math.max(0, students.length - assignedIds.length),
    occupancyRate: plan.rows * plan.columns ? Math.round((assignedIds.length / (plan.rows * plan.columns)) * 100) : 0,
    frontPriorityStudentCount: students.filter((student) => isFrontPriorityStudent(student)).length,
    frontPrioritySatisfiedCount: plan.seats.filter((seat) => {
      if (seat.row > frontRowCount || !seat.studentId) return false;
      return isFrontPriorityStudent(studentMap.get(seat.studentId));
    }).length,
    focusPriorityStudentCount: students.filter((student) => isFocusPriorityStudent(student)).length,
    focusPrioritySatisfiedCount: plan.seats.filter((seat) => {
      if (seat.row > focusPriorityRows || !seat.studentId) return false;
      return isFocusPriorityStudent(studentMap.get(seat.studentId));
    }).length,
    scoreComplementPairCount,
    mixedGenderPairCount,
    lowCompletenessCount: students.filter((student) => student.profileCompleteness < 70).length,
    inferredScoreCount: students.filter((student) => student.scoreSource === "completion").length,
    lockedSeatCount
  } satisfies PlanSummary;
}

export function getPerformanceTone(band: TeacherSeatingStudent["performanceBand"]) {
  if (band === "high") return "#027a48";
  if (band === "medium") return "#b54708";
  return "#b42318";
}

export function buildStudentOptionLabel(student: TeacherSeatingStudent) {
  const genderLabel = student.gender ? STUDENT_GENDER_LABELS[student.gender] : "未填性别";
  const heightLabel = student.heightCm ? `${student.heightCm}cm` : "未填身高";
  return `${getStudentDisplayName(student)} · ${student.placementScore}分 · ${genderLabel} · ${heightLabel}`;
}

export function buildFollowUpChecklist(params: {
  classLabel: string;
  studentsNeedingProfileReminder: TeacherSeatingStudent[];
  watchStudents: TeacherSeatingStudent[];
  summary: PlanSummary | null;
  lockedSeatCount: number;
}) {
  const lines = [
    `班级：${params.classLabel}`,
    `资料待补：${params.studentsNeedingProfileReminder.length} 人`,
    `前排仍需关注：${Math.max(0, (params.summary?.frontPriorityStudentCount ?? 0) - (params.summary?.frontPrioritySatisfiedCount ?? 0))} 人`,
    `低干扰仍需关注：${Math.max(0, (params.summary?.focusPriorityStudentCount ?? 0) - (params.summary?.focusPrioritySatisfiedCount ?? 0))} 人`,
    `锁定座位：${params.lockedSeatCount} 个`
  ];

  if (params.studentsNeedingProfileReminder.length) {
    lines.push(
      `待补资料学生：${params.studentsNeedingProfileReminder
        .slice(0, 8)
        .map((student) => `${getStudentDisplayName(student)}（${student.missingProfileFields.join("/ ")}）`)
        .join("；")}`
    );
  }

  if (params.watchStudents.length) {
    lines.push(
      `重点观察：${params.watchStudents
        .slice(0, 6)
        .map((student) => {
          const reasons = [] as string[];
          if (isFrontPriorityStudent(student)) reasons.push("前排关注");
          if (isFocusPriorityStudent(student)) reasons.push("低干扰优先");
          if (student.missingProfileFields.length) reasons.push("资料待补");
          return `${getStudentDisplayName(student)}（${reasons.join("/")}）`;
        })
        .join("；")}`
    );
  }

  return lines.join("\n");
}
