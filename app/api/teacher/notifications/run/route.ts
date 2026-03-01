import { getCurrentUser, getParentsByStudentId } from "@/lib/auth";
import { getClassesByTeacher, getClassStudentIds } from "@/lib/classes";
import { getAssignmentsByClass, getAssignmentProgress } from "@/lib/assignments";
import { getRulesByClassIds } from "@/lib/notification-rules";
import { createNotification } from "@/lib/notifications";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const runNotificationBodySchema = v.object<{ classId?: string }>(
  {
    classId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const body = await parseJson(request, runNotificationBodySchema);
    const classes = await getClassesByTeacher(user.id);
    const targetClasses = body.classId ? classes.filter((item) => item.id === body.classId) : classes;
    if (!targetClasses.length) {
      notFound("class not found");
    }

    const rules = await getRulesByClassIds(targetClasses.map((item) => item.id));
    const ruleMap = new Map(rules.map((rule) => [rule.classId, rule]));
    const now = Date.now();
    let sentStudents = 0;
    let sentParents = 0;

    for (const klass of targetClasses) {
      const rule = ruleMap.get(klass.id) ?? {
        enabled: true,
        dueDays: 2,
        overdueDays: 0,
        includeParents: true
      };
      // When no custom rule exists, use conservative default reminder policy.
      if (!rule.enabled) continue;
      const assignments = await getAssignmentsByClass(klass.id);
      const studentIds = await getClassStudentIds(klass.id);

      for (const assignment of assignments) {
        const progress = await getAssignmentProgress(assignment.id);
        const progressMap = new Map(progress.map((item) => [item.studentId, item]));
        const dueAt = new Date(assignment.dueDate).getTime();
        const dueDiffDays = Math.ceil((dueAt - now) / (24 * 60 * 60 * 1000));
        const overdueDiffDays = Math.max(0, Math.ceil((now - dueAt) / (24 * 60 * 60 * 1000)));
        const isDueSoon = dueDiffDays >= 0 && dueDiffDays <= (rule.dueDays ?? 2);
        const isOverdue = dueAt < now;
        const withinOverdueWindow =
          rule.overdueDays && rule.overdueDays > 0 ? overdueDiffDays <= rule.overdueDays : true;
        if (!isDueSoon && !(isOverdue && withinOverdueWindow)) continue;

        for (const studentId of studentIds) {
          const status = progressMap.get(studentId)?.status ?? "pending";
          if (status === "completed") continue;

          const type = isOverdue ? "assignment_overdue" : "assignment_due";
          const title = isOverdue ? "作业已逾期" : "作业即将到期";
          const content = `${klass.name} · ${assignment.title}（截止 ${new Date(assignment.dueDate).toLocaleDateString(
            "zh-CN"
          )}）`;
          await createNotification({ userId: studentId, title, content, type });
          sentStudents += 1;

          if (rule.includeParents) {
            // Parent reminders are optional and controlled by class-level notification rule.
            const parents = await getParentsByStudentId(studentId);
            for (const parent of parents) {
              await createNotification({ userId: parent.id, title, content, type });
              sentParents += 1;
            }
          }
        }
      }
    }

    return { data: { students: sentStudents, parents: sentParents } };
  }
});
