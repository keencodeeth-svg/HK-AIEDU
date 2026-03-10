import { getAssignmentProgress, getAssignmentsByClassIds } from "@/lib/assignments";
import { getClassesByTeacher } from "@/lib/classes";
import type { Difficulty } from "@/lib/types";
import { getModulesByClass } from "@/lib/modules";
import { apiSuccess, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";
import { publishTeacherAssignment } from "@/lib/teacher-assignment-publishing";

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
    const result = await publishTeacherAssignment({
      teacherId: user.id,
      classId: body.classId,
      title: body.title,
      description: body.description,
      dueDate: body.dueDate,
      questionCount: body.questionCount,
      knowledgePointId: body.knowledgePointId,
      mode: body.mode,
      difficulty: body.difficulty,
      questionType: body.questionType,
      submissionType: body.submissionType,
      maxUploads: body.maxUploads,
      gradingFocus: body.gradingFocus,
      moduleId: body.moduleId
    });

    return apiSuccess(
      {
        data: result.assignment,
        fallback: result.fallbackMode,
        message: result.fallbackMode === "bank" ? "AI 未配置，已自动改为题库抽题" : undefined
      },
      { requestId: meta.requestId }
    );
  }
});
