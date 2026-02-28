import { getCurrentUser, getParentsByStudentId } from "@/lib/auth";
import { createAssignment } from "@/lib/assignments";
import { getClassById, getClassStudentIds } from "@/lib/classes";
import { getQuestions, getKnowledgePoints } from "@/lib/content";
import { createNotification } from "@/lib/notifications";
import { listQuestionQualityMetrics } from "@/lib/question-quality";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

type DispatchItem = {
  id?: string;
  knowledgePointId?: string;
  title?: string;
  suggestedCount?: number;
  dueInDays?: number;
};

const dispatchBodySchema = v.object<{
  classId: string;
  items: DispatchItem[];
  includeIsolated?: boolean;
  autoRelaxOnInsufficient?: boolean;
}>(
  {
    classId: v.string({ minLength: 1 }),
    items: v.array(
      v.object<DispatchItem>(
        {
          id: v.optional(v.string({ allowEmpty: true, trim: false })),
          knowledgePointId: v.optional(v.string({ allowEmpty: true, trim: false })),
          title: v.optional(v.string({ allowEmpty: true, trim: false })),
          suggestedCount: v.optional(v.number({ coerce: true, integer: true, min: 1, max: 30 })),
          dueInDays: v.optional(v.number({ coerce: true, integer: true, min: 1, max: 30 }))
        },
        { allowUnknown: false }
      ),
      { minLength: 1, maxLength: 20 }
    ),
    includeIsolated: v.optional(v.boolean()),
    autoRelaxOnInsufficient: v.optional(v.boolean())
  },
  { allowUnknown: false }
);

function sampleQuestions<T>(items: T[], count: number) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeDueDate(days: number) {
  const due = new Date();
  due.setDate(due.getDate() + Math.max(1, days));
  due.setHours(23, 59, 0, 0);
  return due.toISOString();
}

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    unauthorized();
  }

  const body = await parseJson(request, dispatchBodySchema);
  const klass = await getClassById(body.classId);
  if (!klass || klass.teacherId !== user.id) {
    notFound("class not found");
  }

  const [questions, knowledgePoints, studentIds] = await Promise.all([
    getQuestions(),
    getKnowledgePoints(),
    getClassStudentIds(klass.id)
  ]);
  const classQuestions = questions.filter((item) => item.subject === klass.subject && item.grade === klass.grade);
  if (!classQuestions.length) {
    badRequest("当前班级题库为空，无法布置复练单");
  }
  const includeIsolated = body.includeIsolated === true;
  const autoRelaxOnInsufficient = body.autoRelaxOnInsufficient === true;
  const qualityMetrics = await listQuestionQualityMetrics({
    questionIds: classQuestions.map((item) => item.id)
  });
  const isolatedSet = new Set(qualityMetrics.filter((item) => item.isolated).map((item) => item.questionId));
  const isolatedPoolCount = classQuestions.filter((item) => isolatedSet.has(item.id)).length;

  const kpTitleMap = new Map(knowledgePoints.map((item) => [item.id, item.title]));
  const created: Array<{
    itemId: string;
    assignmentId: string;
    title: string;
    dueDate: string;
    questionCount: number;
    knowledgePointId: string | null;
    relaxedRule: "broaden_scope" | "allow_isolated" | null;
    relaxedReason: string | null;
  }> = [];
  const failed: Array<{
    itemId: string;
    title: string;
    reason: string;
    item: Required<Pick<DispatchItem, "id" | "title" | "suggestedCount" | "dueInDays">> & {
      knowledgePointId?: string;
    };
  }> = [];
  const relaxed: Array<{
    itemId: string;
    title: string;
    rule: "broaden_scope" | "allow_isolated";
    reason: string;
  }> = [];
  let isolatedExcludedCount = 0;
  let selectedIsolatedCount = 0;

  for (const [index, item] of body.items.entries()) {
    const itemId = item.id?.trim() || `item-${index + 1}`;
    const targetCount = clamp(item.suggestedCount ?? 5, 3, 12);
    const dueInDays = clamp(item.dueInDays ?? 1, 1, 14);
    const dueDate = normalizeDueDate(dueInDays);
    const knowledgePointId = item.knowledgePointId?.trim() || null;
    const kpTitle = knowledgePointId ? kpTitleMap.get(knowledgePointId) : undefined;
    const titleBase = item.title?.trim() || (kpTitle ? `课后复练：${kpTitle}` : `课后复练任务 ${index + 1}`);
    const retryItem = {
      id: itemId,
      title: titleBase,
      suggestedCount: targetCount,
      dueInDays,
      ...(knowledgePointId ? { knowledgePointId } : {})
    };

    let scopedPool = classQuestions;
    if (knowledgePointId) {
      const scoped = classQuestions.filter((question) => question.knowledgePointId === knowledgePointId);
      if (scoped.length) {
        scopedPool = scoped;
      }
    }

    let pool = scopedPool;
    const excludedByIsolation = !includeIsolated ? pool.filter((question) => isolatedSet.has(question.id)).length : 0;
    if (!includeIsolated) {
      pool = pool.filter((question) => !isolatedSet.has(question.id));
      isolatedExcludedCount += excludedByIsolation;
    }

    let relaxedRule: "broaden_scope" | "allow_isolated" | null = null;
    let relaxedReason: string | null = null;
    if (pool.length < 3 && autoRelaxOnInsufficient) {
      if (knowledgePointId) {
        let broadenPool = classQuestions;
        if (!includeIsolated) {
          broadenPool = broadenPool.filter((question) => !isolatedSet.has(question.id));
        }
        if (broadenPool.length >= 3) {
          pool = broadenPool;
          relaxedRule = "broaden_scope";
          relaxedReason = "知识点题量不足，已自动放宽到班级同学科题池。";
        }
      }

      if (pool.length < 3 && !includeIsolated) {
        const allowIsolatedPool = relaxedRule === "broaden_scope" ? classQuestions : scopedPool;
        if (allowIsolatedPool.length >= 3) {
          pool = allowIsolatedPool;
          relaxedRule = "allow_isolated";
          relaxedReason =
            relaxedRule === "allow_isolated" && knowledgePointId
              ? "题量不足，已自动启用隔离池高风险题参与抽题。"
              : "题量不足，已自动启用隔离池高风险题参与抽题。";
        }
      }
    }

    if (pool.length < 3) {
      failed.push({
        itemId,
        title: titleBase,
        reason:
          !includeIsolated && excludedByIsolation > 0
            ? `题库可用题目不足（已排除 ${excludedByIsolation} 道隔离池高风险题，至少需要 3 题）`
            : "题库可用题目不足（至少需要 3 题）",
        item: retryItem
      });
      continue;
    }

    const selected = sampleQuestions(pool, Math.min(targetCount, pool.length));
    selectedIsolatedCount += selected.filter((question) => isolatedSet.has(question.id)).length;
    if (selected.length < 3) {
      failed.push({
        itemId,
        title: titleBase,
        reason: "抽题失败（可用题量不足）",
        item: retryItem
      });
      continue;
    }

    const assignment = await createAssignment({
      classId: klass.id,
      title: `${titleBase}（AI讲评包）`,
      description: `来源于班级共性错因讲评包，建议在 ${item.dueInDays ?? 1} 天内完成。`,
      dueDate,
      questionIds: selected.map((question) => question.id),
      submissionType: "quiz"
    });
    created.push({
      itemId,
      assignmentId: assignment.id,
      title: assignment.title,
      dueDate: assignment.dueDate,
      questionCount: selected.length,
      knowledgePointId,
      relaxedRule,
      relaxedReason
    });
    if (relaxedRule && relaxedReason) {
      relaxed.push({
        itemId,
        title: titleBase,
        rule: relaxedRule,
        reason: relaxedReason
      });
    }
  }

  let studentsNotified = 0;
  let parentsNotified = 0;
  if (created.length && studentIds.length) {
    const nearestDueDate = created
      .map((item) => new Date(item.dueDate).getTime())
      .filter((ts) => Number.isFinite(ts))
      .sort((a, b) => a - b)[0];
    const dueHint = Number.isFinite(nearestDueDate)
      ? new Date(nearestDueDate).toLocaleDateString("zh-CN")
      : "近期";

    const parentPairs = await Promise.all(
      studentIds.map(async (studentId) => ({
        studentId,
        parents: await getParentsByStudentId(studentId)
      }))
    );

    for (const pair of parentPairs) {
      await createNotification({
        userId: pair.studentId,
        title: "讲评包复练任务已下发",
        content: `老师已下发 ${created.length} 条复练任务，请于 ${dueHint} 前完成。`,
        type: "teacher_alert_action"
      });
      studentsNotified += 1;

      for (const parent of pair.parents) {
        await createNotification({
          userId: parent.id,
          title: "孩子讲评包复练任务",
          content: `孩子所在班级「${klass.name}」已下发 ${created.length} 条复练任务，请协助督促完成。`,
          type: "teacher_alert_action"
        });
        parentsNotified += 1;
      }
    }
  }

  return {
    data: {
      classId: klass.id,
      className: klass.name,
      created,
      failed,
      summary: {
        requested: body.items.length,
        created: created.length,
        failed: failed.length,
        relaxedCount: relaxed.length,
        studentsNotified,
        parentsNotified,
        autoRelaxOnInsufficient,
        qualityGovernance: {
          includeIsolated,
          isolatedPoolCount,
          isolatedExcludedCount,
          selectedIsolatedCount
        },
        relaxed
      }
    }
  };
  }
});
