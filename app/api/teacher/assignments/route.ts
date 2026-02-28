import { getParentsByStudentId } from "@/lib/auth";
import { createAssignment, getAssignmentProgress, getAssignmentsByClassIds } from "@/lib/assignments";
import { getClassById, getClassesByTeacher, getClassStudentIds } from "@/lib/classes";
import { createKnowledgePoint, createQuestion, getKnowledgePoints, getQuestions } from "@/lib/content";
import type { Difficulty, KnowledgePoint } from "@/lib/types";
import { createNotification } from "@/lib/notifications";
import { generateQuestionDraft, hasConfiguredLlmProvider } from "@/lib/ai";
import { getModuleById, getModulesByClass } from "@/lib/modules";
import { apiSuccess, badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const createAssignmentBodySchema = v.object<{
  classId: string;
  title: string;
  description?: string;
  dueDate?: string;
  questionCount?: number;
  knowledgePointId?: string;
  mode?: "bank" | "ai";
  difficulty?: Difficulty;
  questionType?: string;
  submissionType?: "quiz" | "upload" | "essay";
  maxUploads?: number;
  gradingFocus?: string;
  moduleId?: string;
}>(
  {
    classId: v.string({ minLength: 1 }),
    title: v.string({ minLength: 1 }),
    description: v.optional(v.string({ allowEmpty: true, trim: false })),
    dueDate: v.optional(v.string({ minLength: 1 })),
    questionCount: v.optional(v.number({ coerce: true, integer: true, min: 0 })),
    knowledgePointId: v.optional(v.string({ minLength: 1 })),
    mode: v.optional(v.enum(["bank", "ai"] as const)),
    difficulty: v.optional(v.enum(["easy", "medium", "hard"] as const)),
    questionType: v.optional(v.string({ minLength: 1 })),
    submissionType: v.optional(v.enum(["quiz", "upload", "essay"] as const)),
    maxUploads: v.optional(v.number({ coerce: true, integer: true, min: 1, max: 20 })),
    gradingFocus: v.optional(v.string({ allowEmpty: true, trim: false })),
    moduleId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

function normalizeDueDate(input?: string) {
  if (!input) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split("-").map((value) => Number(value));
    return new Date(year, month - 1, day, 23, 59, 0).toISOString();
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
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

function normalizeStem(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？,.!?;:；：、]/g, "");
}

export const GET = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const classes = await getClassesByTeacher(user.id);
    const classIds = classes.map((item) => item.id);
    const classMap = new Map(classes.map((item) => [item.id, item]));
    const moduleLists = await Promise.all(classes.map((klass) => getModulesByClass(klass.id)));
    const moduleMap = new Map(moduleLists.flat().map((item) => [item.id, item]));
    const assignments = await getAssignmentsByClassIds(classIds);

    const data = await Promise.all(
      assignments.map(async (assignment) => {
        const progress = await getAssignmentProgress(assignment.id);
        const completed = progress.filter((item) => item.status === "completed").length;
        const klass = classMap.get(assignment.classId);
        const moduleTitle = assignment.moduleId ? moduleMap.get(assignment.moduleId)?.title ?? "" : "";
        return {
          ...assignment,
          className: klass?.name ?? "-",
          classSubject: klass?.subject ?? "-",
          classGrade: klass?.grade ?? "-",
          moduleTitle,
          total: progress.length,
          completed
        };
      })
    );

    return { data };
  }
});

export const POST = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ request, user, meta }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const body = await parseJson(request, createAssignmentBodySchema);

    const submissionType =
      body.submissionType === "upload" ? "upload" : body.submissionType === "essay" ? "essay" : "quiz";
    const questionCount = Number(body.questionCount ?? 0);

    if (submissionType === "quiz" && questionCount <= 0) {
      badRequest("questionCount must be greater than 0 for quiz assignments");
    }

    const klass = await getClassById(body.classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound("class not found");
    }

    if (body.moduleId) {
      const moduleRecord = await getModuleById(body.moduleId);
      if (!moduleRecord || moduleRecord.classId !== klass.id) {
        notFound("module not found");
      }
    }

    const dueDate = normalizeDueDate(body.dueDate);
    const mode = body.mode === "ai" ? "ai" : "bank";
    const questionType = body.questionType?.trim();
    const difficulty = body.difficulty;

    let questionIds: string[] = [];
    let fallbackMode: "bank" | null = null;

    if (submissionType === "quiz" && mode === "ai") {
      if (!hasConfiguredLlmProvider("chat")) {
        fallbackMode = "bank";
      }
    }

    if (submissionType === "quiz" && mode === "ai" && !fallbackMode) {
      const knowledgePoints = await getKnowledgePoints();
      const subjectPoints = knowledgePoints.filter(
        (item) => item.subject === klass.subject && item.grade === klass.grade
      );
      let kp: KnowledgePoint | undefined = body.knowledgePointId
        ? subjectPoints.find((item) => item.id === body.knowledgePointId)
        : subjectPoints[0];
      if (!kp) {
        kp =
          (await createKnowledgePoint({
            subject: klass.subject,
            grade: klass.grade,
            title: "综合练习",
            chapter: "综合"
          })) ?? undefined;
      }
      if (!kp) {
        badRequest("暂无可用知识点，请先生成知识点");
      }

      const existing = (await getQuestions()).filter(
        (q) => q.subject === klass.subject && q.grade === klass.grade && q.knowledgePointId === kp.id
      );
      const existingStems = new Set(existing.map((q) => normalizeStem(q.stem)));
      const createdStems = new Set<string>();

      for (let i = 0; i < questionCount; i += 1) {
        let draft = null;
        let attempts = 0;
        while (!draft && attempts < 3) {
          attempts += 1;
          const next = await generateQuestionDraft({
            subject: klass.subject,
            grade: klass.grade,
            knowledgePointTitle: kp.title,
            chapter: kp.chapter,
            difficulty,
            questionType
          });
          if (!next) continue;
          const key = normalizeStem(next.stem);
          if (existingStems.has(key) || createdStems.has(key)) {
            continue;
          }
          draft = next;
          createdStems.add(key);
        }

        if (!draft) {
          badRequest(`AI 生成失败（第 ${i + 1} 题）`);
        }

        const saved = await createQuestion({
          subject: klass.subject,
          grade: klass.grade,
          knowledgePointId: kp.id,
          stem: draft.stem,
          options: draft.options,
          answer: draft.answer,
          explanation: draft.explanation,
          difficulty: difficulty ?? "medium",
          questionType: questionType || "choice",
          tags: [],
          abilities: []
        });

        if (!saved) {
          badRequest("题目保存失败");
        }
        questionIds.push(saved.id);
      }
    } else if (submissionType === "quiz") {
      const questions = await getQuestions();
      let pool = questions.filter((item) => item.subject === klass.subject && item.grade === klass.grade);
      if (body.knowledgePointId) {
        pool = pool.filter((item) => item.knowledgePointId === body.knowledgePointId);
      }
      if (difficulty) {
        pool = pool.filter((item) => item.difficulty === difficulty);
      }
      if (questionType) {
        pool = pool.filter((item) => (item.questionType ?? "choice") === questionType);
      }

      if (pool.length < questionCount) {
        const hint =
          fallbackMode === "bank"
            ? "AI 未配置且题库数量不足，请先导入题库或配置模型"
            : "题库数量不足";
        badRequest(hint);
      }

      const selected = sampleQuestions(pool, questionCount);
      questionIds = selected.map((item) => item.id);
    }

    const assignment = await createAssignment({
      classId: klass.id,
      moduleId: body.moduleId,
      title: body.title,
      description: body.description,
      dueDate,
      questionIds,
      submissionType,
      maxUploads: body.maxUploads,
      gradingFocus: body.gradingFocus
    });

    const studentIds = await getClassStudentIds(klass.id);
    for (const studentId of studentIds) {
      await createNotification({
        userId: studentId,
        title: "新的作业",
        content: `班级「${klass.name}」发布作业：${assignment.title}`,
        type: "assignment"
      });
      const parents = await getParentsByStudentId(studentId);
      for (const parent of parents) {
        await createNotification({
          userId: parent.id,
          title: "孩子新作业",
          content: `孩子所在班级「${klass.name}」发布作业：${assignment.title}`,
          type: "assignment"
        });
      }
    }

    return apiSuccess(
      {
        data: assignment,
        fallback: fallbackMode,
        message: fallbackMode === "bank" ? "AI 未配置，已自动改为题库抽题" : undefined
      },
      { requestId: meta.requestId }
    );
  }
});
