import { getCurrentUser, getUserByEmail } from "@/lib/auth";
import { addStudentToClass, getClassById, getClassStudents } from "@/lib/classes";
import { createAssignmentProgress, getAssignmentsByClass } from "@/lib/assignments";
import { createNotification } from "@/lib/notifications";
import { notFound, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const addStudentBodySchema = v.object<{ email: string }>(
  {
    email: v.string({ minLength: 1 })
  },
  { allowUnknown: false }
);

const classParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const GET = createLearningRoute({
  role: "teacher",
  params: classParamsSchema,
  cache: "private-short",
  handler: async ({ params, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const classId = params.id;
    const klass = await getClassById(classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound("not found");
    }

    const students = await getClassStudents(classId);
    return { data: students };
  }
});

export const POST = createLearningRoute({
  role: "teacher",
  params: classParamsSchema,
  body: addStudentBodySchema,
  cache: "private-realtime",
  handler: async ({ params, body, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const classId = params.id;
    const klass = await getClassById(classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound("not found");
    }

    const student = await getUserByEmail(body.email);
    if (!student || student.role !== "student") {
      notFound("student not found");
    }

    const added = await addStudentToClass(classId, student.id);
    if (added) {
      const assignments = await getAssignmentsByClass(classId);
      for (const assignment of assignments) {
        await createAssignmentProgress(assignment.id, student.id);
      }
      await createNotification({
        userId: student.id,
        title: "加入班级",
        content: `你已加入班级「${klass.name}」`,
        type: "class"
      });
    }

    return { added };
  }
});
