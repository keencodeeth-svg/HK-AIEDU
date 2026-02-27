import { getCurrentUser } from "@/lib/auth";
import { getClassById, getClassStudentIds } from "@/lib/classes";
import { getKnowledgePoints, getQuestions } from "@/lib/content";
import { generateWrongReviewScript } from "@/lib/ai";
import { assessAiQuality } from "@/lib/ai-quality-control";
import { getAttemptsByUsers } from "@/lib/progress";
import { notFound, unauthorized, withApi } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

const bodySchema = v.object<{ classId: string; rangeDays?: number }>(
  {
    classId: v.string({ minLength: 1 }),
    rangeDays: v.optional(v.number({ coerce: true, integer: true, min: 1 }))
  },
  { allowUnknown: false }
);

function levelByRatio(ratio: number) {
  if (ratio >= 0.35) return "高频";
  if (ratio >= 0.2) return "中频";
  return "低频";
}

type CommonCauseKey = "concept" | "reading" | "calculation" | "strategy" | "review";

type CommonCauseMeta = {
  title: string;
  remediationTip: string;
  classAction: string;
};

const COMMON_CAUSE_META: Record<CommonCauseKey, CommonCauseMeta> = {
  concept: {
    title: "概念理解偏差",
    remediationTip: "先用反例澄清概念边界，再做 1 题即时判断题。",
    classAction: "课堂前 5 分钟做概念对照讲解 + 口头复述。"
  },
  reading: {
    title: "审题与条件提取不足",
    remediationTip: "训练“划关键词 -> 列条件 -> 再作答”的三步法。",
    classAction: "每题先写关键条件，教师抽查后再统一讲解。"
  },
  calculation: {
    title: "计算与步骤准确性不足",
    remediationTip: "将易错步骤拆分打点，强调每步验算。",
    classAction: "安排 8 分钟限时计算+同伴互查，立即纠偏。"
  },
  strategy: {
    title: "解题策略选择不当",
    remediationTip: "先比较可选方法，再明确最优解题路径。",
    classAction: "用同题多解对比“为何选这种方法”。"
  },
  review: {
    title: "复练巩固不足",
    remediationTip: "按 24h/72h/7d 节奏安排短周期回顾。",
    classAction: "课末布置复练单并在下节课前 3 分钟抽测。"
  }
};

function includesAny(text: string, keywords: string[]) {
  return keywords.some((item) => text.includes(item));
}

function detectCommonCause(input: {
  reason?: string;
  questionType?: string;
  stem?: string;
  explanation?: string;
}): CommonCauseKey {
  const reasonText = (input.reason ?? "").toLowerCase();
  const fullText = `${reasonText} ${(input.stem ?? "").toLowerCase()} ${(input.explanation ?? "").toLowerCase()}`;
  const questionType = (input.questionType ?? "").toLowerCase();

  if (
    includesAny(reasonText, ["wrong-book-review", "复练", "遗忘", "回忆", "间隔"]) ||
    includesAny(fullText, ["复习不到位", "巩固不足"])
  ) {
    return "review";
  }
  if (
    includesAny(fullText, [
      "计算",
      "算错",
      "粗心",
      "进位",
      "借位",
      "符号",
      "小数点",
      "抄错",
      "笔误",
      "化简",
      "通分",
      "约分"
    ]) ||
    includesAny(questionType, ["calculation", "计算"])
  ) {
    return "calculation";
  }
  if (
    includesAny(fullText, ["审题", "读题", "题意", "漏看", "看错", "条件", "关键信息", "题干", "至少", "最多"]) ||
    includesAny(questionType, ["application", "应用"])
  ) {
    return "reading";
  }
  if (
    includesAny(fullText, ["方法", "思路", "步骤", "策略", "模型", "列式", "方程", "不会", "无从下手", "时间不够"]) ||
    includesAny(questionType, ["proof", "综合", "strategy"])
  ) {
    return "strategy";
  }
  if (includesAny(fullText, ["概念", "定义", "理解", "单位", "公式含义", "边界", "性质"])) {
    return "concept";
  }
  if (includesAny(questionType, ["choice", "判断", "填空"])) {
    return "concept";
  }
  return "strategy";
}

export const POST = withApi(async (request) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    unauthorized();
  }

  const body = await parseJson(request, bodySchema);
  const klass = await getClassById(body.classId);
  if (!klass || klass.teacherId !== user.id) {
    notFound("not found");
  }

  const rangeDays = Math.max(3, Math.min(Number(body.rangeDays) || 7, 60));
  const since = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
  const studentIds = await getClassStudentIds(klass.id);
  const attempts = await getAttemptsByUsers(studentIds);
  const scopedAttempts = attempts.filter((item) => new Date(item.createdAt).getTime() >= since);
  const wrongAttempts = scopedAttempts.filter((item) => !item.correct);

  const [questions, kps] = await Promise.all([getQuestions(), getKnowledgePoints()]);
  const questionMap = new Map(questions.map((item) => [item.id, item]));
  const kpMap = new Map(kps.map((item) => [item.id, item]));

  const kpWrongCount = new Map<string, number>();
  const questionWrongCount = new Map<string, number>();
  wrongAttempts.forEach((item) => {
    kpWrongCount.set(item.knowledgePointId, (kpWrongCount.get(item.knowledgePointId) ?? 0) + 1);
    questionWrongCount.set(item.questionId, (questionWrongCount.get(item.questionId) ?? 0) + 1);
  });

  const totalWrong = wrongAttempts.length || 1;
  const wrongPoints = Array.from(kpWrongCount.entries())
    .map(([kpId, count]) => ({
      kpId,
      title: kpMap.get(kpId)?.title ?? "未知知识点",
      count,
      ratio: Math.round((count / totalWrong) * 100)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const reviewOrder = wrongPoints.map((item, index) => ({
    order: index + 1,
    knowledgePointId: item.kpId,
    title: item.title,
    wrongCount: item.count,
    wrongRatio: item.ratio,
    level: levelByRatio(item.count / totalWrong),
    teachFocus:
      index === 0
        ? "先讲典型误区，再做 1 题示范。"
        : index <= 2
          ? "讲关键条件识别，安排同类变式练习。"
          : "快速回顾，布置课后复练。"
  }));

  const exemplarQuestions = reviewOrder.map((item) => {
    const matched = Array.from(questionWrongCount.entries())
      .map(([questionId, count]) => ({ questionId, count, question: questionMap.get(questionId) }))
      .filter((entry) => entry.question?.knowledgePointId === item.knowledgePointId)
      .sort((a, b) => b.count - a.count)[0];
    return {
      knowledgePointId: item.knowledgePointId,
      title: item.title,
      questionId: matched?.questionId ?? null,
      stem: matched?.question?.stem ?? "请从班级错题本中挑选该知识点典型题。",
      wrongCount: matched?.count ?? 0
    };
  });

  const classTasks = reviewOrder.slice(0, 3).map((item, idx) => ({
    id: `task-${idx + 1}`,
    title: `${item.title} 课堂任务`,
    instruction: `完成 2 题同类题 + 1 题变式题，限时 ${10 + idx * 2} 分钟。`,
    target: "当堂完成并口头复述关键步骤"
  }));

  const afterClassReviewSheet = reviewOrder.slice(0, 4).map((item, idx) => ({
    id: `sheet-${idx + 1}`,
    knowledgePointId: item.knowledgePointId,
    title: `课后复练：${item.title}`,
    suggestedCount: idx === 0 ? 6 : 4,
    dueInDays: idx === 0 ? 1 : idx <= 2 ? 3 : 7
  }));

  const causeBuckets = new Map<
    CommonCauseKey,
    {
      count: number;
      kpCount: Map<string, number>;
      signals: Set<string>;
    }
  >();

  wrongAttempts.forEach((attempt) => {
    const question = questionMap.get(attempt.questionId);
    const cause = detectCommonCause({
      reason: attempt.reason,
      questionType: question?.questionType,
      stem: question?.stem,
      explanation: question?.explanation
    });
    const current = causeBuckets.get(cause) ?? { count: 0, kpCount: new Map<string, number>(), signals: new Set<string>() };
    current.count += 1;
    current.kpCount.set(attempt.knowledgePointId, (current.kpCount.get(attempt.knowledgePointId) ?? 0) + 1);

    if (attempt.reason) {
      current.signals.add(attempt.reason);
    } else if (question?.questionType) {
      current.signals.add(`题型：${question.questionType}`);
    }
    causeBuckets.set(cause, current);
  });

  const commonCauseStats = Array.from(causeBuckets.entries())
    .map(([causeKey, bucket]) => {
      const meta = COMMON_CAUSE_META[causeKey];
      const linkedKnowledgePoints = Array.from(bucket.kpCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([knowledgePointId]) => ({
          knowledgePointId,
          title: kpMap.get(knowledgePointId)?.title ?? "未知知识点"
        }));
      const ratio = Math.round((bucket.count / totalWrong) * 100);

      return {
        causeKey,
        causeTitle: meta.title,
        count: bucket.count,
        ratio,
        level: levelByRatio(bucket.count / totalWrong),
        linkedKnowledgePoints,
        typicalSignals: Array.from(bucket.signals).slice(0, 3),
        remediationTip: meta.remediationTip,
        classAction: meta.classAction
      };
    })
    .sort((a, b) => b.count - a.count);

  const script =
    (await generateWrongReviewScript({
      subject: klass.subject,
      grade: klass.grade,
      className: klass.name,
      wrongPoints: wrongPoints.map((item) => item.title)
    })) ?? {
      agenda: ["先讲共性错因", "再做示范题", "当堂练习与纠偏", "布置课后复练"],
      script: [
        "先让学生说出易错步骤，再归纳共性错因。",
        "教师示范 1 题，强调“条件识别 -> 方法选择 -> 计算验证”。",
        "学生独立练习，教师巡回纠偏。",
        "课末布置 24h/72h 复练单并明确检查标准。"
      ],
      reminders: ["讲评顺序遵循错因频次", "避免一次讲太多知识点", "每段讲评后都要有即时练习"]
    };
  const quality = assessAiQuality({
    kind: "assist",
    provider: "unknown",
    textBlocks: [
      ...reviewOrder.map((item) => `${item.title} ${item.teachFocus}`),
      ...(script.agenda ?? []),
      ...(script.script ?? []),
      ...(script.reminders ?? [])
    ],
    listCountHint:
      reviewOrder.length +
      (script.agenda?.length ?? 0) +
      (script.script?.length ?? 0) +
      (script.reminders?.length ?? 0)
  });

  return {
    data: {
      classId: klass.id,
      className: klass.name,
      subject: klass.subject,
      grade: klass.grade,
      rangeDays,
      summary: {
        totalAttempts: scopedAttempts.length,
        totalWrong: wrongAttempts.length,
        topWrongKnowledgePoints: wrongPoints.length
      },
      reviewOrder,
      commonCauseStats,
      exemplarQuestions,
      classTasks,
      afterClassReviewSheet,
      script,
      quality,
      manualReviewRule: quality.needsHumanReview ? "建议教师先人工核查讲评顺序与示例题后再下发。" : ""
    }
  };
});
