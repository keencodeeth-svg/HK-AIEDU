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

    const questions = (await getQuestions()).filter((q) => {
      if (q.subject !== subject || q.grade !== grade) return false;
      if (knowledgePointIds.length && !knowledgePointIds.includes(q.knowledgePointId)) return false;
      if (difficulty && q.difficulty !== difficulty) return false;
      if (questionType && q.questionType !== questionType) return false;
      return true;
    });

    const includeIsolated = body.includeIsolated === true;
    let qualityMetrics = [] as Awaited<ReturnType<typeof listQuestionQualityMetrics>>;
    let qualityGovernanceDegraded = false;
    try {
      qualityMetrics = await listQuestionQualityMetrics({
        questionIds: questions.map((item) => item.id)
      });
    } catch {
      qualityGovernanceDegraded = true;
      qualityMetrics = [];
    }
    const isolatedSet = new Set(qualityMetrics.filter((item) => item.isolated).map((item) => item.questionId));
    const isolatedPoolCount = questions.filter((item) => isolatedSet.has(item.id)).length;
    const activePool = includeIsolated ? questions : questions.filter((item) => !isolatedSet.has(item.id));
    const isolatedExcludedCount = includeIsolated ? 0 : questions.length - activePool.length;
    const selectedPool =
      !includeIsolated && activePool.length < count && questions.length >= count ? questions : activePool;
    const isolationFallbackUsed = !includeIsolated && selectedPool === questions && activePool.length < count;
    const selected = shuffle(selectedPool).slice(0, count);
    let generated: GeneratedQuestion[] = selected.map((item) => ({ ...item, source: "bank" as const }));
    let aiAttemptedCount = 0;
    let aiGeneratedCount = 0;
    const knowledgePoints = await getKnowledgePoints();
    const kpPool = knowledgePointIds.length
      ? knowledgePoints.filter((kp) => knowledgePointIds.includes(kp.id))
      : knowledgePoints.filter((kp) => kp.subject === subject && kp.grade === grade);

    if (mode === "ai" && generated.length < count) {
      const missing = count - generated.length;

      for (let i = 0; i < missing; i += 1) {
        aiAttemptedCount += 1;
        const kp = kpPool[i % Math.max(1, kpPool.length)];
        if (!kp) break;
        const draft = await generateQuestionDraft({
          subject,
          grade,
          knowledgePointTitle: kp.title,
          chapter: kp.chapter,
          difficulty: difficulty ?? "medium",
          questionType: questionType ?? "choice"
        });
        if (!draft) continue;
        generated.push({
          id: `ai-${crypto.randomBytes(6).toString("hex")}`,
          stem: draft.stem,
          options: draft.options,
          answer: draft.answer,
          explanation: draft.explanation,
          knowledgePointId: kp.id,
          source: "ai"
        });
        aiGeneratedCount += 1;
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
    const aiConfigured = hasConfiguredLlmProvider("chat");

    if (result.length === 0) {
      const reasons: string[] = [];
      if (questions.length === 0) {
        reasons.push("题库中没有匹配学科/年级/筛选条件的题目");
      }
      if (!includeIsolated && activePool.length === 0 && questions.length > 0) {
        reasons.push("匹配题目均在隔离池（可尝试开启“允许使用隔离池高风险题”）");
      }
      if (mode === "ai" && kpPool.length === 0) {
        reasons.push("当前班级无可用知识点，AI 无法按知识点生成题目");
      }
      if (mode === "ai" && !aiConfigured) {
        reasons.push("AI 模型链未配置或密钥缺失");
      }
      if (mode === "ai" && aiAttemptedCount > 0 && aiGeneratedCount === 0) {
        reasons.push("AI 调用未返回可用题目");
      }
      badRequest(reasons.length ? `组卷失败：${reasons.join("；")}` : "组卷失败：未生成到可用题目");
    }

    return {
      data: {
        subject,
        grade,
        className,
        count: result.length,
        durationMinutes,
        questions: result,
        qualityGovernance: {
          includeIsolated,
          isolatedExcludedCount: isolationFallbackUsed ? 0 : isolatedExcludedCount,
          isolatedPoolCount,
          activePoolCount: activePool.length,
          shortfallCount,
          isolationFallbackUsed,
          qualityGovernanceDegraded
        }
      }
    };
  }
});
