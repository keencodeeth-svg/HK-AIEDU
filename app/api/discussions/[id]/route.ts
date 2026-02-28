import { getCurrentUser, getUsers } from "@/lib/auth";
import { getClassesByStudent, getClassesByTeacher } from "@/lib/classes";
import { getStudentContext } from "@/lib/user-context";
import { getDiscussionById, getDiscussionReplies } from "@/lib/discussions";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const discussionParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
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
  handler: async ({ params }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const parsed = parseParams(params, discussionParamsSchema);
    const topic = await getDiscussionById(parsed.id);
    if (!topic) {
      notFound("not found");
    }

    const accessible = await getAccessibleClassIds(user.role, user.id);
    if (!accessible.includes(topic.classId)) {
      notFound("not found");
    }

    const replies = await getDiscussionReplies(topic.id);
    const users = await getUsers();
    const userMap = new Map(users.map((item) => [item.id, item]));

    return {
      topic: {
        ...topic,
        authorName: topic.authorId ? userMap.get(topic.authorId)?.name ?? "老师" : "老师"
      },
      replies: replies.map((reply) => ({
        ...reply,
        authorName: reply.authorId ? userMap.get(reply.authorId)?.name ?? "成员" : "成员"
      }))
    };
  }
});
