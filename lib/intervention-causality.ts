import { getAssignmentsByClassIds, getAssignmentProgress } from "./assignments";
import { getParentsByStudentId } from "./auth";
import { getClassesByTeacher, getClassStudentIds } from "./classes";
import { listParentActionReceiptsByStudents } from "./parent-action-receipts";
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
  parentLinkedStudents: number;
  parentExecutedStudents: number;
  parentExecutionRate: number;
  parentReceiptDoneCount: number;
  parentReceiptSkippedCount: number;
  parentEffectScore: number;
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
    parentInvolvedActionCount: number;
    avgParentExecutionRate: number;
    avgParentEffectScore: number;
    withParentAvgScoreDelta: number | null;
    withoutParentAvgScoreDelta: number | null;
    parentDeltaGap: number | null;
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
      avgParentExecutionRate: number;
      parentInvolvedActionCount: number;
      avgParentEffectScore: number;
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
        parentInvolvedActionCount: 0,
        avgParentExecutionRate: 0,
        avgParentEffectScore: 0,
        withParentAvgScoreDelta: null,
        withoutParentAvgScoreDelta: null,
        parentDeltaGap: null,
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
  const parentLinks = await Promise.all(
    allStudentIds.map(async (studentId) => ({
      studentId,
      parentIds: (await getParentsByStudentId(studentId)).map((parent) => parent.id)
    }))
  );
  const parentIdsByStudent = new Map(parentLinks.map((item) => [item.studentId, item.parentIds]));
  const parentReceipts = await listParentActionReceiptsByStudents({
    studentIds: allStudentIds,
    since: new Date(sinceTs).toISOString(),
    until: new Date(nowTs + effectWindowMs).toISOString()
  });
  const parentReceiptsByStudent = new Map<string, typeof parentReceipts>();
  parentReceipts.forEach((receipt) => {
    const list = parentReceiptsByStudent.get(receipt.studentId) ?? [];
    list.push(receipt);
    parentReceiptsByStudent.set(receipt.studentId, list);
  });

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
      const parentExecutedStudentSet = new Set<string>();
      let assignmentExecutionCount = 0;
      let reviewExecutionCount = 0;
      let parentLinkedStudents = 0;
      let parentReceiptDoneCount = 0;
      let parentReceiptSkippedCount = 0;
      let parentEffectScore = 0;
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

        const linkedParentIds = parentIdsByStudent.get(studentId) ?? [];
        if (linkedParentIds.length) {
          parentLinkedStudents += 1;
        }
        const linkedParentSet = new Set(linkedParentIds);
        const relevantReceipts = (parentReceiptsByStudent.get(studentId) ?? []).filter((receipt) => {
          if (!linkedParentSet.has(receipt.parentId)) return false;
          const ts = toTs(receipt.completedAt);
          return Number.isFinite(ts) && ts >= actionTs && ts <= windowEndTs;
        });
        if (relevantReceipts.some((receipt) => receipt.status === "done")) {
          parentExecutedStudentSet.add(studentId);
        }
        parentReceiptDoneCount += relevantReceipts.filter((receipt) => receipt.status === "done").length;
        parentReceiptSkippedCount += relevantReceipts.filter((receipt) => receipt.status === "skipped").length;
        parentEffectScore += relevantReceipts.reduce(
          (sum, receipt) => sum + clamp(receipt.effectScore, -100, 100),
          0
        );

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
        parentLinkedStudents,
        parentExecutedStudents: parentExecutedStudentSet.size,
        parentExecutionRate: parentLinkedStudents
          ? round((parentExecutedStudentSet.size / parentLinkedStudents) * 100, 2)
          : 0,
        parentReceiptDoneCount,
        parentReceiptSkippedCount,
        parentEffectScore: round(parentEffectScore, 2),
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
  const parentLinkedItems = items.filter((item) => item.parentLinkedStudents > 0);
  const parentInvolvedActionCount = items.filter((item) => item.parentExecutedStudents > 0).length;
  const avgParentExecutionRate = parentLinkedItems.length
    ? round(parentLinkedItems.reduce((sum, item) => sum + item.parentExecutionRate, 0) / parentLinkedItems.length, 2)
    : 0;
  const parentEffectItems = items.filter(
    (item) => item.parentReceiptDoneCount > 0 || item.parentReceiptSkippedCount > 0
  );
  const avgParentEffectScore = parentEffectItems.length
    ? round(parentEffectItems.reduce((sum, item) => sum + item.parentEffectScore, 0) / parentEffectItems.length, 2)
    : 0;
  const withParentDeltaItems = scoreDeltaItems.filter((item) => item.parentExecutedStudents > 0);
  const withoutParentDeltaItems = scoreDeltaItems.filter((item) => item.parentExecutedStudents === 0);
  const withParentAvgScoreDelta = withParentDeltaItems.length
    ? round(
        withParentDeltaItems.reduce((sum, item) => sum + (item.scoreDelta ?? 0), 0) / withParentDeltaItems.length,
        2
      )
    : null;
  const withoutParentAvgScoreDelta = withoutParentDeltaItems.length
    ? round(
        withoutParentDeltaItems.reduce((sum, item) => sum + (item.scoreDelta ?? 0), 0) / withoutParentDeltaItems.length,
        2
      )
    : null;
  const parentDeltaGap =
    withParentAvgScoreDelta === null || withoutParentAvgScoreDelta === null
      ? null
      : round(withParentAvgScoreDelta - withoutParentAvgScoreDelta, 2);

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
      parentExecutionRateSum: number;
      parentExecutionRateCount: number;
      parentInvolvedActionCount: number;
      parentEffectScoreSum: number;
      parentEffectScoreCount: number;
    }
  >();
  items.forEach((item) => {
    const current = actionTypeBuckets.get(item.actionType) ?? {
      actionCount: 0,
      executionRateSum: 0,
      scoreDeltaSum: 0,
      scoreDeltaCount: 0,
      improvedActionCount: 0,
      parentExecutionRateSum: 0,
      parentExecutionRateCount: 0,
      parentInvolvedActionCount: 0,
      parentEffectScoreSum: 0,
      parentEffectScoreCount: 0
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
    if (item.parentLinkedStudents > 0) {
      current.parentExecutionRateSum += item.parentExecutionRate;
      current.parentExecutionRateCount += 1;
    }
    if (item.parentExecutedStudents > 0) {
      current.parentInvolvedActionCount += 1;
    }
    if (item.parentReceiptDoneCount > 0 || item.parentReceiptSkippedCount > 0) {
      current.parentEffectScoreSum += item.parentEffectScore;
      current.parentEffectScoreCount += 1;
    }
    actionTypeBuckets.set(item.actionType, current);
  });

  const byActionType = Array.from(actionTypeBuckets.entries())
    .map(([actionType, bucket]) => ({
      actionType,
      actionCount: bucket.actionCount,
      avgExecutionRate: bucket.actionCount ? round(bucket.executionRateSum / bucket.actionCount, 2) : 0,
      avgScoreDelta: bucket.scoreDeltaCount ? round(bucket.scoreDeltaSum / bucket.scoreDeltaCount, 2) : 0,
      improvedActionCount: bucket.improvedActionCount,
      avgParentExecutionRate: bucket.parentExecutionRateCount
        ? round(bucket.parentExecutionRateSum / bucket.parentExecutionRateCount, 2)
        : 0,
      parentInvolvedActionCount: bucket.parentInvolvedActionCount,
      avgParentEffectScore: bucket.parentEffectScoreCount
        ? round(bucket.parentEffectScoreSum / bucket.parentEffectScoreCount, 2)
        : 0
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
      parentInvolvedActionCount,
      avgParentExecutionRate,
      avgParentEffectScore,
      withParentAvgScoreDelta,
      withoutParentAvgScoreDelta,
      parentDeltaGap,
      byAlertType,
      byActionType
    },
    items
  };
}
