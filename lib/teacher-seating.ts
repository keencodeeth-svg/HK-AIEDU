import { notFound } from "./api/http";
import { getAssignmentProgress, getAssignmentsByClass } from "./assignments";
import { getClassSeatPlan, type ClassSeatPlan } from "./class-seat-plans";
import { getClassById, getClassesByTeacher, getClassStudents, type ClassItem } from "./classes";
import {
  buildSeatGrid,
  buildSeatPairs,
  createSeatId,
  getAssignedStudentIds,
  getFrontRowCount,
  type SeatCell
} from "./seat-plan-utils";
import {
  calculateStudentPersonaCompleteness,
  getStudentPersonaTags,
  type StudentPersonaLike
} from "./student-persona-options";
import { listStudentPersonasByUserIds } from "./student-personas";

export type TeacherSeatingStudent = {
  id: string;
  name: string;
  email: string;
  grade?: string;
  preferredName?: string;
  gender?: StudentPersonaLike["gender"];
  heightCm?: number;
  eyesightLevel?: StudentPersonaLike["eyesightLevel"];
  seatPreference?: StudentPersonaLike["seatPreference"];
  personality?: StudentPersonaLike["personality"];
  strengths?: string;
  supportNotes?: string;
  completed: number;
  pending: number;
  overdue: number;
  late: number;
  avgScore: number;
  placementScore: number;
  scoreSource: "quiz" | "completion";
  performanceBand: "high" | "medium" | "low";
  profileCompleteness: number;
  missingProfileFields: string[];
  tags: string[];
};

export type TeacherSeatingPlanSummary = {
  studentCount: number;
  seatCapacity: number;
  assignedCount: number;
  unassignedCount: number;
  occupancyRate: number;
  frontPriorityStudentCount: number;
  frontPrioritySatisfiedCount: number;
  scoreComplementPairCount: number;
  mixedGenderPairCount: number;
  lowCompletenessCount: number;
  inferredScoreCount: number;
};

export type TeacherSeatingPageData = {
  classes: ClassItem[];
  class: ClassItem | null;
  students: TeacherSeatingStudent[];
  savedPlan: ClassSeatPlan | null;
  plan: ClassSeatPlan | null;
  recommendedLayout: { rows: number; columns: number } | null;
  summary: TeacherSeatingPlanSummary | null;
};

export type TeacherSeatingAiOptions = {
  balanceGender: boolean;
  pairByScoreComplement: boolean;
  respectHeightGradient: boolean;
};

function pickTeacherClass(classes: ClassItem[], teacherId: string, classId?: string) {
  if (!classes.length) return null;
  if (!classId) return classes[0];
  const klass = classes.find((item) => item.id === classId) ?? null;
  if (!klass || klass.teacherId !== teacherId) {
    notFound("class not found");
  }
  return klass;
}

function getRecommendedLayout(studentCount: number) {
  if (studentCount <= 0) {
    return { rows: 2, columns: 4 };
  }
  const columns = studentCount <= 8 ? 4 : studentCount <= 18 ? 6 : 8;
  return {
    rows: Math.max(2, Math.ceil(studentCount / columns)),
    columns
  };
}

function getPerformanceBand(score: number): TeacherSeatingStudent["performanceBand"] {
  if (score >= 85) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function isFrontPriority(student: TeacherSeatingStudent | null | undefined) {
  if (!student) return false;
  return student.eyesightLevel === "front_preferred" || student.seatPreference === "front";
}

function getSeatPositionKey(seat: SeatCell) {
  return `${seat.row}:${seat.column}`;
}

function buildDraftPlan(
  classId: string,
  teacherId: string,
  rows: number,
  columns: number,
  students: TeacherSeatingStudent[]
): ClassSeatPlan {
  const seats = buildSeatGrid(rows, columns).map((seat, index) => ({
    ...seat,
    seatId: seat.seatId || createSeatId(seat.row, seat.column),
    studentId: students[index]?.id
  }));
  const now = new Date().toISOString();

  return {
    id: `draft-${classId}`,
    classId,
    teacherId,
    rows,
    columns,
    seats,
    generatedBy: "manual",
    createdAt: now,
    updatedAt: now
  };
}

function buildPlacementScore(completed: number, pending: number, overdue: number) {
  return Math.max(40, Math.min(88, 68 + completed * 6 - pending * 3 - overdue * 8));
}

async function buildTeacherSeatingStudents(classId: string) {
  const [students, assignments] = await Promise.all([getClassStudents(classId), getAssignmentsByClass(classId)]);
  const personas = await listStudentPersonasByUserIds(students.map((student) => student.id));
  const personaMap = new Map(personas.map((persona) => [persona.userId, persona]));
  const progressLists = await Promise.all(assignments.map((assignment) => getAssignmentProgress(assignment.id)));
  const progressMaps = progressLists.map((list) => new Map(list.map((item) => [item.studentId, item])));
  const now = Date.now();

  return students.map((student) => {
    const persona = personaMap.get(student.id) ?? null;
    let completed = 0;
    let pending = 0;
    let overdue = 0;
    let late = 0;
    let quizScore = 0;
    let quizTotal = 0;

    assignments.forEach((assignment, index) => {
      const record = progressMaps[index]?.get(student.id) ?? null;
      const status = record?.status ?? "pending";
      const dueTime = new Date(assignment.dueDate).getTime();
      const completedAt = record?.completedAt ? new Date(record.completedAt).getTime() : null;

      if (status === "completed") {
        completed += 1;
        if (completedAt && completedAt > dueTime) {
          late += 1;
        }
      } else {
        pending += 1;
        if (dueTime < now) {
          overdue += 1;
        }
      }

      if (
        assignment.submissionType === "quiz" &&
        typeof record?.score === "number" &&
        typeof record?.total === "number" &&
        record.total > 0
      ) {
        quizScore += record.score;
        quizTotal += record.total;
      }
    });

    const avgScore = quizTotal ? Math.round((quizScore / quizTotal) * 100) : 0;
    const placementScore = quizTotal ? avgScore : buildPlacementScore(completed, pending, overdue);
    const completeness = calculateStudentPersonaCompleteness(persona);
    const tags = getStudentPersonaTags(persona);

    return {
      id: student.id,
      name: student.name,
      email: student.email,
      grade: student.grade,
      preferredName: persona?.preferredName,
      gender: persona?.gender,
      heightCm: persona?.heightCm,
      eyesightLevel: persona?.eyesightLevel,
      seatPreference: persona?.seatPreference,
      personality: persona?.personality,
      strengths: persona?.strengths,
      supportNotes: persona?.supportNotes,
      completed,
      pending,
      overdue,
      late,
      avgScore,
      placementScore,
      scoreSource: quizTotal ? "quiz" : "completion",
      performanceBand: getPerformanceBand(placementScore),
      profileCompleteness: completeness.percentage,
      missingProfileFields: completeness.missingFields,
      tags
    } satisfies TeacherSeatingStudent;
  });
}

export function buildTeacherSeatingPlanSummary(plan: ClassSeatPlan, students: TeacherSeatingStudent[]): TeacherSeatingPlanSummary {
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const assignedStudentIds = getAssignedStudentIds(plan.seats);
  const frontRowCount = getFrontRowCount(plan.rows);
  const seatPairs = buildSeatPairs(plan.seats);
  let scoreComplementPairCount = 0;
  let mixedGenderPairCount = 0;

  seatPairs.forEach((pair) => {
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

  const frontPrioritySatisfiedCount = plan.seats.filter((seat) => {
    if (seat.row > frontRowCount || !seat.studentId) return false;
    return isFrontPriority(studentMap.get(seat.studentId));
  }).length;

  return {
    studentCount: students.length,
    seatCapacity: plan.rows * plan.columns,
    assignedCount: assignedStudentIds.length,
    unassignedCount: Math.max(0, students.length - assignedStudentIds.length),
    occupancyRate: plan.rows * plan.columns ? Math.round((assignedStudentIds.length / (plan.rows * plan.columns)) * 100) : 0,
    frontPriorityStudentCount: students.filter((student) => isFrontPriority(student)).length,
    frontPrioritySatisfiedCount,
    scoreComplementPairCount,
    mixedGenderPairCount,
    lowCompletenessCount: students.filter((student) => student.profileCompleteness < 70).length,
    inferredScoreCount: students.filter((student) => student.scoreSource === "completion").length
  };
}

function buildTeacherSeatingDiagnostics(
  plan: ClassSeatPlan,
  students: TeacherSeatingStudent[],
  options?: TeacherSeatingAiOptions
) {
  const summary = buildTeacherSeatingPlanSummary(plan, students);
  const warnings: string[] = [];
  const insights: string[] = [];

  if (summary.unassignedCount > 0) {
    warnings.push(`当前座位容量不足，仍有 ${summary.unassignedCount} 名学生未分配座位。`);
  }
  if (summary.frontPriorityStudentCount > summary.frontPrioritySatisfiedCount) {
    warnings.push(
      `${summary.frontPriorityStudentCount - summary.frontPrioritySatisfiedCount} 名前排需求学生暂未全部进入前排。`
    );
  }
  if (summary.lowCompletenessCount > 0) {
    warnings.push(`有 ${summary.lowCompletenessCount} 名学生资料不完整，AI 无法充分考虑全部约束。`);
  }
  if (summary.inferredScoreCount > 0) {
    warnings.push(`有 ${summary.inferredScoreCount} 名学生缺少测验成绩，互补排座改用作业完成度推断。`);
  }

  if (summary.frontPrioritySatisfiedCount > 0) {
    insights.push(`已优先照顾 ${summary.frontPrioritySatisfiedCount} 名前排需求学生。`);
  }
  if (summary.scoreComplementPairCount > 0) {
    insights.push(`形成 ${summary.scoreComplementPairCount} 组高低分互补同桌。`);
  }
  if (summary.mixedGenderPairCount > 0) {
    insights.push(`形成 ${summary.mixedGenderPairCount} 组性别互补搭配。`);
  }
  if (options?.respectHeightGradient) {
    insights.push("已按身高梯度优先把较矮学生放在更靠前的位置。");
  }

  return { summary, warnings, insights };
}

function getStudentHeight(student: TeacherSeatingStudent) {
  return typeof student.heightCm === "number" ? student.heightCm : 160;
}

function getPairAverageHeight(students: TeacherSeatingStudent[]) {
  if (!students.length) return 160;
  return students.reduce((sum, student) => sum + getStudentHeight(student), 0) / students.length;
}

function buildPairingGroups(
  students: TeacherSeatingStudent[],
  options: TeacherSeatingAiOptions
): TeacherSeatingStudent[][] {
  const remaining = [...students].sort(
    (left, right) => right.placementScore - left.placementScore || left.name.localeCompare(right.name, "zh-CN")
  );
  const usedIds = new Set<string>();
  const groups: TeacherSeatingStudent[][] = [];

  function getPairCost(anchor: TeacherSeatingStudent, candidate: TeacherSeatingStudent) {
    let cost = 0;
    const scoreDiff = Math.abs(anchor.placementScore - candidate.placementScore);

    if (options.pairByScoreComplement) {
      cost += 100 - scoreDiff;
    } else {
      cost += Math.abs(scoreDiff - 10);
    }

    if (options.balanceGender) {
      if (
        anchor.gender &&
        candidate.gender &&
        anchor.gender !== "undisclosed" &&
        candidate.gender !== "undisclosed" &&
        anchor.gender === candidate.gender
      ) {
        cost += 15;
      } else if (
        !anchor.gender ||
        !candidate.gender ||
        anchor.gender === "undisclosed" ||
        candidate.gender === "undisclosed"
      ) {
        cost += 4;
      }
    }

    if (anchor.personality && candidate.personality) {
      if (anchor.personality === candidate.personality && anchor.personality !== "balanced") {
        cost += 8;
      }
      if (
        (anchor.personality === "quiet" && candidate.personality === "active") ||
        (anchor.personality === "active" && candidate.personality === "quiet")
      ) {
        cost -= 4;
      }
    }

    if (anchor.heightCm && candidate.heightCm && Math.abs(anchor.heightCm - candidate.heightCm) > 25) {
      cost += 6;
    }

    return cost;
  }

  remaining.forEach((anchor) => {
    if (usedIds.has(anchor.id)) return;
    usedIds.add(anchor.id);

    const candidates = remaining
      .filter((student) => student.id !== anchor.id && !usedIds.has(student.id))
      .sort((left, right) => getPairCost(anchor, left) - getPairCost(anchor, right));
    const partner = candidates[0] ?? null;

    if (!partner) {
      groups.push([anchor]);
      return;
    }

    usedIds.add(partner.id);
    groups.push([anchor, partner]);
  });

  return options.respectHeightGradient
    ? groups.sort((left, right) => getPairAverageHeight(left) - getPairAverageHeight(right))
    : groups;
}

function takeSeats(availableSeats: SeatCell[], count: number) {
  if (count <= 0 || !availableSeats.length) {
    return { picked: [] as SeatCell[], remaining: availableSeats };
  }

  const sorted = [...availableSeats].sort((left, right) => left.row - right.row || left.column - right.column);

  for (let start = 0; start < sorted.length; start += 1) {
    const first = sorted[start];
    const run = [first];
    for (let index = start + 1; index < sorted.length; index += 1) {
      const current = sorted[index];
      const previous = run[run.length - 1];
      if (current.row === previous.row && current.column === previous.column + 1) {
        run.push(current);
        if (run.length >= count) {
          const picked = run.slice(0, count);
          const pickedKeys = new Set(picked.map((seat) => getSeatPositionKey(seat)));
          return {
            picked,
            remaining: sorted.filter((seat) => !pickedKeys.has(getSeatPositionKey(seat)))
          };
        }
      } else {
        break;
      }
    }
  }

  const picked = sorted.slice(0, count);
  const pickedKeys = new Set(picked.map((seat) => getSeatPositionKey(seat)));
  return {
    picked,
    remaining: sorted.filter((seat) => !pickedKeys.has(getSeatPositionKey(seat)))
  };
}

export async function getTeacherSeatingData(teacherId: string, classId?: string): Promise<TeacherSeatingPageData> {
  const classes = await getClassesByTeacher(teacherId);
  const klass = pickTeacherClass(classes, teacherId, classId);

  if (!klass) {
    return {
      classes: [],
      class: null,
      students: [],
      savedPlan: null,
      plan: null,
      recommendedLayout: null,
      summary: null
    };
  }

  const students = await buildTeacherSeatingStudents(klass.id);
  const savedPlan = await getClassSeatPlan(klass.id);
  const recommendedLayout = savedPlan
    ? { rows: savedPlan.rows, columns: savedPlan.columns }
    : getRecommendedLayout(students.length);
  const plan = savedPlan ?? buildDraftPlan(klass.id, teacherId, recommendedLayout.rows, recommendedLayout.columns, students);

  return {
    classes,
    class: klass,
    students,
    savedPlan,
    plan,
    recommendedLayout,
    summary: buildTeacherSeatingPlanSummary(plan, students)
  };
}

export async function generateTeacherSeatingAiPreview(input: {
  teacherId: string;
  classId: string;
  rows: number;
  columns: number;
  options: TeacherSeatingAiOptions;
}) {
  const klass = await getClassById(input.classId);
  if (!klass || klass.teacherId !== input.teacherId) {
    notFound("class not found");
  }

  const students = await buildTeacherSeatingStudents(klass.id);
  const seatGrid = buildSeatGrid(input.rows, input.columns);
  const frontRowCount = getFrontRowCount(input.rows);
  const frontPriorityStudents = students
    .filter((student) => isFrontPriority(student))
    .sort((left, right) => getStudentHeight(left) - getStudentHeight(right) || left.name.localeCompare(right.name, "zh-CN"));
  const assignedBySeat = new Map<string, string>();
  let availableSeats = [...seatGrid].sort((left, right) => left.row - right.row || left.column - right.column);

  const frontSeats = availableSeats.filter((seat) => seat.row <= frontRowCount);
  const maxFrontAssignments = Math.min(frontPriorityStudents.length, frontSeats.length);
  for (let index = 0; index < maxFrontAssignments; index += 1) {
    assignedBySeat.set(getSeatPositionKey(frontSeats[index]), frontPriorityStudents[index].id);
  }
  const occupiedFrontSeatKeys = new Set(frontSeats.slice(0, maxFrontAssignments).map((seat) => getSeatPositionKey(seat)));
  availableSeats = availableSeats.filter((seat) => !occupiedFrontSeatKeys.has(getSeatPositionKey(seat)));

  const assignedStudentIds = new Set(frontPriorityStudents.slice(0, maxFrontAssignments).map((student) => student.id));
  const remainingStudents = students.filter((student) => !assignedStudentIds.has(student.id));
  const groups = buildPairingGroups(remainingStudents, input.options);

  groups.forEach((group) => {
    const seatSelection = takeSeats(availableSeats, Math.min(group.length, availableSeats.length));
    availableSeats = seatSelection.remaining;
    seatSelection.picked.forEach((seat, index) => {
      if (group[index]) {
        assignedBySeat.set(getSeatPositionKey(seat), group[index].id);
      }
    });
  });

  const plan: ClassSeatPlan = {
    id: `preview-${input.classId}`,
    classId: input.classId,
    teacherId: input.teacherId,
    rows: input.rows,
    columns: input.columns,
    seats: buildSeatGrid(input.rows, input.columns).map((seat) => ({
      ...seat,
      studentId: assignedBySeat.get(getSeatPositionKey(seat))
    })),
    generatedBy: "ai",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return {
    class: klass,
    students,
    plan,
    ...buildTeacherSeatingDiagnostics(plan, students, input.options)
  };
}

export async function buildSavedTeacherSeatingResult(input: {
  teacherId: string;
  classId: string;
  plan: ClassSeatPlan;
}) {
  const klass = await getClassById(input.classId);
  if (!klass || klass.teacherId !== input.teacherId) {
    notFound("class not found");
  }

  const students = await buildTeacherSeatingStudents(input.classId);
  return {
    class: klass,
    students,
    plan: input.plan,
    ...buildTeacherSeatingDiagnostics(input.plan, students)
  };
}
