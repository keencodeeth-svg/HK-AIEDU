import { getCurrentUser, getParentsByStudentId } from "@/lib/auth";
import { getClassById, getClassStudentIds, getClassesByStudent } from "@/lib/classes";
import { getStudentContext } from "@/lib/user-context";
import { createThread, getThreadsForUser } from "@/lib/inbox";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const createThreadBodySchema = v.object<{
  subject?: string;
  content?: string;
  recipientIds?: string[];
  classId?: string;
  includeParents?: boolean;
}>(
  {
    subject: v.optional(v.string({ allowEmpty: true, trim: false })),
    content: v.optional(v.string({ allowEmpty: true, trim: false })),
    recipientIds: v.optional(v.array(v.string({ minLength: 1 }))),
    classId: v.optional(v.string({ minLength: 1 })),
    includeParents: v.optional(v.boolean())
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  cache: "private-realtime",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }
    const data = await getThreadsForUser(user.id);
    return { data };
  }
});

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const body = await parseJson(request, createThreadBodySchema);
    const subject = body.subject?.trim();
    const content = body.content?.trim();
    if (!subject || !content) {
      badRequest("missing fields");
    }

    let recipientIds = (body.recipientIds ?? []).filter(Boolean);

    if (body.classId) {
      const klass = await getClassById(body.classId);
      if (!klass) {
        notFound("class not found");
      }

      if (user.role === "teacher") {
        if (klass.teacherId !== user.id) {
          notFound("class not found");
        }
        const studentIds = await getClassStudentIds(klass.id);
        recipientIds = studentIds;
        if (body.includeParents) {
          const parentIds: string[] = [];
          for (const studentId of studentIds) {
            const parents = await getParentsByStudentId(studentId);
            parents.forEach((parent) => parentIds.push(parent.id));
          }
          recipientIds = Array.from(new Set([...recipientIds, ...parentIds]));
        }
      } else {
        const student = user.role === "parent" ? await getStudentContext() : null;
        const classes =
          user.role === "student"
            ? await getClassesByStudent(user.id)
            : student
              ? await getClassesByStudent(student.id)
              : [];
        if (!classes.find((item) => item.id === klass.id)) {
          notFound("class not found");
        }
        if (!klass.teacherId) {
          badRequest("class has no teacher");
        }
        recipientIds = [klass.teacherId];
      }
    }

    if (!recipientIds.length) {
      badRequest("missing recipients");
    }

    const uniqueRecipients = Array.from(new Set(recipientIds.filter((id) => id !== user.id)));
    if (!uniqueRecipients.length) {
      badRequest("invalid recipients");
    }

    const result = await createThread({
      subject,
      senderId: user.id,
      recipientIds: uniqueRecipients,
      content
    });

    return { data: result };
  }
});
