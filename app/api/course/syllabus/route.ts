import { getCurrentUser } from "@/lib/auth";
import { getClassById, getClassesByStudent } from "@/lib/classes";
import { getStudentContext } from "@/lib/user-context";
import { getSyllabusByClass, upsertSyllabus } from "@/lib/syllabus";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, parseSearchParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const syllabusQuerySchema = v.object<{ classId: string }>(
  {
    classId: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

const upsertSyllabusBodySchema = v.object<{
  classId?: string;
  summary?: string;
  objectives?: string;
  gradingPolicy?: string;
  scheduleText?: string;
}>(
  {
    classId: v.optional(v.string({ allowEmpty: true, trim: false })),
    summary: v.optional(v.string({ allowEmpty: true, trim: false })),
    objectives: v.optional(v.string({ allowEmpty: true, trim: false })),
    gradingPolicy: v.optional(v.string({ allowEmpty: true, trim: false })),
    scheduleText: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

async function canAccessClass(userId: string, role: string, classId: string) {
  const klass = await getClassById(classId);
  if (!klass) return null;
  if (role === "teacher") {
    return klass.teacherId === userId ? klass : null;
  }
  if (role === "student") {
    const classes = await getClassesByStudent(userId);
    return classes.find((item) => item.id === classId) ?? null;
  }
  if (role === "parent") {
    const student = await getStudentContext();
    if (!student) return null;
    const classes = await getClassesByStudent(student.id);
    return classes.find((item) => item.id === classId) ?? null;
  }
  return null;
}

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const query = parseSearchParams(request, syllabusQuerySchema);
    const classId = query.classId;
    const klass = await canAccessClass(user.id, user.role, classId);
    if (!klass) {
      notFound("not found");
    }

    const syllabus = await getSyllabusByClass(classId);
    return { data: syllabus, class: klass };
  }
});

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const body = await parseJson(request, upsertSyllabusBodySchema);
    const classId = body.classId?.trim();
    if (!classId) {
      badRequest("missing classId");
    }

    const klass = await canAccessClass(user.id, user.role, classId);
    if (!klass) {
      notFound("class not found");
    }

    const syllabus = await upsertSyllabus({
      classId,
      summary: body.summary ?? "",
      objectives: body.objectives ?? "",
      gradingPolicy: body.gradingPolicy ?? "",
      scheduleText: body.scheduleText ?? ""
    });
    return { data: syllabus };
  }
});
