import { getCurrentUser } from "@/lib/auth";
import { addAdminLog } from "@/lib/admin-log";
import { getClassStudentIds } from "@/lib/classes";
import { addCorrectionTasks } from "@/lib/corrections";
import { getQuestions } from "@/lib/content";
import { createNotification } from "@/lib/notifications";
import { upsertTeacherAlertImpact } from "@/lib/teacher-alert-impacts";
import { upsertTeacherAlertAction } from "@/lib/teacher-alert-actions";
import { acknowledgeTeacherAlert, getTeacherAlerts } from "@/lib/teacher-alerts";
import { badRequest, notFound, unauthorized, withApi } from "@/lib/api/http";
import { parseJson, parseParams, v } from "@/lib/api/validation";
import { getWrongReviewItemsByUser } from "@/lib/wrong-review";

export const dynamic = "force-dynamic";

type AlertActionType = "assign_review" | "notify_student" | "mark_done";

const actionParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

const actionBodySchema = v.object<{ actionType?: string; note?: string }>(
  {
    actionType: v.optional(v.string({ minLength: 1 })),
    note: v.optional(v.string({ allowEmpty: true }))
  },
  { allowUnknown: false }
);

function parseActionType(value: string | undefined): AlertActionType {
  if (value === "assign_review" || value === "notify_student" || value === "mark_done") {
    return value;
  }
  badRequest("invalid actionType");
}

function buildDueDate(days = 2) {
  const due = new Date();
  due.setDate(due.getDate() + days);
  due.setHours(23, 59, 0, 0);
  return due.toISOString();
}

function summarizeActionResult(params: {
  actionType: AlertActionType;
  affectedStudents: number;
  createdTasks: number;
  skippedTasks: number;
  notifications: number;
}) {
  const { actionType, affectedStudents, createdTasks, skippedTasks, notifications } = params;
  if (actionType === "assign_review") {
    return `布置修复任务：影响 ${affectedStudents} 人，创建 ${createdTasks} 条，跳过 ${skippedTasks} 条，通知 ${notifications} 人。`;
  }
  if (actionType === "notify_student") {
    return `发送提醒：通知 ${notifications} 人。`;
  }
  return `预警已确认，影响 ${affectedStudents} 人。`;
}

export const POST = withApi(async (request, context) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    unauthorized();
  }

  const params = parseParams(context.params, actionParamsSchema);
  const body = await parseJson(request, actionBodySchema);
  const actionType = parseActionType(body.actionType);

  const overview = await getTeacherAlerts({
    teacherId: user.id,
    includeAcknowledged: true
  });
  const target = overview.alerts.find((item) => item.id === params.id);
  if (!target) {
    notFound("not found");
  }

  const studentIds =
    target.type === "student-risk"
      ? target.student?.id
        ? [target.student.id]
        : []
      : await getClassStudentIds(target.classId);

  if (actionType !== "mark_done" && !studentIds.length) {
    badRequest("alert has no target students");
  }

  let status: "active" | "acknowledged" = target.status;
  let acknowledgedAt: string | null = target.acknowledgedAt ?? null;
  const dueDate = buildDueDate(2);
  let createdTasks = 0;
  let skippedTasks = 0;
  let notifications = 0;

  if (actionType === "mark_done") {
    const ack = await acknowledgeTeacherAlert({
      teacherId: user.id,
      alertId: target.id,
      note: body.note ?? "一键动作已处理"
    });
    status = "acknowledged";
    acknowledgedAt = ack?.createdAt ?? new Date().toISOString();
  } else if (actionType === "notify_student") {
    const title = target.type === "student-risk" ? "学习风险提醒" : "知识点修复提醒";
    const content = target.type === "student-risk"
      ? `老师提醒：${target.riskReason}。建议动作：${target.recommendedAction}`
      : `班级提醒：知识点「${target.knowledgePoint?.title ?? "重点知识点"}」需重点修复。${target.recommendedAction}`;

    for (const studentId of studentIds.slice(0, 60)) {
      await createNotification({
        userId: studentId,
        title,
        content,
        type: "teacher_alert_action"
      });
      notifications += 1;
    }
  } else if (actionType === "assign_review") {
    const allQuestions = await getQuestions();

    const defaultQuestionIds = allQuestions
      .filter((question) => question.subject === target.subject && question.grade === target.grade)
      .filter((question) =>
        target.type === "knowledge-risk" && target.knowledgePoint?.id
          ? question.knowledgePointId === target.knowledgePoint.id
          : true
      )
      .slice(0, 3)
      .map((question) => question.id);

    for (const studentId of studentIds.slice(0, 20)) {
      let questionIds = defaultQuestionIds;
      const reviewItems = await getWrongReviewItemsByUser(studentId, false);
      const targetedReviewIds = reviewItems
        .filter((item) => item.subject === target.subject)
        .filter((item) =>
          target.type === "knowledge-risk" && target.knowledgePoint?.id
            ? item.knowledgePointId === target.knowledgePoint.id
            : true
        )
        .sort((a, b) => {
          const aTs = a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : Number.MAX_SAFE_INTEGER;
          const bTs = b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : Number.MAX_SAFE_INTEGER;
          return aTs - bTs;
        })
        .slice(0, 3)
        .map((item) => item.questionId);

      if (targetedReviewIds.length) {
        questionIds = targetedReviewIds;
      }
      if (!questionIds.length) continue;

      const taskResult = await addCorrectionTasks({
        userId: studentId,
        questionIds,
        dueDate
      });
      createdTasks += taskResult.created.length;
      skippedTasks += taskResult.skipped.length;

      if (taskResult.created.length > 0) {
        await createNotification({
          userId: studentId,
          title: "老师已布置修复任务",
          content: `请在 ${new Date(dueDate).toLocaleDateString("zh-CN")} 前完成 ${taskResult.created.length} 题修复练习。`,
          type: "teacher_alert_action"
        });
        notifications += 1;
      }
    }
  }

  const actionDetail = summarizeActionResult({
    actionType,
    affectedStudents: studentIds.length,
    createdTasks,
    skippedTasks,
    notifications
  });

  const action = await upsertTeacherAlertAction({
    teacherId: user.id,
    alertId: target.id,
    actionType,
    detail: actionDetail
  });
  const impact = action
    ? await upsertTeacherAlertImpact({
        actionId: action.id,
        teacherId: user.id,
        alertId: target.id,
        classId: target.classId,
        studentIds,
        baseline: {
          riskScore: target.riskScore,
          status: target.status,
          metrics: target.metrics ?? {},
          recommendedAction: target.recommendedAction,
          actionType
        }
      })
    : null;

  await addAdminLog({
    adminId: user.id,
    action: "teacher_alert_action",
    entityType: "teacher_alert",
    entityId: target.id,
    detail: `${actionType} | ${actionDetail}`
  });

  return {
    data: {
      id: target.id,
      status,
      acknowledgedAt,
      lastActionType: action?.actionType ?? actionType,
      lastActionAt: action?.createdAt ?? new Date().toISOString(),
      lastActionBy: user.id,
      impactTracking: impact
        ? {
            tracked: true,
            actionId: impact.actionId,
            trackedAt: impact.createdAt,
            dueAt24h: new Date(new Date(impact.createdAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
            dueAt72h: new Date(new Date(impact.createdAt).getTime() + 72 * 60 * 60 * 1000).toISOString()
          }
        : {
            tracked: false
          },
      result: {
        affectedStudents: studentIds.length,
        createdTasks,
        skippedTasks,
        notifications,
        dueDate: actionType === "assign_review" ? dueDate : null,
        message: actionDetail
      }
    }
  };
});
