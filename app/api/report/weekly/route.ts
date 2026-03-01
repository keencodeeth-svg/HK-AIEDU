import { getStudentContext } from "@/lib/user-context";
import { getCurrentUser } from "@/lib/auth";
import { getStudentProfile } from "@/lib/profiles";
import {
  buildParentActionReceiptKey,
  listParentActionReceipts,
  summarizeParentActionReceipts
} from "@/lib/parent-action-receipts";
import { getDailyAccuracy, getStatsBetween, getWeakKnowledgePoints, getWeeklyStats } from "@/lib/progress";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

type WeeklyActionItem = {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  parentTip: string;
};

function pickActionItems(params: {
  stats: { total: number; accuracy: number };
  previousStats: { total: number; accuracy: number };
  weakPoints: { id: string; title: string; ratio: number; total: number; subject: string }[];
}) {
  const { stats, previousStats, weakPoints } = params;
  const items: WeeklyActionItem[] = [];

  const dailyCount = stats.total < 21 ? 6 : 4;
  items.push({
    id: "daily-practice",
    title: "每日固定练习",
    description: `每天完成 ${dailyCount} 题基础练习，保持稳定学习节奏。`,
    estimatedMinutes: 15,
    parentTip: "建议固定一个 15 分钟时段，完成后打卡并口头复盘 1 个错因。"
  });

  if (weakPoints.length) {
    const topWeak = weakPoints[0];
    items.push({
      id: `weak-${topWeak.id}`,
      title: `重点修复：${topWeak.title}`,
      description: `围绕该知识点补练 5 题，目标将正确率从 ${topWeak.ratio}% 提升到 70%+。`,
      estimatedMinutes: 20,
      parentTip: "先让孩子讲思路再做题，做完只纠正一个核心错误，避免一次讲太多。"
    });
  } else {
    items.push({
      id: "keep-strength",
      title: "优势巩固",
      description: "本周无明显薄弱点，建议继续完成 1 组综合训练保持手感。",
      estimatedMinutes: 15,
      parentTip: "练习后让孩子复述 1 道题的解题步骤，强化表达与迁移。"
    });
  }

  if (stats.accuracy < 65 || stats.accuracy + 5 < previousStats.accuracy) {
    items.push({
      id: "wrong-review",
      title: "错题复盘",
      description: "从本周错题中挑 3 题复盘，写出“错因 + 正确做法”。",
      estimatedMinutes: 15,
      parentTip: "复盘时只问两个问题：为什么错、下次怎么避免，避免直接给答案。"
    });
  } else {
    items.push({
      id: "advance-practice",
      title: "进阶挑战",
      description: "本周表现稳定，可增加 3 题进阶题，提升思维与迁移能力。",
      estimatedMinutes: 15,
      parentTip: "遇到难题先鼓励分步作答，不追求一次做对，关注思考过程。"
    });
  }

  return items.slice(0, 3);
}

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const user = await getCurrentUser();
    const student = await getStudentContext();
    if (!student) {
      unauthorized();
    }

    const stats = await getWeeklyStats(student.id);
    const profile = await getStudentProfile(student.id);
    const subjects = profile?.subjects?.length ? profile.subjects : ["math"];
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    const prevStart = new Date();
    prevStart.setDate(end.getDate() - 14);
    const previousStats = await getStatsBetween(student.id, prevStart, start);
    const trend = await getDailyAccuracy(student.id, 7);

    const weakPoints = (
      await Promise.all(
        subjects.map(async (subject) =>
          (await getWeakKnowledgePoints(student.id, subject)).map((item) => ({
            id: item.kp.id,
            title: item.kp.title,
            ratio: Math.round(item.ratio * 100),
            total: item.total,
            subject
          }))
        )
      )
    )
      .flat()
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 5);

    const suggestions: string[] = [];
    if (stats.total < 5) {
      suggestions.push("本周练习偏少，建议每天完成 5-8 题。");
    }
    if (stats.accuracy < 60) {
      suggestions.push("正确率偏低，建议先巩固基础知识点，再逐步提升难度。");
    }
    if (stats.accuracy >= previousStats.accuracy + 5) {
      suggestions.push("正确率提升明显，继续保持当前节奏。");
    } else if (stats.accuracy + 5 < previousStats.accuracy) {
      suggestions.push("正确率有所下降，建议复盘错因并进行错题专练。");
    }
    if (weakPoints.length) {
      suggestions.push(`优先巩固：${weakPoints[0].title}。`);
    }

    const actionItems = pickActionItems({ stats, previousStats, weakPoints });
    const estimatedMinutes = actionItems.reduce((sum, item) => sum + item.estimatedMinutes, 0);
    const parentTips = actionItems.map((item) => item.parentTip);
    const receipts =
      user?.role === "parent"
        ? await listParentActionReceipts({
            parentId: user.id,
            studentId: student.id,
            source: "weekly_report"
          })
        : [];
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
        buildParentActionReceiptKey({ source: "weekly_report", actionItemId: item.id })
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
    // Weekly report renders action cards with latest parent execution receipt.
    const completedCount = actionItemsWithReceipt.filter((item) => item.receipt?.status === "done").length;
    const skippedCount = actionItemsWithReceipt.filter((item) => item.receipt?.status === "skipped").length;
    const pendingCount = Math.max(0, actionItemsWithReceipt.length - completedCount - skippedCount);
    const doneEffectScore = receipts
      .filter((item) => item.status === "done")
      .reduce((sum, item) => sum + item.effectScore, 0);
    const skippedPenaltyScore = receipts
      .filter((item) => item.status === "skipped")
      .reduce((sum, item) => sum + item.effectScore, 0);
    const effectScore = doneEffectScore + skippedPenaltyScore;
    const history = summarizeParentActionReceipts(receipts);

    return {
      student: { id: student.id, name: student.name, grade: student.grade },
      stats,
      previousStats,
      trend,
      weakPoints,
      suggestions,
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
        accuracyDelta: stats.accuracy - previousStats.accuracy,
        weeklyAccuracy: stats.accuracy,
        previousAccuracy: previousStats.accuracy,
        receiptEffectScore: effectScore,
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
