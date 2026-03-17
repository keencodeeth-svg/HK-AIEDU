import { getParentsByStudentId } from "./auth";
import { generateQuestionDraft, hasConfiguredLlmProvider } from "./ai";
import { createAssignment, type Assignment } from "./assignments";
import { getClassById, getClassStudentIds } from "./classes";
import {
  createKnowledgePoint,
  createQuestion,
  getKnowledgePoints,
  getQuestions,
  normalizeQuestionType
} from "./content";
import { createNotification } from "./notifications";
import type { Difficulty, KnowledgePoint } from "./types";
import { getModuleById } from "./modules";
import { badRequest, notFound } from "./api/http";

export type PublishTeacherAssignmentInput = {
  teacherId: string;
  classId: string;
  title: string;
  description?: string;
  dueDate?: string;
  questionCount?: number;
  knowledgePointId?: string;
  mode?: "bank" | "ai";
  difficulty?: Difficulty;
  questionType?: string;
  submissionType?: Assignment["submissionType"];
  maxUploads?: number;
  gradingFocus?: string;
  moduleId?: string;
};

export type PublishTeacherAssignmentResult = {
  assignment: Assignment;
  fallbackMode: "bank" | null;
  classRecord: NonNullable<Awaited<ReturnType<typeof getClassById>>>;
};

export function normalizeAssignmentDueDate(input?: string) {
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

async function notifyAssignmentAudience(input: { assignment: Assignment; className: string }) {
  const studentIds = await getClassStudentIds(input.assignment.classId);
  for (const studentId of studentIds) {
    await createNotification({
      userId: studentId,
      title: "新的作业",
      content: `班级「${input.className}」发布作业：${input.assignment.title}`,
      type: "assignment"
    });
    const parents = await getParentsByStudentId(studentId);
    for (const parent of parents) {
      await createNotification({
        userId: parent.id,
        title: "孩子新作业",
        content: `孩子所在班级「${input.className}」发布作业：${input.assignment.title}`,
        type: "assignment"
      });
    }
  }
}

export async function publishTeacherAssignment(
  input: PublishTeacherAssignmentInput
): Promise<PublishTeacherAssignmentResult> {
  const submissionType =
    input.submissionType === "upload"
      ? "upload"
      : input.submissionType === "essay"
        ? "essay"
        : "quiz";
  const questionCount = Number(input.questionCount ?? 0);

  if (submissionType === "quiz" && questionCount <= 0) {
    badRequest("questionCount must be greater than 0 for quiz assignments");
  }

  const klass = await getClassById(input.classId);
  if (!klass || klass.teacherId !== input.teacherId) {
    notFound("class not found");
  }

  if (input.moduleId) {
    const moduleRecord = await getModuleById(input.moduleId);
    if (!moduleRecord || moduleRecord.classId !== klass.id) {
      notFound("module not found");
    }
  }

  const dueDate = normalizeAssignmentDueDate(input.dueDate);
  const mode = input.mode === "ai" ? "ai" : "bank";
  const questionType = input.questionType?.trim() ? normalizeQuestionType(input.questionType) : undefined;
  const difficulty = input.difficulty;

  let questionIds: string[] = [];
  let fallbackMode: "bank" | null = null;

  if (submissionType === "quiz" && mode === "ai" && !hasConfiguredLlmProvider("chat")) {
    fallbackMode = "bank";
  }

  if (submissionType === "quiz" && mode === "ai" && !fallbackMode) {
    const knowledgePoints = await getKnowledgePoints();
    const subjectPoints = knowledgePoints.filter(
      (item) => item.subject === klass.subject && item.grade === klass.grade
    );
    let kp: KnowledgePoint | undefined = input.knowledgePointId
      ? subjectPoints.find((item) => item.id === input.knowledgePointId)
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
    if (input.knowledgePointId) {
      pool = pool.filter((item) => item.knowledgePointId === input.knowledgePointId);
    }
    if (difficulty) {
      pool = pool.filter((item) => item.difficulty === difficulty);
    }
    if (questionType) {
      pool = pool.filter((item) => normalizeQuestionType(item.questionType) === questionType);
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
    moduleId: input.moduleId,
    title: input.title,
    description: input.description,
    dueDate,
    questionIds,
    submissionType,
    maxUploads: input.maxUploads,
    gradingFocus: input.gradingFocus
  });

  await notifyAssignmentAudience({ assignment, className: klass.name });

  return {
    assignment,
    fallbackMode,
    classRecord: klass
  };
}
