import { getCurrentUser, getUserById } from "@/lib/auth";
import { getClassesByStudent } from "@/lib/classes";
import { getAssignmentProgressByStudent, getAssignmentsByClassIds } from "@/lib/assignments";
import {
  buildParentActionReceiptKey,
  listParentActionReceipts,
  summarizeParentActionReceipts
} from "@/lib/parent-action-receipts";
import { getUnifiedReviewQueue } from "@/lib/review-scheduler";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

type ParentAssignmentActionItem = {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  parentTip: string;
};

function buildAssignmentActionItems(params: {
  pending: number;
  dueSoon: number;
  overdue: number;
  reviewDueToday: number;
  studentName: string;
}) {
  const { pending, dueSoon, overdue, reviewDueToday, studentName } = params;
  const items: ParentAssignmentActionItem[] = [];

  if (overdue > 0) {
    items.push({
      id: "clear-overdue",
      title: "先清逾期作业",
      description: `今天优先完成 ${overdue} 份逾期作业，恢复作业节奏。`,
      estimatedMinutes: 25,
      parentTip: "先做最接近完成的一份，降低启动难度，完成后再做下一份。"
    });
  }

  if (dueSoon > 0) {
    items.push({
      id: "due-soon",
      title: "处理近2天到期作业",
      description: `近 2 天有 ${dueSoon} 份作业到期，建议今天提前完成。`,
      estimatedMinutes: 20,
      parentTip: "晚饭后先完成到期最近的一份，减少临近截止的焦虑。"
    });
  }

  items.push({
    id: "daily-checklist",
    title: "每日作业清单",
    description: `${studentName} 每天至少完成 1 份作业或 1 个模块任务，避免堆积。`,
    estimatedMinutes: 15,
    parentTip: "家长只需检查“是否完成 + 是否上传”，不要替代孩子完成过程。"
  });

  if (reviewDueToday > 0) {
    items.push({
      id: "review-today",
      title: "同步完成错题复练",
      description: `今日有 ${reviewDueToday} 题错题复练，建议与作业同日完成。`,
      estimatedMinutes: 15,
      parentTip: "复练后让孩子口述一条“下次不再错”的规则。"
    });
  }

  if (items.length < 3) {
    items.push({
      id: "stable-rhythm",
      title: "保持稳定节奏",
      description: pending > 0 ? "保持每天固定学习时段，按计划推进待完成作业。" : "作业完成良好，维持当前学习节奏。",
      estimatedMinutes: 10,
      parentTip: "每天同一时间开始学习，形成稳定习惯比单次时长更重要。"
    });
  }

  return items.slice(0, 3);
}

export const GET = createLearningRoute({
  role: "parent",
  cache: "private-realtime",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "parent") {
      unauthorized();
    }

    if (!user.studentId) {
      badRequest("missing student");
    }

    const student = await getUserById(user.studentId);
    if (!student) {
      notFound("student not found");
    }

    const classes = await getClassesByStudent(user.studentId);
    const classMap = new Map(classes.map((item) => [item.id, item]));
    const assignments = await getAssignmentsByClassIds(classes.map((item) => item.id));
    const progress = await getAssignmentProgressByStudent(user.studentId);
    const progressMap = new Map(progress.map((item) => [item.assignmentId, item]));

    const data = assignments.map((assignment) => {
      const klass = classMap.get(assignment.classId);
      const record = progressMap.get(assignment.id);
      return {
        id: assignment.id,
        title: assignment.title,
        dueDate: assignment.dueDate,
        className: klass?.name ?? "-",
        subject: klass?.subject ?? "-",
        grade: klass?.grade ?? "-",
        status: record?.status ?? "pending",
        score: record?.score ?? null,
        total: record?.total ?? null,
        completedAt: record?.completedAt ?? null
      };
    });

    const pending = data.filter((item) => item.status !== "completed");
    const dueSoon = pending.filter((item) => {
      const diff = new Date(item.dueDate).getTime() - Date.now();
      return diff >= 0 && diff <= 2 * 24 * 60 * 60 * 1000;
    });
    const overdue = pending.filter((item) => new Date(item.dueDate).getTime() < Date.now());
    const completed = data.filter((item) => item.status === "completed");
    const reviewQueue = await getUnifiedReviewQueue({ userId: user.studentId });
    const reviewDueToday = reviewQueue.summary.dueToday;

    const actionItems = buildAssignmentActionItems({
      pending: pending.length,
      dueSoon: dueSoon.length,
      overdue: overdue.length,
      reviewDueToday,
      studentName: student.name
    });
    const estimatedMinutes = actionItems.reduce((sum, item) => sum + item.estimatedMinutes, 0);
    const parentTips = actionItems.map((item) => item.parentTip);
    const receipts = await listParentActionReceipts({
      parentId: user.id,
      studentId: user.studentId,
      source: "assignment_plan"
    });
    const receiptMap = new Map(
      receipts.map((item) => [
        buildParentActionReceiptKey({
          source: item.source,
          actionItemId: item.actionItemId
        }),
        item
      ])
    );
    const actionItemsWithReceipt = actionItems.map((item) => {
      const receipt = receiptMap.get(
        buildParentActionReceiptKey({ source: "assignment_plan", actionItemId: item.id })
      );
      return {
        ...item,
        receipt: receipt
          ? {
              status: receipt.status,
              completedAt: receipt.completedAt,
              note: receipt.note ?? null,
              effectScore: receipt.effectScore
            }
          : null
      };
    });
    // Assignment plan cards are merged with execution receipts to form parent闭环视图.
    const completedCount = actionItemsWithReceipt.filter((item) => item.receipt?.status === "done").length;
    const skippedCount = actionItemsWithReceipt.filter((item) => item.receipt?.status === "skipped").length;
    const pendingCount = Math.max(0, actionItemsWithReceipt.length - completedCount - skippedCount);
    const doneEffectScore = receipts
      .filter((item) => item.status === "done")
      .reduce((sum, item) => sum + item.effectScore, 0);
    const skippedPenaltyScore = receipts
      .filter((item) => item.status === "skipped")
      .reduce((sum, item) => sum + item.effectScore, 0);
    const receiptEffectScore = doneEffectScore + skippedPenaltyScore;
    const history = summarizeParentActionReceipts(receipts);

    const reminderText = [
      `${student.name}本周作业提醒：待完成 ${pending.length} 份。`,
      overdue.length ? `已逾期 ${overdue.length} 份，请尽快完成。` : "",
      dueSoon.length ? `近 2 天到期 ${dueSoon.length} 份。` : "",
      reviewDueToday ? `今日错题复练 ${reviewDueToday} 题。` : "",
      ...dueSoon
        .slice(0, 3)
        .map(
          (item) =>
            `- ${item.className} · ${item.title}（截止 ${new Date(item.dueDate).toLocaleDateString("zh-CN")}）`
        )
    ]
      .filter(Boolean)
      .join("\n");

    return {
      student: { id: student.id, name: student.name },
      data,
      summary: {
        pending: pending.length,
        dueSoon: dueSoon.length,
        overdue: overdue.length,
        completed: completed.length,
        reviewDueToday
      },
      reminderText,
      actionItems: actionItemsWithReceipt,
      estimatedMinutes,
      parentTips,
      execution: {
        suggestedCount: actionItemsWithReceipt.length,
        completedCount,
        skippedCount,
        pendingCount,
        completionRate: actionItemsWithReceipt.length
          ? Math.round((completedCount / actionItemsWithReceipt.length) * 100)
          : 0,
        lastCompletedAt: receipts.find((item) => item.status === "done")?.completedAt ?? null,
        lastActionAt: receipts[0]?.completedAt ?? null,
        streakDays: history.streakDays,
        doneMinutes: history.doneMinutes
      },
      effect: {
        pendingDelta: pending.length - completed.length,
        receiptEffectScore,
        doneEffectScore,
        skippedPenaltyScore,
        last7dEffectScore: history.last7dEffectScore,
        avgEffectScore: history.avgEffectScore
      },
      history: {
        totalCount: history.totalCount,
        doneCount: history.doneCount,
        skippedCount: history.skippedCount,
        last7dDoneCount: history.last7dDoneCount,
        last7dSkippedCount: history.last7dSkippedCount,
        lastActionAt: history.lastActionAt
      }
    };
  }
});
