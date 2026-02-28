import { getCurrentUser } from "@/lib/auth";
import { getClassesByStudent, getClassesByTeacher } from "@/lib/classes";
import { getStudentContext } from "@/lib/user-context";
import { addDiscussionReply, getDiscussionById } from "@/lib/discussions";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, parseParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const replyParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

const replyBodySchema = v.object<{ content?: string; parentId?: string }>(
  {
    content: v.optional(v.string({ allowEmpty: true, trim: false })),
    parentId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

async function getAccessibleClassIds(role: string, userId: string) {
  if (role === "teacher") {
    const classes = await getClassesByTeacher(userId);
    return classes.map((item) => item.id);
  }
  if (role === "student") {
    const classes = await getClassesByStudent(userId);
    return classes.map((item) => item.id);
  }
  if (role === "parent") {
    const student = await getStudentContext();
    if (!student) return [];
    const classes = await getClassesByStudent(student.id);
    return classes.map((item) => item.id);
  }
  return [];
}

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request, params }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const parsed = parseParams(params, replyParamsSchema);
    const topic = await getDiscussionById(parsed.id);
    if (!topic) {
      notFound("not found");
    }

    const accessible = await getAccessibleClassIds(user.role, user.id);
    if (!accessible.includes(topic.classId)) {
      notFound("not found");
    }

    const body = await parseJson(request, replyBodySchema);
    const content = body.content?.trim();
    if (!content) {
      badRequest("missing content");
    }

    const reply = await addDiscussionReply({
      discussionId: topic.id,
      authorId: user.id,
      content,
      parentId: body.parentId
    });

    return { data: reply };
  }
});
