import { getParentsByStudentId, getUserById } from "@/lib/auth";
import {
  addStudentToClass,
  decideJoinRequest,
  forceAddStudentToClass,
  getClassById,
  getClassStudentIds,
  getJoinRequestsByTeacher
} from "@/lib/classes";
import { createAssignmentProgress, getAssignmentsByClass } from "@/lib/assignments";
import { createNotification } from "@/lib/notifications";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const joinRequestParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const POST = createLearningRoute({
  role: "teacher",
  params: joinRequestParamsSchema,
  cache: "private-realtime",
  handler: async ({ params, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const requestId = params.id;
    const requests = await getJoinRequestsByTeacher(user.id);
    const record = requests.find((item) => item.id === requestId);
    if (!record) {
      notFound("not found");
    }

    const klass = await getClassById(record.classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound("not found");
    }
    const student = await getUserById(record.studentId);
    const studentSchoolId = student?.schoolId;
    if (klass.schoolId && studentSchoolId && klass.schoolId !== studentSchoolId) {
      badRequest("班级与学生学校不匹配");
    }

    await decideJoinRequest(record.id, "approved");
    let joined = await addStudentToClass(record.classId, record.studentId, { enforceSchoolMatch: true });
    if (!joined) {
      // Backward-compatible recovery path for legacy records:
      // 1) check existing membership, 2) retry without strict match, 3) force idempotent insert.
      const existingStudentIds = await getClassStudentIds(record.classId);
      const alreadyInClass = existingStudentIds.includes(record.studentId);
      if (!alreadyInClass) {
        joined = await addStudentToClass(record.classId, record.studentId, { enforceSchoolMatch: false });
      } else {
        joined = true;
      }
      if (!joined) {
        joined = await forceAddStudentToClass(record.classId, record.studentId);
      }
    }
    if (!joined) {
      badRequest("班级与学生学校不匹配");
    }

    const assignments = await getAssignmentsByClass(record.classId);
    for (const assignment of assignments) {
      await createAssignmentProgress(assignment.id, record.studentId);
    }

    await createNotification({
      userId: record.studentId,
      title: "加入班级成功",
      content: `老师已通过你的申请，欢迎加入班级「${klass.name}」。`,
      type: "class"
    });

    const parents = await getParentsByStudentId(record.studentId);
    for (const parent of parents) {
      await createNotification({
        userId: parent.id,
        title: "孩子加入班级",
        content: `孩子已加入班级「${klass.name}」。`,
        type: "class"
      });
    }

    return { ok: true };
  }
});
