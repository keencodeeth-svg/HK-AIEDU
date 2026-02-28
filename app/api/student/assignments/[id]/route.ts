import { getClassesByStudent } from "@/lib/classes";
import { getAssignmentById, getAssignmentItems, getAssignmentProgressForStudent } from "@/lib/assignments";
import { getQuestions } from "@/lib/content";
import { getModuleById } from "@/lib/modules";
import { notFound, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const assignmentParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const GET = createLearningRoute({
  role: "student",
  params: assignmentParamsSchema,
  cache: "private-short",
  handler: async ({ params, user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const assignmentId = params.id;
    const assignment = await getAssignmentById(assignmentId);
    if (!assignment) {
      notFound("not found");
    }

    const classes = await getClassesByStudent(user.id);
    const classMap = new Map(classes.map((item) => [item.id, item]));
    const klass = classMap.get(assignment.classId);
    if (!klass) {
      notFound("not found");
    }

    const items = await getAssignmentItems(assignment.id);
    const questions = await getQuestions();
    const questionMap = new Map(questions.map((item) => [item.id, item]));
    const payloadQuestions = items
      .map((item) => questionMap.get(item.questionId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({
        id: item.id,
        stem: item.stem,
        options: item.options
      }));

    const progress = await getAssignmentProgressForStudent(assignment.id, user.id);

    return {
      assignment,
      module: assignment.moduleId ? await getModuleById(assignment.moduleId) : null,
      class: { id: klass.id, name: klass.name, subject: klass.subject, grade: klass.grade },
      questions: payloadQuestions,
      progress
    };
  }
});
