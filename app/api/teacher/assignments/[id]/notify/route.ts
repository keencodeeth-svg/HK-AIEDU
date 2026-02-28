import { getParentsByStudentId } from "@/lib/auth";
import { getAssignmentById, getAssignmentProgress } from "@/lib/assignments";
import { getClassById, getClassStudentIds } from "@/lib/classes";
import { createNotification } from "@/lib/notifications";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const notifyBodySchema = v.object<{
  target?: "missing" | "low_score" | "all";
  threshold?: number;
  message?: string;
}>(
  {
    target: v.optional(v.enum(["missing", "low_score", "all"] as const)),
    threshold: v.optional(v.number({ coerce: true, min: 0, max: 100 })),
    message: v.optional(v.string({ allowEmpty: true, trim: true }))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ request, params, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const assignment = await getAssignmentById(params.id);
    if (!assignment) {
      notFound();
    }

    const klass = await getClassById(assignment.classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound();
    }

    const body = await parseJson(request, notifyBodySchema);
    const target = body.target ?? "missing";
    const threshold = Number.isFinite(body.threshold) ? Number(body.threshold) : 60;
    const message = body.message?.trim();

    const studentIds = await getClassStudentIds(klass.id);
    const progress = await getAssignmentProgress(assignment.id);
    const progressMap = new Map(progress.map((item) => [item.studentId, item]));

    const recipients = studentIds.filter((studentId) => {
      const record = progressMap.get(studentId);
      if (target === "all") return true;
      if (target === "missing") {
        return !record || record.status !== "completed";
      }
      const score = record?.score ?? 0;
      const total = record?.total ?? 0;
      if (total <= 0) return false;
      return (score / total) * 100 < threshold;
    });

    let notifyCount = 0;
    let parentCount = 0;

    for (const studentId of recipients) {
      await createNotification({
        userId: studentId,
        title: "作业提醒",
        content:
          message ||
          (target === "missing"
            ? `请尽快完成作业「${assignment.title}」。`
            : `作业「${assignment.title}」需要加强，建议复盘错题。`),
        type: "assignment_reminder"
      });
      notifyCount += 1;

      const parents = await getParentsByStudentId(studentId);
      for (const parent of parents) {
        await createNotification({
          userId: parent.id,
          title: "孩子作业提醒",
          content:
            message ||
            (target === "missing"
              ? `孩子的作业「${assignment.title}」尚未完成，请协助督学。`
              : `孩子的作业「${assignment.title}」需要加强，请关注复盘。`),
          type: "assignment_reminder"
        });
        parentCount += 1;
      }
    }

    return { data: { students: notifyCount, parents: parentCount } };
  }
});
