import { getAssignmentsByClassIds, getAssignmentProgress } from "./assignments";
import { getClassesByTeacher, getClassStudentIds } from "./classes";
import { getAttemptsByUsers } from "./progress";
import { getTeacherAlertActions, type TeacherAlertActionType } from "./teacher-alert-actions";
import { getTeacherAlerts } from "./teacher-alerts";
import { getWrongReviewItemsByUser } from "./wrong-review";

const DAY_MS = 24 * 60 * 60 * 1000;

type ParsedAlertTarget = {
  type: "student-risk" | "knowledge-risk";
  classId: string;
  studentId?: string;
  knowledgePointId?: string;
};

export type InterventionCausalityItem = {
  actionId: string;
  alertId: string;
  actionType: TeacherAlertActionType;
  classId: string;
  className: string;
  subject: string;
  grade: string;
  alertType: "student-risk" | "knowledge-risk";
  riskScore: number | null;
  riskReason: string;
  recommendedAction: string;
  createdAt: string;
  targetStudents: number;
  executedStudents: number;
  executionRate: number;
  assignmentExecutionCount: number;
  reviewExecutionCount: number;
  preAccuracy: number | null;
  postAccuracy: number | null;
  scoreDelta: number | null;
  preAttemptCount: number;
  postAttemptCount: number;
};

export type InterventionCausalityReport = {
  summary: {
    actionCount: number;
    classCount: number;
    avgExecutionRate: number;
    avgScoreDelta: number;
    improvedActionCount: number;
    evidenceReadyCount: number;
    evidenceReadyRate: number;
    byAlertType: {
      studentRiskActionCount: number;
      knowledgeRiskActionCount: number;
    };
    byActionType: Array<{
      actionType: TeacherAlertActionType;
      actionCount: number;
      avgExecutionRate: number;
      avgScoreDelta: number;
      improvedActionCount: number;
    }>;
  };
  items: InterventionCausalityItem[];
};

function toTs(value: string | null | undefined) {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

function round(value: number, digits = 2) {
  const scale = Math.pow(10, digits);
  return Math.round(value * scale) / scale;
}

function calcAccuracy(correct: number, total: number) {
  if (!total) return null;
  return round((correct / total) * 100, 2);
}

function parseAlertId(alertId: string, classIds: string[]): ParsedAlertTarget | null {
  const tryResolve = (prefix: "alert-student-" | "alert-kp-", type: ParsedAlertTarget["type"]) => {
    if (!alertId.startsWith(prefix)) return null;
    const body = alertId.slice(prefix.length);
    const sortedClassIds = classIds.slice().sort((a, b) => b.length - a.length);
    for (const classId of sortedClassIds) {
      if (!body.startsWith(`${classId}-`)) continue;
      const tail = body.slice(classId.length + 1);
      if (!tail) continue;
      // Alert id embeds target metadata; parse to recover target set without extra storage.
      if (type === "student-risk") {
        return { type, classId, studentId: tail } satisfies ParsedAlertTarget;
      }
      return { type, classId, knowledgePointId: tail } satisfies ParsedAlertTarget;
    }
    return null;
  };

  return tryResolve("alert-student-", "student-risk") ?? tryResolve("alert-kp-", "knowledge-risk");
}

export async function buildInterventionCausalityReport(params: {
  teacherId: string;
  classId?: string;
  days?: number;
}): Promise<InterventionCausalityReport> {
  const days = Math.max(3, Math.min(30, Math.round(params.days ?? 14)));
  const nowTs = Date.now();
  const sinceTs = nowTs - days * DAY_MS;
  const effectWindowMs = 7 * DAY_MS;

  const classes = await getClassesByTeacher(params.teacherId);
  const classList = params.classId ? classes.filter((item) => item.id === params.classId) : classes;
  if (!classList.length) {
    return {
      summary: {
        actionCount: 0,
        classCount: 0,
        avgExecutionRate: 0,
        avgScoreDelta: 0,
        improvedActionCount: 0,
        evidenceReadyCount: 0,
        evidenceReadyRate: 0,
        byAlertType: {
          studentRiskActionCount: 0,
          knowledgeRiskActionCount: 0
        },
        byActionType: []
      },
      items: []
    };
  }

  const classIds = classList.map((item) => item.id);
  const classMap = new Map(classList.map((item) => [item.id, item]));

  const classStudentPairs = await Promise.all(
    classList.map(async (klass) => ({
      classId: klass.id,
      studentIds: await getClassStudentIds(klass.id)
    }))
  );
  const classStudentsMap = new Map(classStudentPairs.map((item) => [item.classId, item.studentIds]));
  const allStudentIds = Array.from(new Set(classStudentPairs.flatMap((item) => item.studentIds)));

  const [actions, alertsOverview, attempts, assignments] = await Promise.all([
    getTeacherAlertActions(params.teacherId),
    getTeacherAlerts({
      teacherId: params.teacherId,
      classId: params.classId,
      includeAcknowledged: true
    }),
    getAttemptsByUsers(allStudentIds),
    getAssignmentsByClassIds(classIds)
  ]);

  const alertMap = new Map(alertsOverview.alerts.map((item) => [item.id, item]));
  const attemptsByStudent = new Map<string, typeof attempts>();
  attempts.forEach((attempt) => {
    const list = attemptsByStudent.get(attempt.userId) ?? [];
    list.push(attempt);
    attemptsByStudent.set(attempt.userId, list);
  });

  const [progressLists, wrongReviewLists] = await Promise.all([
    Promise.all(assignments.map((item) => getAssignmentProgress(item.id))),
    Promise.all(
      allStudentIds.map(async (studentId) => ({
        studentId,
        items: await getWrongReviewItemsByUser(studentId, true)
      }))
    )
  ]);
  const progress = progressLists.flat();
  const progressByStudent = new Map<string, typeof progress>();
  progress.forEach((item) => {
    const list = progressByStudent.get(item.studentId) ?? [];
    list.push(item);
    progressByStudent.set(item.studentId, list);
  });
  const wrongReviewByStudent = new Map(wrongReviewLists.map((item) => [item.studentId, item.items]));

  const items: InterventionCausalityItem[] = [];
  actions
    .filter((action) => {
      const actionTs = toTs(action.createdAt);
      return Number.isFinite(actionTs) && actionTs >= sinceTs;
    })
    .forEach((action) => {
      const actionTs = toTs(action.createdAt);
      if (!Number.isFinite(actionTs)) return;

      const parsed = parseAlertId(action.alertId, classIds);
      if (!parsed) return;
      if (params.classId && parsed.classId !== params.classId) return;

      const alert = alertMap.get(action.alertId);
      const classInfo = classMap.get(parsed.classId);
      if (!classInfo) return;

      const targetStudentIds =
        parsed.type === "student-risk" && parsed.studentId
          ? [parsed.studentId]
          : classStudentsMap.get(parsed.classId) ?? [];
      if (!targetStudentIds.length) return;

      const windowEndTs = actionTs + effectWindowMs;
      const executedStudentSet = new Set<string>();
      let assignmentExecutionCount = 0;
      let reviewExecutionCount = 0;
      let preCorrect = 0;
      let preTotal = 0;
      let postCorrect = 0;
      let postTotal = 0;

      targetStudentIds.forEach((studentId) => {
        const progressList = progressByStudent.get(studentId) ?? [];
        const assignmentExecuted = progressList.some((item) => {
          if (item.status !== "completed") return false;
          const ts = toTs(item.completedAt);
          return Number.isFinite(ts) && ts >= actionTs && ts <= windowEndTs;
        });
        if (assignmentExecuted) {
          executedStudentSet.add(studentId);
          assignmentExecutionCount += 1;
        }

        const reviewList = wrongReviewByStudent.get(studentId) ?? [];
        const reviewExecuted = reviewList.some((item) => {
          const ts = toTs(item.lastReviewAt);
          if (!Number.isFinite(ts)) return false;
          if (ts < actionTs || ts > windowEndTs) return false;
          if (parsed.type === "knowledge-risk" && parsed.knowledgePointId) {
            return item.knowledgePointId === parsed.knowledgePointId;
          }
          return true;
        });
        if (reviewExecuted) {
          executedStudentSet.add(studentId);
          reviewExecutionCount += 1;
        }

        const studentAttempts = attemptsByStudent.get(studentId) ?? [];
        studentAttempts.forEach((attempt) => {
          if (parsed.type === "knowledge-risk" && parsed.knowledgePointId) {
            if (attempt.knowledgePointId !== parsed.knowledgePointId) return;
          }

          const ts = toTs(attempt.createdAt);
          if (!Number.isFinite(ts)) return;
          if (ts >= actionTs - effectWindowMs && ts < actionTs) {
            // Pre window: baseline evidence before intervention.
            preTotal += 1;
            preCorrect += attempt.correct ? 1 : 0;
            return;
          }
          if (ts >= actionTs && ts <= windowEndTs) {
            // Post window: impact evidence after intervention.
            postTotal += 1;
            postCorrect += attempt.correct ? 1 : 0;
          }
        });
      });

      const preAccuracy = calcAccuracy(preCorrect, preTotal);
      const postAccuracy = calcAccuracy(postCorrect, postTotal);
      const scoreDelta =
        preAccuracy === null || postAccuracy === null ? null : round(postAccuracy - preAccuracy, 2);

      items.push({
        actionId: action.id,
        alertId: action.alertId,
        actionType: action.actionType,
        classId: parsed.classId,
        className: classInfo.name,
        subject: classInfo.subject,
        grade: classInfo.grade,
        alertType: parsed.type,
        riskScore: alert?.riskScore ?? null,
        riskReason: alert?.riskReason ?? "",
        recommendedAction: alert?.recommendedAction ?? action.detail ?? "",
        createdAt: action.createdAt,
        targetStudents: targetStudentIds.length,
        executedStudents: executedStudentSet.size,
        executionRate: round((executedStudentSet.size / targetStudentIds.length) * 100, 2),
        assignmentExecutionCount,
        reviewExecutionCount,
        preAccuracy,
        postAccuracy,
        scoreDelta,
        preAttemptCount: preTotal,
        postAttemptCount: postTotal
      });
    });

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const scoreDeltaItems = items.filter((item) => item.scoreDelta !== null);
  const avgExecutionRate = items.length
    ? round(items.reduce((sum, item) => sum + item.executionRate, 0) / items.length, 2)
    : 0;
  const avgScoreDelta = scoreDeltaItems.length
    ? round(
        scoreDeltaItems.reduce((sum, item) => sum + (item.scoreDelta ?? 0), 0) / scoreDeltaItems.length,
        2
      )
    : 0;
  const evidenceReadyCount = items.filter((item) => item.preAttemptCount > 0 && item.postAttemptCount > 0).length;
  const evidenceReadyRate = items.length ? round((evidenceReadyCount / items.length) * 100, 2) : 0;

  const byAlertType = {
    studentRiskActionCount: items.filter((item) => item.alertType === "student-risk").length,
    knowledgeRiskActionCount: items.filter((item) => item.alertType === "knowledge-risk").length
  };

  const actionTypeBuckets = new Map<
    TeacherAlertActionType,
    {
      actionCount: number;
      executionRateSum: number;
      scoreDeltaSum: number;
      scoreDeltaCount: number;
      improvedActionCount: number;
    }
  >();
  items.forEach((item) => {
    const current = actionTypeBuckets.get(item.actionType) ?? {
      actionCount: 0,
      executionRateSum: 0,
      scoreDeltaSum: 0,
      scoreDeltaCount: 0,
      improvedActionCount: 0
    };
    current.actionCount += 1;
    current.executionRateSum += item.executionRate;
    if (item.scoreDelta !== null) {
      current.scoreDeltaSum += item.scoreDelta;
      current.scoreDeltaCount += 1;
    }
    if ((item.scoreDelta ?? 0) > 0) {
      current.improvedActionCount += 1;
    }
    actionTypeBuckets.set(item.actionType, current);
  });

  const byActionType = Array.from(actionTypeBuckets.entries())
    .map(([actionType, bucket]) => ({
      actionType,
      actionCount: bucket.actionCount,
      avgExecutionRate: bucket.actionCount ? round(bucket.executionRateSum / bucket.actionCount, 2) : 0,
      avgScoreDelta: bucket.scoreDeltaCount ? round(bucket.scoreDeltaSum / bucket.scoreDeltaCount, 2) : 0,
      improvedActionCount: bucket.improvedActionCount
    }))
    .sort((a, b) => {
      if (b.actionCount !== a.actionCount) return b.actionCount - a.actionCount;
      return a.actionType.localeCompare(b.actionType);
    });

  return {
    summary: {
      actionCount: items.length,
      classCount: new Set(items.map((item) => item.classId)).size,
      avgExecutionRate,
      avgScoreDelta,
      improvedActionCount: items.filter((item) => (item.scoreDelta ?? 0) > 0).length,
      evidenceReadyCount,
      evidenceReadyRate,
      byAlertType,
      byActionType
    },
    items
  };
}
