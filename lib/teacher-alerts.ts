import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";
import { getClassesByTeacher, getClassStudentIds, getClassStudents } from "./classes";
import { getAssignmentsByClassIds, getAssignmentProgress } from "./assignments";
import { getAttemptsByUsers } from "./progress";
import { getWrongReviewItemsByUser } from "./wrong-review";
import { getKnowledgePoints } from "./content";
import { getExamAssignmentsByPaper, getExamPapersByClassIds } from "./exams";
import { getExamEventsByPaper } from "./exam-events";
import { getTeacherAlertActions } from "./teacher-alert-actions";

export type TeacherAlertType = "student-risk" | "knowledge-risk";

export type TeacherAlert = {
  id: string;
  type: TeacherAlertType;
  classId: string;
  className: string;
  subject: string;
  grade: string;
  riskScore: number;
  riskReason: string;
  recommendedAction: string;
  status: "active" | "acknowledged";
  acknowledgedAt?: string | null;
  ackNote?: string | null;
  lastActionType?: "assign_review" | "notify_student" | "auto_chain" | "mark_done" | null;
  lastActionAt?: string | null;
  lastActionBy?: string | null;
  student?: {
    id: string;
    name: string;
    email: string;
    grade?: string;
  };
  knowledgePoint?: {
    id: string;
    title: string;
    chapter: string;
    unit: string;
    ratio: number;
    total: number;
  };
  metrics?: Record<string, number | string | null>;
};

export type TeacherRiskStudent = {
  id: string;
  name: string;
  email: string;
  classId: string;
  className: string;
  subject: string;
  grade: string;
  riskScore: number;
  riskReason: string;
  recommendedAction: string;
  recentAccuracy: number;
  recentAttempts: number;
  overdueAssignments: number;
  overdueReviews: number;
  dueTodayReviews: number;
};

export type TeacherRiskKnowledgePoint = {
  id: string;
  title: string;
  classId: string;
  className: string;
  subject: string;
  grade: string;
  ratio: number;
  total: number;
  riskScore: number;
  riskReason: string;
  recommendedAction: string;
};

export type TeacherClassRisk = {
  classId: string;
  className: string;
  subject: string;
  grade: string;
  riskScore: number;
  riskStudentCount: number;
  highRiskStudentCount: number;
  riskReason: string;
  recommendedAction: string;
};

export type TeacherAlertSummary = {
  classRiskScore: number;
  totalAlerts: number;
  activeAlerts: number;
  acknowledgedAlerts: number;
  highRiskAlerts: number;
};

export type TeacherAlertOverview = {
  summary: TeacherAlertSummary;
  classRisk: TeacherClassRisk[];
  riskStudents: TeacherRiskStudent[];
  riskKnowledgePoints: TeacherRiskKnowledgePoint[];
  alerts: TeacherAlert[];
};

export type TeacherAlertAck = {
  id: string;
  teacherId: string;
  alertId: string;
  note?: string | null;
  createdAt: string;
};

type DbAlertAck = {
  id: string;
  teacher_id: string;
  alert_id: string;
  note: string | null;
  created_at: string;
};

const ALERT_ACK_FILE = "teacher-alert-acks.json";
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WINDOW_DAYS = 7;
// Unified threshold so student-risk and knowledge-risk alerts share one trigger baseline.
const ALERT_TRIGGER_SCORE = 40;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]) {
  if (!values.length) return 0;
  const sum = values.reduce((acc, cur) => acc + cur, 0);
  return Math.round(sum / values.length);
}

function calcAccuracy(correct: number, total: number) {
  if (!total) return 0;
  return Math.round((correct / total) * 100);
}

function endOfTodayTs() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now.getTime();
}

function toRiskLevel(score: number) {
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function mapAckRow(row: DbAlertAck): TeacherAlertAck {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    alertId: row.alert_id,
    note: row.note,
    createdAt: row.created_at
  };
}

export async function getTeacherAlertAcks(teacherId: string) {
  if (!isDbEnabled()) {
    const list = readJson<TeacherAlertAck[]>(ALERT_ACK_FILE, []);
    return list.filter((item) => item.teacherId === teacherId);
  }
  const rows = await query<DbAlertAck>(
    "SELECT * FROM teacher_alert_acks WHERE teacher_id = $1 ORDER BY created_at DESC",
    [teacherId]
  );
  return rows.map(mapAckRow);
}

export async function acknowledgeTeacherAlert(params: {
  teacherId: string;
  alertId: string;
  note?: string;
}) {
  const now = new Date().toISOString();
  if (!isDbEnabled()) {
    const list = readJson<TeacherAlertAck[]>(ALERT_ACK_FILE, []);
    const index = list.findIndex(
      (item) => item.teacherId === params.teacherId && item.alertId === params.alertId
    );
    const next: TeacherAlertAck = {
      id: index >= 0 ? list[index].id : `ack-${crypto.randomBytes(6).toString("hex")}`,
      teacherId: params.teacherId,
      alertId: params.alertId,
      note: params.note ?? null,
      createdAt: now
    };
    if (index >= 0) {
      list[index] = next;
    } else {
      list.push(next);
    }
    writeJson(ALERT_ACK_FILE, list);
    return next;
  }

  const existing = await queryOne<DbAlertAck>(
    "SELECT * FROM teacher_alert_acks WHERE teacher_id = $1 AND alert_id = $2",
    [params.teacherId, params.alertId]
  );
  const row = await queryOne<DbAlertAck>(
    `INSERT INTO teacher_alert_acks (id, teacher_id, alert_id, note, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (teacher_id, alert_id) DO UPDATE SET
       note = EXCLUDED.note,
       created_at = EXCLUDED.created_at
     RETURNING *`,
    [
      existing?.id ?? `ack-${crypto.randomBytes(6).toString("hex")}`,
      params.teacherId,
      params.alertId,
      params.note ?? null,
      now
    ]
  );
  return row ? mapAckRow(row) : null;
}

export async function getTeacherAlerts(params: {
  teacherId: string;
  classId?: string;
  includeAcknowledged?: boolean;
}) {
  // Default includes acknowledged alerts so dashboards can show full handling history.
  const includeAcknowledged = params.includeAcknowledged !== false;
  const allClasses = await getClassesByTeacher(params.teacherId);
  const targetClasses = params.classId
    ? allClasses.filter((item) => item.id === params.classId)
    : allClasses;

  if (!targetClasses.length) {
    return {
      summary: {
        classRiskScore: 0,
        totalAlerts: 0,
        activeAlerts: 0,
        acknowledgedAlerts: 0,
        highRiskAlerts: 0
      },
      classRisk: [],
      riskStudents: [],
      riskKnowledgePoints: [],
      alerts: []
    } as TeacherAlertOverview;
  }

  const classStudentPairs = await Promise.all(
    targetClasses.map(async (klass) => ({
      classId: klass.id,
      studentIds: await getClassStudentIds(klass.id),
      students: await getClassStudents(klass.id)
    }))
  );

  const studentIds = Array.from(
    new Set(classStudentPairs.flatMap((pair) => pair.studentIds))
  );
  const attempts = await getAttemptsByUsers(studentIds);

  const attemptsByStudentSubject = new Map<string, typeof attempts>();
  attempts.forEach((item) => {
    const key = `${item.userId}::${item.subject}`;
    const list = attemptsByStudentSubject.get(key) ?? [];
    list.push(item);
    attemptsByStudentSubject.set(key, list);
  });

  const assignments = await getAssignmentsByClassIds(targetClasses.map((item) => item.id));
  const progressLists = await Promise.all(assignments.map((assignment) => getAssignmentProgress(assignment.id)));
  const assignmentProgressMap = new Map<string, Map<string, (typeof progressLists)[number][number]>>();
  assignments.forEach((assignment, index) => {
    const progressMap = new Map<string, (typeof progressLists)[number][number]>();
    progressLists[index].forEach((item) => progressMap.set(item.studentId, item));
    assignmentProgressMap.set(assignment.id, progressMap);
  });

  const reviewPairs = await Promise.all(
    studentIds.map(async (studentId) => ({
      studentId,
      items: await getWrongReviewItemsByUser(studentId, false)
    }))
  );
  const reviewByStudent = new Map(reviewPairs.map((pair) => [pair.studentId, pair.items]));

  const kpList = await getKnowledgePoints();
  const kpMap = new Map(kpList.map((item) => [item.id, item]));

  const nowTs = Date.now();
  const endTodayTs = endOfTodayTs();
  const sinceTs = nowTs - RECENT_WINDOW_DAYS * DAY_MS;

  const examPapers = await getExamPapersByClassIds(targetClasses.map((item) => item.id));
  const examsByClass = new Map<string, typeof examPapers>();
  examPapers.forEach((paper) => {
    const list = examsByClass.get(paper.classId) ?? [];
    list.push(paper);
    examsByClass.set(paper.classId, list);
  });

  const examRiskByClassStudent = new Map<
    string,
    {
      blurCount: number;
      visibilityHiddenCount: number;
      examCount: number;
      lastEventAt: string | null;
      paperIds: string[];
    }
  >();

  for (const klass of targetClasses) {
    const classExamPapers = examsByClass.get(klass.id) ?? [];
    if (!classExamPapers.length) continue;

    const [assignmentBatches, eventBatches] = await Promise.all([
      Promise.all(classExamPapers.map((paper) => getExamAssignmentsByPaper(paper.id))),
      Promise.all(classExamPapers.map((paper) => getExamEventsByPaper(paper.id)))
    ]);

    classExamPapers.forEach((paper, index) => {
      const assignedStudents = new Set(assignmentBatches[index].map((item) => item.studentId));
      const events = eventBatches[index];
      events.forEach((event) => {
        if (paper.publishMode === "targeted" && !assignedStudents.has(event.studentId)) {
          return;
        }
        const eventTs = new Date(event.lastEventAt).getTime();
        if (!Number.isFinite(eventTs) || eventTs < sinceTs) {
          return;
        }
        const key = `${klass.id}::${event.studentId}`;
        const current =
          examRiskByClassStudent.get(key) ??
          {
            blurCount: 0,
            visibilityHiddenCount: 0,
            examCount: 0,
            lastEventAt: null,
            paperIds: []
          };

        const paperIds = current.paperIds.includes(paper.id) ? current.paperIds : [...current.paperIds, paper.id];
        examRiskByClassStudent.set(key, {
          blurCount: current.blurCount + event.blurCount,
          visibilityHiddenCount: current.visibilityHiddenCount + event.visibilityHiddenCount,
          examCount: paperIds.length,
          lastEventAt:
            !current.lastEventAt || eventTs > new Date(current.lastEventAt).getTime()
              ? event.lastEventAt
              : current.lastEventAt,
          paperIds
        });
      });
    });
  }

  const riskStudents: TeacherRiskStudent[] = [];
  const riskKnowledgePoints: TeacherRiskKnowledgePoint[] = [];
  const classRisk: TeacherClassRisk[] = [];
  const alerts: TeacherAlert[] = [];

  for (const klass of targetClasses) {
    const pair = classStudentPairs.find((item) => item.classId === klass.id);
    const classStudentIds = pair?.studentIds ?? [];
    const classStudents = pair?.students ?? [];
    const classStudentMap = new Map(classStudents.map((item) => [item.id, item]));
    const classAssignments = assignments.filter((item) => item.classId === klass.id);
    const classRiskScores: number[] = [];

    classStudentIds.forEach((studentId) => {
      const studentInfo = classStudentMap.get(studentId);
      const subjectAttempts = attemptsByStudentSubject.get(`${studentId}::${klass.subject}`) ?? [];
      const recentAttempts = subjectAttempts.filter(
        (item) => new Date(item.createdAt).getTime() >= sinceTs
      );
      const recentTotal = recentAttempts.length;
      const recentCorrect = recentAttempts.filter((item) => item.correct).length;
      const recentAccuracy = calcAccuracy(recentCorrect, recentTotal);

      let overdueAssignments = 0;
      classAssignments.forEach((assignment) => {
        const dueTs = new Date(assignment.dueDate).getTime();
        if (dueTs >= nowTs) return;
        const progressMap = assignmentProgressMap.get(assignment.id);
        const progress = progressMap?.get(studentId);
        if (!progress || progress.status !== "completed") {
          overdueAssignments += 1;
        }
      });

      const reviews = (reviewByStudent.get(studentId) ?? []).filter(
        (item) => item.subject === klass.subject
      );
      const overdueReviews = reviews.filter((item) => {
        if (!item.nextReviewAt) return false;
        return new Date(item.nextReviewAt).getTime() < nowTs;
      }).length;
      const dueTodayReviews = reviews.filter((item) => {
        if (!item.nextReviewAt) return false;
        return new Date(item.nextReviewAt).getTime() <= endTodayTs;
      }).length;
      const examSignal = examRiskByClassStudent.get(`${klass.id}::${studentId}`);
      const examBlurCount = examSignal?.blurCount ?? 0;
      const examVisibilityHiddenCount = examSignal?.visibilityHiddenCount ?? 0;
      const examAnomalyCount = examBlurCount + examVisibilityHiddenCount;
      const examAnomalyExamCount = examSignal?.examCount ?? 0;

      const reasons: string[] = [];
      const actionCandidates: { key: string; score: number }[] = [];
      let score = 0;

      if (recentTotal === 0) {
        score += 25;
        reasons.push("近7天无练习记录");
        actionCandidates.push({ key: "inactive", score: 25 });
      } else if (recentTotal >= 5 && recentAccuracy < 40) {
        score += 45;
        reasons.push(`近7天正确率仅 ${recentAccuracy}%`);
        actionCandidates.push({ key: "accuracy", score: 45 });
      } else if (recentTotal >= 5 && recentAccuracy < 60) {
        score += 30;
        reasons.push(`近7天正确率偏低（${recentAccuracy}%）`);
        actionCandidates.push({ key: "accuracy", score: 30 });
      } else if (recentTotal >= 5 && recentAccuracy < 70) {
        score += 15;
        reasons.push(`近7天正确率需提升（${recentAccuracy}%）`);
        actionCandidates.push({ key: "accuracy", score: 15 });
      }

      if (overdueAssignments > 0) {
        const assignScore = Math.min(35, overdueAssignments * 15);
        score += assignScore;
        reasons.push(`逾期作业 ${overdueAssignments} 份`);
        actionCandidates.push({ key: "assignment", score: assignScore });
      }

      if (overdueReviews > 0) {
        const reviewScore = Math.min(30, overdueReviews * 10);
        score += reviewScore;
        reasons.push(`错题复练逾期 ${overdueReviews} 题`);
        actionCandidates.push({ key: "review", score: reviewScore });
      } else if (dueTodayReviews >= 3) {
        score += 8;
        reasons.push(`今日待复练 ${dueTodayReviews} 题`);
      }

      if (examAnomalyCount >= 20) {
        score += 45;
        reasons.push(`近7天考试异常行为严重（${examAnomalyCount} 次，${examAnomalyExamCount} 场）`);
        actionCandidates.push({ key: "exam-anomaly", score: 45 });
      } else if (examAnomalyCount >= 12) {
        score += 35;
        reasons.push(`近7天考试异常行为 ${examAnomalyCount} 次（${examAnomalyExamCount} 场）`);
        actionCandidates.push({ key: "exam-anomaly", score: 35 });
      } else if (examAnomalyCount >= 6) {
        score += 20;
        reasons.push(`近7天考试异常行为偏多（${examAnomalyCount} 次）`);
        actionCandidates.push({ key: "exam-anomaly", score: 20 });
      } else if (examAnomalyCount >= 3) {
        score += 10;
        reasons.push(`近7天存在考试异常行为（${examAnomalyCount} 次）`);
      }

      score = clamp(Math.round(score), 0, 100);
      classRiskScores.push(score);

      if (score < ALERT_TRIGGER_SCORE) {
        // Below threshold remains visible in raw metrics but does not materialize as alert item.
        return;
      }

      const primary = actionCandidates.sort((a, b) => b.score - a.score)[0]?.key;
      let recommendedAction = "安排个性化修复任务，并在下一次课堂进行重点讲评。";
      if (primary === "assignment") {
        recommendedAction = `优先处理逾期作业（${overdueAssignments} 份），并一键布置同知识点修复任务。`;
      } else if (primary === "review") {
        recommendedAction = `今日先清空逾期复练（${overdueReviews} 题），完成后安排 5 题巩固训练。`;
      } else if (primary === "exam-anomaly") {
        recommendedAction = "安排考试规范提醒 + 1 次定向复练，必要时开启更严格监测并人工复核。";
      } else if (primary === "accuracy") {
        recommendedAction = `针对薄弱知识点安排 10 题分层练习，并在课上复盘错因。`;
      } else if (primary === "inactive") {
        recommendedAction = `先完成 1 次诊断 + 5 题启动训练，确保恢复学习节奏。`;
      }

      const studentRisk: TeacherRiskStudent = {
        id: studentId,
        name: studentInfo?.name ?? "学生",
        email: studentInfo?.email ?? "",
        classId: klass.id,
        className: klass.name,
        subject: klass.subject,
        grade: klass.grade,
        riskScore: score,
        riskReason: reasons.join("；"),
        recommendedAction,
        recentAccuracy,
        recentAttempts: recentTotal,
        overdueAssignments,
        overdueReviews,
        dueTodayReviews
      };
      riskStudents.push(studentRisk);

      alerts.push({
        id: `alert-student-${klass.id}-${studentId}`,
        type: "student-risk",
        classId: klass.id,
        className: klass.name,
        subject: klass.subject,
        grade: klass.grade,
        riskScore: score,
        riskReason: studentRisk.riskReason,
        recommendedAction,
        status: "active",
        student: {
          id: studentId,
          name: studentRisk.name,
          email: studentRisk.email,
          grade: studentInfo?.grade
        },
        metrics: {
          recentAccuracy,
          recentAttempts: recentTotal,
          overdueAssignments,
          overdueReviews,
          dueTodayReviews,
          examBlurCount,
          examVisibilityHiddenCount,
          examAnomalyCount,
          examAnomalyExamCount,
          riskLevel: toRiskLevel(score)
        }
      });
    });

    const classAttempts = attempts.filter(
      (item) => classStudentIds.includes(item.userId) && item.subject === klass.subject
    );
    const kpStats = new Map<string, { correct: number; total: number }>();
    classAttempts.forEach((attempt) => {
      const current = kpStats.get(attempt.knowledgePointId) ?? { correct: 0, total: 0 };
      current.total += 1;
      current.correct += attempt.correct ? 1 : 0;
      kpStats.set(attempt.knowledgePointId, current);
    });

    Array.from(kpStats.entries())
      .map(([kpId, stat]) => {
        const ratio = calcAccuracy(stat.correct, stat.total);
        // Knowledge-point risk prioritizes low accuracy with enough sample size.
        const riskScore = clamp(Math.round((75 - ratio) * 1.6 + Math.min(20, stat.total)), 0, 100);
        return { kpId, ratio, total: stat.total, riskScore };
      })
      .filter((item) => item.total >= 4 && item.ratio < 75 && item.riskScore >= ALERT_TRIGGER_SCORE)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 6)
      .forEach((item) => {
        const kp = kpMap.get(item.kpId);
        const title = kp?.title ?? "知识点";
        const riskReason = `班级正确率 ${item.ratio}%（练习 ${item.total} 次）`;
        const recommendedAction = `一键布置「${title}」修复任务（基础 5 题 + 变式 3 题）。`;
        const riskKp: TeacherRiskKnowledgePoint = {
          id: item.kpId,
          title,
          classId: klass.id,
          className: klass.name,
          subject: klass.subject,
          grade: klass.grade,
          ratio: item.ratio,
          total: item.total,
          riskScore: item.riskScore,
          riskReason,
          recommendedAction
        };
        riskKnowledgePoints.push(riskKp);

        alerts.push({
          id: `alert-kp-${klass.id}-${item.kpId}`,
          type: "knowledge-risk",
          classId: klass.id,
          className: klass.name,
          subject: klass.subject,
          grade: klass.grade,
          riskScore: item.riskScore,
          riskReason,
          recommendedAction,
          status: "active",
          knowledgePoint: {
            id: item.kpId,
            title,
            chapter: kp?.chapter ?? "",
            unit: kp?.unit ?? "",
            ratio: item.ratio,
            total: item.total
          }
        });
      });

    const riskStudentCount = classRiskScores.filter((score) => score >= ALERT_TRIGGER_SCORE).length;
    const highRiskStudentCount = classRiskScores.filter((score) => score >= 75).length;
    const classScore = average(classRiskScores);
    classRisk.push({
      classId: klass.id,
      className: klass.name,
      subject: klass.subject,
      grade: klass.grade,
      riskScore: classScore,
      riskStudentCount,
      highRiskStudentCount,
      riskReason:
        riskStudentCount > 0
          ? `风险学生 ${riskStudentCount} 人（高风险 ${highRiskStudentCount} 人）`
          : "班级风险可控",
      recommendedAction:
        riskStudentCount > 0
          ? "优先处理高风险学生，再对班级薄弱知识点安排集中修复。"
          : "保持当前节奏，继续跟踪逾期作业与复练完成率。"
    });
  }

  riskStudents.sort((a, b) => b.riskScore - a.riskScore);
  riskKnowledgePoints.sort((a, b) => b.riskScore - a.riskScore);
  classRisk.sort((a, b) => b.riskScore - a.riskScore);

  const ackList = await getTeacherAlertAcks(params.teacherId);
  const ackMap = new Map(ackList.map((item) => [item.alertId, item]));
  const actionList = await getTeacherAlertActions(params.teacherId);
  const actionMap = new Map(actionList.map((item) => [item.alertId, item]));
  const mergedAlerts = alerts
    .map((alert) => {
      const ack = ackMap.get(alert.id);
      const action = actionMap.get(alert.id);
      const withAction = action
        ? {
            ...alert,
            lastActionType: action.actionType,
            lastActionAt: action.createdAt,
            lastActionBy: action.teacherId
          }
        : alert;
      if (!ack) return withAction;
      return {
        ...withAction,
        status: "acknowledged" as const,
        acknowledgedAt: ack.createdAt,
        ackNote: ack.note ?? null
      };
    })
    // Active alerts come first, then acknowledged alerts by risk score.
    .filter((alert) => includeAcknowledged || alert.status === "active")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return b.riskScore - a.riskScore;
    });

  const classRiskScore = average(classRisk.map((item) => item.riskScore));
  const summary: TeacherAlertSummary = {
    classRiskScore,
    totalAlerts: mergedAlerts.length,
    activeAlerts: mergedAlerts.filter((item) => item.status === "active").length,
    acknowledgedAlerts: mergedAlerts.filter((item) => item.status === "acknowledged").length,
    highRiskAlerts: mergedAlerts.filter((item) => item.riskScore >= 75).length
  };

  return {
    summary,
    classRisk,
    riskStudents: riskStudents.slice(0, 30),
    riskKnowledgePoints: riskKnowledgePoints.slice(0, 30),
    alerts: mergedAlerts.slice(0, 80)
  } as TeacherAlertOverview;
}
