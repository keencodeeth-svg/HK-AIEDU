import { getCurrentUser, getParentsByStudentId } from "@/lib/auth";
import { getClassesByStudent, getClassesByTeacher, getClassById, getClassStudentIds } from "@/lib/classes";
import { createAnnouncement, getAnnouncementsByClassIds } from "@/lib/announcements";
import { createNotification } from "@/lib/notifications";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const createAnnouncementBodySchema = v.object<{ classId?: string; title?: string; content?: string }>(
  {
    classId: v.optional(v.string({ allowEmpty: true, trim: false })),
    title: v.optional(v.string({ allowEmpty: true, trim: false })),
    content: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    let classes: Array<{ id: string; name: string; subject: string; grade: string }> = [];
    if (user.role === "teacher") {
      classes = await getClassesByTeacher(user.id);
    } else if (user.role === "student") {
      classes = await getClassesByStudent(user.id);
    } else if (user.role === "parent") {
      if (!user.studentId) {
        badRequest("missing student");
      }
      classes = await getClassesByStudent(user.studentId);
    } else {
      unauthorized();
    }

    const classMap = new Map(classes.map((item) => [item.id, item]));
    const announcements = await getAnnouncementsByClassIds(classes.map((item) => item.id));
    const data = announcements.map((item) => ({
      ...item,
      className: classMap.get(item.classId)?.name ?? "-",
      classSubject: classMap.get(item.classId)?.subject ?? "-",
      classGrade: classMap.get(item.classId)?.grade ?? "-"
    }));

    return { data };
  }
});

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const body = await parseJson(request, createAnnouncementBodySchema);
    const classId = body.classId?.trim();
    const title = body.title?.trim();
    const content = body.content?.trim();
    if (!classId || !title || !content) {
      badRequest("missing fields");
    }

    const klass = await getClassById(classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound("class not found");
    }

    const created = await createAnnouncement({
      classId: klass.id,
      authorId: user.id,
      title,
      content
    });

    const studentIds = await getClassStudentIds(klass.id);
    for (const studentId of studentIds) {
      await createNotification({
        userId: studentId,
        title: "班级公告",
        content: `班级「${klass.name}」发布公告：${created.title}`,
        type: "announcement"
      });
      const parents = await getParentsByStudentId(studentId);
      for (const parent of parents) {
        await createNotification({
          userId: parent.id,
          title: "孩子班级公告",
          content: `孩子所在班级「${klass.name}」发布公告：${created.title}`,
          type: "announcement"
        });
      }
    }

    return { data: created };
  }
});
