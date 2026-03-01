import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { getClassById } from "@/lib/classes";
import { getKnowledgePoints, getQuestions } from "@/lib/content";
import { generateQuestionDraft, hasConfiguredLlmProvider } from "@/lib/ai";
import { listQuestionQualityMetrics } from "@/lib/question-quality";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const generatePaperBodySchema = v.object<{
  classId?: string;
  subject?: string;
  grade?: string;
  knowledgePointIds?: string[];
  difficulty?: "easy" | "medium" | "hard" | "all";
  questionType?: string;
  durationMinutes?: number;
  questionCount?: number;
  mode?: "bank" | "ai";
  includeIsolated?: boolean;
}>(
  {
    classId: v.optional(v.string({ minLength: 1 })),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    knowledgePointIds: v.optional(v.array(v.string({ minLength: 1 }))),
    difficulty: v.optional(v.enum(["easy", "medium", "hard", "all"] as const)),
    questionType: v.optional(v.string({ minLength: 1 })),
    durationMinutes: v.optional(v.number({ coerce: true, integer: true, min: 0 })),
    questionCount: v.optional(v.number({ coerce: true, integer: true, min: 0 })),
    mode: v.optional(v.enum(["bank", "ai"] as const)),
    includeIsolated: v.optional(v.boolean())
  },
  { allowUnknown: false }
);

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type GeneratedQuestion = {
  id: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
  knowledgePointId: string;
  source: "bank" | "ai";
};

type PoolQuestion = {
  id: string;
  subject: string;
  grade: string;
  knowledgePointId: string;
  difficulty?: string;
  questionType?: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
};

type PoolStage = {
  key: string;
  label: string;
  totalPool: PoolQuestion[];
  activePool: PoolQuestion[];
  isolatedExcludedCount: number;
};

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];
  items.forEach((item) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    result.push(item);
  });
  return result;
}

function buildRuleFallbackQuestion(params: {
  index: number;
  subject: string;
  grade: string;
  knowledgePointId: string;
  knowledgePointTitle: string;
}): GeneratedQuestion {
  const index = params.index + 1;
  if (params.subject === "math") {
    const left = 8 + index * 3;
    const right = 5 + index;
    const answer = String(left + right);
    return {
      id: `rule-${crypto.randomBytes(5).toString("hex")}`,
      stem: `已知 ${left} + ${right} = ?`,
      options: [answer, String(left + right + 1), String(left + right - 1), String(left + right + 2)],
      answer,
      explanation: `先把两个加数相加：${left} + ${right} = ${answer}。`,
      knowledgePointId: params.knowledgePointId,
      source: "ai"
    };
  }

  const answer = "B";
  return {
    id: `rule-${crypto.randomBytes(5).toString("hex")}`,
    stem: `${params.knowledgePointTitle}相关基础题（第 ${index} 题）：以下说法最准确的是？`,
    options: ["A. 完全无关", "B. 与知识点要求一致", "C. 条件不足无法判断", "D. 以上都不对"],
    answer,
    explanation: "该题用于保障组卷可用性，建议后续替换为题库或AI正式题目。",
    knowledgePointId: params.knowledgePointId,
    source: "ai"
  };
}

function normalizeQuestionType(value: string | undefined) {
  return (value ?? "choice").trim().toLowerCase();
}

export const POST = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const body = await parseJson(request, generatePaperBodySchema);

    let subject = body.subject ?? "math";
    let grade = body.grade ?? "4";
    let className = "";

    if (body.classId) {
      const klass = await getClassById(body.classId);
      if (!klass || klass.teacherId !== user.id) {
        notFound("not found");
      }
      subject = klass.subject;
      grade = klass.grade;
      className = klass.name;
    }

    const questionCountInput = Number(body.questionCount) || 0;
    const durationMinutes = Number(body.durationMinutes) || 0;
    let count = questionCountInput;
    if (!count) {
      count = durationMinutes ? Math.max(5, Math.round(durationMinutes / 2)) : 10;
    }
    count = Math.max(1, Math.min(count, 50));

    const knowledgePointIds = Array.isArray(body.knowledgePointIds) ? body.knowledgePointIds : [];
    const difficulty =
      body.difficulty && body.difficulty !== "all"
        ? (body.difficulty as "easy" | "medium" | "hard")
        : undefined;
    const questionType = body.questionType && body.questionType !== "all" ? body.questionType : undefined;
    const mode = body.mode ?? "bank";

    const allQuestions = (await getQuestions()) as PoolQuestion[];
    const classScopedQuestions = allQuestions.filter((q) => q.subject === subject && q.grade === grade);
    const includeIsolated = body.includeIsolated === true;
    let qualityMetrics = [] as Awaited<ReturnType<typeof listQuestionQualityMetrics>>;
    let qualityGovernanceDegraded = false;
    try {
      qualityMetrics = await listQuestionQualityMetrics({
        questionIds: classScopedQuestions.map((item) => item.id)
      });
    } catch {
      // If quality storage is degraded, keep paper generation available and mark degraded state.
      qualityGovernanceDegraded = true;
      qualityMetrics = [];
    }
    const isolatedSet = new Set(qualityMetrics.filter((item) => item.isolated).map((item) => item.questionId));
    const isolatedPoolCount = classScopedQuestions.filter((item) => isolatedSet.has(item.id)).length;

    const stageDefs = [
      { key: "strict", label: "严格筛选", useKnowledgePoint: true, useDifficulty: true, useQuestionType: true, crossGrade: false },
      {
        key: "relax_question_type",
        label: "放宽题型",
        useKnowledgePoint: true,
        useDifficulty: true,
        useQuestionType: false,
        crossGrade: false
      },
      {
        key: "relax_difficulty",
        label: "放宽难度+题型",
        useKnowledgePoint: true,
        useDifficulty: false,
        useQuestionType: false,
        crossGrade: false
      },
      {
        key: "relax_knowledge_point",
        label: "放宽知识点",
        useKnowledgePoint: false,
        useDifficulty: false,
        useQuestionType: false,
        crossGrade: false
      },
      {
        key: "cross_grade",
        label: "同学科跨年级补题",
        useKnowledgePoint: false,
        useDifficulty: false,
        useQuestionType: false,
        crossGrade: true
      }
    ] as const;

    const stages: PoolStage[] = [];
    const stageFingerprint = new Set<string>();
    stageDefs.forEach((stage) => {
      let pool = stage.crossGrade
        ? allQuestions.filter((item) => item.subject === subject)
        : classScopedQuestions.slice();
      if (stage.useKnowledgePoint && knowledgePointIds.length) {
        pool = pool.filter((item) => knowledgePointIds.includes(item.knowledgePointId));
      }
      if (stage.useDifficulty && difficulty) {
        pool = pool.filter((item) => item.difficulty === difficulty);
      }
      if (stage.useQuestionType && questionType) {
        pool = pool.filter((item) => normalizeQuestionType(item.questionType) === normalizeQuestionType(questionType));
      }
      pool = uniqueById(pool);
      const fingerprint = pool.map((item) => item.id).sort().join("|");
      if (stageFingerprint.has(fingerprint)) return;
      stageFingerprint.add(fingerprint);
      const activePool = includeIsolated ? pool : pool.filter((item) => !isolatedSet.has(item.id));
      stages.push({
        key: stage.key,
        label: stage.label,
        totalPool: pool,
        activePool,
        isolatedExcludedCount: includeIsolated ? 0 : Math.max(0, pool.length - activePool.length)
      });
    });

    const strictStage = stages[0];
    const enoughStage = stages.find((stage) => stage.activePool.length >= count);
    const selectedStage =
      enoughStage ??
      stages
        .slice()
        .sort((left, right) => {
          if (right.activePool.length !== left.activePool.length) {
            return right.activePool.length - left.activePool.length;
          }
          return right.totalPool.length - left.totalPool.length;
        })[0];
    const selectedPool = selectedStage ? (includeIsolated ? selectedStage.totalPool : selectedStage.activePool) : [];
    const selected = shuffle(selectedPool).slice(0, Math.min(count, selectedPool.length));
    let generated: GeneratedQuestion[] = selected.map((item) => ({ ...item, source: "bank" as const }));
    let aiAttemptedCount = 0;
    let aiGeneratedCount = 0;
    let ruleFallbackCount = 0;
    const aiConfigured = hasConfiguredLlmProvider("chat");
    const knowledgePoints = await getKnowledgePoints();
    const subjectGradeKps = knowledgePoints.filter((kp) => kp.subject === subject && kp.grade === grade);
    const subjectKps = knowledgePoints.filter((kp) => kp.subject === subject);
    const kpPool = uniqueById(
      [
        ...knowledgePoints.filter((kp) => knowledgePointIds.includes(kp.id)),
        ...subjectGradeKps,
        ...subjectKps
      ].map((item) => ({ ...item, id: item.id }))
    );
    const allowAiFill = mode === "ai" || generated.length === 0;

    if (allowAiFill && generated.length < count && aiConfigured) {
      // AI fills shortage after bank stage fallback. Max attempts > missing to tolerate intermittent model failures.
      const maxAttempts = Math.max((count - generated.length) * 2, 4);
      const usedStem = new Set(generated.map((item) => item.stem.trim()));
      for (let i = 0; i < maxAttempts && generated.length < count; i += 1) {
        aiAttemptedCount += 1;
        const kp = kpPool[i % Math.max(1, kpPool.length)];
        const draft = await generateQuestionDraft({
          subject,
          grade,
          knowledgePointTitle: kp?.title ?? `${subject}基础知识`,
          chapter: kp?.chapter ?? "综合",
          difficulty: difficulty ?? "medium",
          questionType: questionType ?? "choice"
        });
        if (!draft) continue;
        const normalizedStem = draft.stem.trim();
        if (!normalizedStem || usedStem.has(normalizedStem)) continue;
        usedStem.add(normalizedStem);
        generated.push({
          id: `ai-${crypto.randomBytes(6).toString("hex")}`,
          stem: draft.stem,
          options: draft.options,
          answer: draft.answer,
          explanation: draft.explanation,
          knowledgePointId: kp?.id ?? "",
          source: "ai"
        });
        aiGeneratedCount += 1;
      }
    }

    if (generated.length === 0) {
      // Final deterministic fallback guarantees teacher always gets previewable questions instead of 0.
      const fallbackCount = Math.max(1, Math.min(count, 5));
      const fallbackKp = kpPool[0] ?? subjectGradeKps[0] ?? subjectKps[0];
      for (let i = 0; i < fallbackCount; i += 1) {
        const fallback = buildRuleFallbackQuestion({
          index: i,
          subject,
          grade,
          knowledgePointId: fallbackKp?.id ?? "",
          knowledgePointTitle: fallbackKp?.title ?? `${subject}基础`
        });
        generated.push(fallback);
        ruleFallbackCount += 1;
      }
    }

    const kpMap = new Map(knowledgePoints.map((kp) => [kp.id, kp]));
    const result = generated.map((item) => ({
      ...item,
      knowledgePointTitle: kpMap.get(item.knowledgePointId)?.title ?? "未归类",
      chapter: kpMap.get(item.knowledgePointId)?.chapter ?? "",
      unit: kpMap.get(item.knowledgePointId)?.unit ?? ""
    }));
    const shortfallCount = Math.max(0, count - result.length);
    const reasonCodes: string[] = [];
    if (!strictStage || strictStage.activePool.length === 0) reasonCodes.push("strict_pool_empty");
    if (selectedStage && strictStage && selectedStage.key !== strictStage.key) reasonCodes.push("filters_relaxed");
    if (!includeIsolated && selectedStage?.isolatedExcludedCount) reasonCodes.push("isolated_excluded");
    if (allowAiFill && aiAttemptedCount > 0 && aiGeneratedCount === 0) reasonCodes.push("ai_generation_failed");
    if (ruleFallbackCount > 0) reasonCodes.push("rule_fallback_used");

    if (result.length === 0) {
      badRequest("组卷失败：未生成到可用题目", {
        reasonCodes,
        suggestions: [
          "检查班级学科/年级是否正确",
          "清空知识点、难度、题型筛选后重试",
          "如需使用隔离池题目，请开启 includeIsolated",
          "检查 AI 模型链与密钥配置"
        ]
      });
    }

    return {
      data: {
        subject,
        grade,
        className,
        count: result.length,
        requestedCount: count,
        durationMinutes,
        questions: result,
        diagnostics: {
          reasonCodes,
          selectedStage: selectedStage?.key ?? "none",
          selectedStageLabel: selectedStage?.label ?? "无可用题池",
          stageTrail: stages.map((stage) => ({
            stage: stage.key,
            label: stage.label,
            totalPoolCount: stage.totalPool.length,
            activePoolCount: stage.activePool.length,
            isolatedExcludedCount: stage.isolatedExcludedCount
          })),
          generation: {
            bankSelectedCount: selected.length,
            aiAttemptedCount,
            aiGeneratedCount,
            ruleFallbackCount
          },
          suggestions: [
            "若题量不足，先取消知识点/难度/题型筛选",
            "优先使用 AI 模式补齐题量",
            "必要时开启 includeIsolated 并二次人工筛题"
          ]
        },
        qualityGovernance: {
          includeIsolated,
          isolatedExcludedCount: selectedStage?.isolatedExcludedCount ?? 0,
          isolatedPoolCount,
          activePoolCount: selectedStage?.activePool.length ?? 0,
          totalPoolCount: selectedStage?.totalPool.length ?? 0,
          shortfallCount,
          isolationFallbackUsed: Boolean(strictStage && selectedStage && selectedStage.key !== strictStage.key),
          qualityGovernanceDegraded
        }
      }
    };
  }
});
