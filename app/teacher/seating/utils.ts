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
