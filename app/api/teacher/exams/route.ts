import { getClassById, getClassStudentIds, getClassesByTeacher } from "@/lib/classes";
import { getQuestions } from "@/lib/content";
import { listQuestionQualityMetrics } from "@/lib/question-quality";
import {
  createAndPublishExam,
  ensureExamAssignmentsForPaper,
  getExamPapersByClassIds
} from "@/lib/exams";
import { createNotification } from "@/lib/notifications";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import type { Difficulty } from "@/lib/types";
import { createExamRoute } from "@/lib/api/domains";

const createExamBodySchema = v.object<{
  classId: string;
  title: string;
  description?: string;
  startAt?: string;
  endAt?: string;
  durationMinutes?: number;
  questionCount?: number;
  questionIds?: string[];
  studentIds?: string[];
  knowledgePointId?: string;
  difficulty?: Difficulty;
  questionType?: string;
  publishMode?: "teacher_assigned" | "targeted";
  antiCheatLevel?: "off" | "basic";
  includeIsolated?: boolean;
}>(
  {
    classId: v.string({ minLength: 1 }),
    title: v.string({ minLength: 1 }),
    description: v.optional(v.string({ allowEmpty: true, trim: false })),
    startAt: v.optional(v.string({ minLength: 1 })),
    endAt: v.optional(v.string({ minLength: 1 })),
    durationMinutes: v.optional(v.number({ coerce: true, integer: true, min: 5, max: 300 })),
    questionCount: v.optional(v.number({ coerce: true, integer: true, min: 1, max: 100 })),
    questionIds: v.optional(v.array(v.string({ minLength: 1 }), { minLength: 1, maxLength: 100 })),
    studentIds: v.optional(v.array(v.string({ minLength: 1 }), { minLength: 1, maxLength: 300 })),
    knowledgePointId: v.optional(v.string({ minLength: 1 })),
    difficulty: v.optional(v.enum(["easy", "medium", "hard"] as const)),
    questionType: v.optional(v.string({ minLength: 1 })),
    publishMode: v.optional(v.enum(["teacher_assigned", "targeted"] as const)),
    antiCheatLevel: v.optional(v.enum(["off", "basic"] as const)),
    includeIsolated: v.optional(v.boolean())
  },
  { allowUnknown: false }
);

function parseDateTime(input: string | undefined, fallback: Date): string {
  if (!input) {
    return fallback.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split("-").map((value) => Number(value));
    return new Date(year, month - 1, day, 23, 59, 0).toISOString();
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    badRequest("invalid datetime format");
  }
  return parsed.toISOString();
}

function sampleQuestions<T>(items: T[], count: number) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export const GET = createExamRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ user }) => {
  if (!user || user.role !== "teacher") {
    unauthorized();
  }

  const classes = await getClassesByTeacher(user.id);
  const classIds = classes.map((item) => item.id);
  const classMap = new Map(classes.map((item) => [item.id, item]));
  const papers = await getExamPapersByClassIds(classIds);

  const data = await Promise.all(
    papers.map(async (paper) => {
      // Ensure assignment rows are backfilled before computing teacher dashboard metrics.
      const assignments = await ensureExamAssignmentsForPaper(paper.id);
      const submitted = assignments.filter((item) => item.status === "submitted").length;
      const scored = assignments.filter(
        (item) => typeof item.score === "number" && typeof item.total === "number" && (item.total ?? 0) > 0
      );
      const avgScore = scored.length
        ? Math.round(
            scored.reduce((sum, item) => sum + ((item.score ?? 0) / (item.total ?? 1)) * 100, 0) / scored.length
          )
        : 0;
      const klass = classMap.get(paper.classId);
      return {
        ...paper,
        className: klass?.name ?? "-",
        classSubject: klass?.subject ?? "-",
        classGrade: klass?.grade ?? "-",
        assignedCount: assignments.length,
        submittedCount: submitted,
        avgScore
      };
    })
  );

    return { data };
  }
});

export const POST = createExamRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ request, user }) => {
  if (!user || user.role !== "teacher") {
    unauthorized();
  }

  const body = await parseJson(request, createExamBodySchema);
  const klass = await getClassById(body.classId);
  if (!klass || klass.teacherId !== user.id) {
    notFound("class not found");
  }

  const startAt = body.startAt ? parseDateTime(body.startAt, new Date()) : undefined;
  const endAt = parseDateTime(body.endAt, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  if (startAt && new Date(startAt).getTime() >= new Date(endAt).getTime()) {
    badRequest("endAt must be after startAt");
  }

  const allQuestions = await getQuestions();
  const questionMap = new Map(allQuestions.map((item) => [item.id, item]));
  const includeIsolated = body.includeIsolated === true;
  const classScopedIds = allQuestions
    .filter((item) => item.subject === klass.subject && item.grade === klass.grade)
    .map((item) => item.id);
  const classScopedQuality = await listQuestionQualityMetrics({ questionIds: classScopedIds });
  const isolatedSet = new Set(classScopedQuality.filter((item) => item.isolated).map((item) => item.questionId));
  const isolatedPoolCount = classScopedIds.filter((item) => isolatedSet.has(item)).length;
  let isolatedExcludedCount = 0;
  let isolationFallbackUsed = false;

  let questionIds = Array.from(new Set(body.questionIds ?? []));
  if (questionIds.length > 0) {
    const invalidIds = questionIds.filter((id) => !questionMap.has(id));
    if (invalidIds.length) {
      badRequest("questionIds contains invalid item");
    }
    const outOfClass = questionIds.filter((id) => {
      const question = questionMap.get(id);
      return !question || question.subject !== klass.subject || question.grade !== klass.grade;
    });
    if (outOfClass.length) {
      badRequest("questionIds must match class subject and grade");
    }
    if (!includeIsolated) {
      const isolatedSelected = questionIds.filter((id) => isolatedSet.has(id));
      isolatedExcludedCount = isolatedSelected.length;
      if (isolatedSelected.length) {
        // Explicit questionIds must respect isolation policy unless teacher opts in.
        badRequest(`题目包含隔离池高风险题（${isolatedSelected.length} 题），请先移除或显式开启 includeIsolated`);
      }
    }
  } else {
    const count = Number(body.questionCount ?? 0);
    if (count <= 0) {
      badRequest("questionCount must be greater than 0");
    }
    let pool = allQuestions.filter((item) => item.subject === klass.subject && item.grade === klass.grade);
    if (body.knowledgePointId) {
      pool = pool.filter((item) => item.knowledgePointId === body.knowledgePointId);
    }
    if (body.difficulty) {
      pool = pool.filter((item) => item.difficulty === body.difficulty);
    }
    if (body.questionType) {
      pool = pool.filter((item) => (item.questionType ?? "choice") === body.questionType);
    }
    const activePool = includeIsolated ? pool : pool.filter((item) => !isolatedSet.has(item.id));
    isolatedExcludedCount = includeIsolated ? 0 : pool.length - activePool.length;
    const selectedPool =
      !includeIsolated && activePool.length < count && pool.length >= count ? pool : activePool;
    // Shortage fallback avoids hard failure when non-isolated pool is temporarily too small.
    isolationFallbackUsed = !includeIsolated && selectedPool === pool && activePool.length < count;
    if (selectedPool.length < count) {
      badRequest("题库数量不足，无法生成考试");
    }
    questionIds = sampleQuestions(selectedPool, count).map((item) => item.id);
  }

  const classStudentIds = await getClassStudentIds(klass.id);
  const publishMode = body.publishMode ?? "teacher_assigned";
  const targetStudentIds = Array.from(new Set(body.studentIds ?? []));
  if (publishMode === "targeted") {
    // Targeted mode must stay within current class roster for tenant/class isolation.
    if (!targetStudentIds.length) {
      badRequest("studentIds required when publishMode is targeted");
    }
    const invalidStudentId = targetStudentIds.find((studentId) => !classStudentIds.includes(studentId));
    if (invalidStudentId) {
      badRequest("studentIds must belong to class");
    }
  }

  const exam = await createAndPublishExam({
    classId: klass.id,
    title: body.title,
    description: body.description,
    publishMode,
    antiCheatLevel: body.antiCheatLevel,
    assignedStudentIds: publishMode === "targeted" ? targetStudentIds : classStudentIds,
    startAt,
    endAt,
    durationMinutes: body.durationMinutes,
    createdBy: user.id,
    questionIds
  });

  const notifyStudentIds = publishMode === "targeted" ? targetStudentIds : classStudentIds;
  for (const studentId of notifyStudentIds) {
    await createNotification({
      userId: studentId,
      title: "新考试发布",
      content: `老师发布了考试《${exam.title}》，请按时完成。`,
      type: "assignment"
    });
  }

    return {
      message: "考试发布成功",
      data: {
        ...exam,
        assignedCount: notifyStudentIds.length,
        qualityGovernance: {
          includeIsolated,
          isolatedPoolCount,
          isolatedExcludedCount: isolationFallbackUsed ? 0 : isolatedExcludedCount,
          isolationFallbackUsed
        }
      }
    };
  }
});
