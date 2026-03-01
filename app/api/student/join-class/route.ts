import { getCurrentUser } from "@/lib/auth";
import {
  addStudentToClass,
  createJoinRequest,
  getClassByJoinCode,
  getClassStudentIds,
  getJoinRequestsByStudent
} from "@/lib/classes";
import { createAssignmentProgress, getAssignmentsByClass } from "@/lib/assignments";
import { createNotification } from "@/lib/notifications";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const joinClassBodySchema = v.object<{ code?: string }>(
  {
    code: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const body = await parseJson(request, joinClassBodySchema);
    const code = body.code?.trim().toUpperCase();
    if (!code) {
      badRequest("missing code");
    }

    // Student join code lookup is tenant-scoped to prevent cross-school join by leaked codes.
    const klass = await getClassByJoinCode(code, user.schoolId ? { schoolId: user.schoolId } : undefined);
    if (!klass) {
      notFound("邀请码无效");
    }

    const memberIds = await getClassStudentIds(klass.id);
    if (memberIds.includes(user.id)) {
      return { status: "joined", message: "你已在班级中" };
    }

    // Auto-join executes immediately; approval mode enters teacher review queue.
    if (klass.joinMode === "auto") {
      const joined = await addStudentToClass(klass.id, user.id, { enforceSchoolMatch: true });
      if (!joined) {
        badRequest("班级与学生学校不匹配");
      }
      const assignments = await getAssignmentsByClass(klass.id);
      for (const assignment of assignments) {
        await createAssignmentProgress(assignment.id, user.id);
      }
      await createNotification({
        userId: user.id,
        title: "加入班级成功",
        content: `你已加入班级「${klass.name}」`,
        type: "class"
      });
      return { status: "joined", message: "已加入班级" };
    }

    const existing = await getJoinRequestsByStudent(user.id);
    const pending = existing.find((item) => item.classId === klass.id && item.status === "pending");
    if (pending) {
      return { status: "pending", message: "已提交加入申请" };
    }

    const requestRecord = await createJoinRequest(klass.id, user.id);
    await createNotification({
      userId: user.id,
      title: "已提交加入申请",
      content: `已向班级「${klass.name}」提交加入申请，请等待老师审核。`,
      type: "class"
    });
    if (klass.teacherId) {
      await createNotification({
        userId: klass.teacherId,
        title: "新的加入申请",
        content: `${user.name} 申请加入班级「${klass.name}」。`,
        type: "class"
      });
    }

    return { status: requestRecord.status, message: "已提交加入申请" };
  }
});
