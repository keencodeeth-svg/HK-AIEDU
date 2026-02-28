import { getCurrentUser, getUsers } from "@/lib/auth";
import { getClassesByStudent, getClassesByTeacher } from "@/lib/classes";
import { getStudentContext } from "@/lib/user-context";
import { createDiscussionTopic, getDiscussionTopicsByClassIds } from "@/lib/discussions";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, parseSearchParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const discussionsQuerySchema = v.object<{ classId?: string }>(
  {
    classId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

const createTopicBodySchema = v.object<{
  classId?: string;
  title?: string;
  content?: string;
  pinned?: boolean;
}>(
  {
    classId: v.optional(v.string({ allowEmpty: true, trim: false })),
    title: v.optional(v.string({ allowEmpty: true, trim: false })),
    content: v.optional(v.string({ allowEmpty: true, trim: false })),
    pinned: v.optional(v.boolean())
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

export const GET = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const query = parseSearchParams(request, discussionsQuerySchema);
    const classId = query.classId;
    const accessible = await getAccessibleClassIds(user.role, user.id);
    if (!accessible.length) {
      return { data: [] };
    }

    const classIds = classId && accessible.includes(classId) ? [classId] : accessible;
    const topics = await getDiscussionTopicsByClassIds(classIds);
    const users = await getUsers();
    const userMap = new Map(users.map((item) => [item.id, item]));
    const data = topics.map((topic) => ({
      ...topic,
      authorName: topic.authorId ? userMap.get(topic.authorId)?.name ?? "老师" : "老师"
    }));
    return { data };
  }
});

export const POST = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const body = await parseJson(request, createTopicBodySchema);
    const classId = body.classId?.trim();
    const title = body.title?.trim();
    const content = body.content?.trim();

    if (!classId || !title || !content) {
      badRequest("missing fields");
    }

    const accessible = await getAccessibleClassIds(user.role, user.id);
    if (!accessible.includes(classId)) {
      notFound("class not found");
    }

    const topic = await createDiscussionTopic({
      classId,
      authorId: user.id,
      title,
      content,
      pinned: body.pinned
    });

    return { data: topic };
  }
});
