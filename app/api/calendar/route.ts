import { getCurrentUser } from "@/lib/auth";
import { getClassesByStudent, getClassesByTeacher } from "@/lib/classes";
import { getAssignmentsByClassIds, getAssignmentProgressByStudent } from "@/lib/assignments";
import { getAnnouncementsByClassIds } from "@/lib/announcements";
import { getCorrectionTasksByUser } from "@/lib/corrections";
import { badRequest, unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

function inWindow(date: string) {
  const time = new Date(date).getTime();
  const now = Date.now();
  const start = now - 7 * 24 * 60 * 60 * 1000;
  const end = now + 30 * 24 * 60 * 60 * 1000;
  return time >= start && time <= end;
}

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const items: Array<{
      id: string;
      type: string;
      title: string;
      date: string;
      className?: string;
      status?: string;
      description?: string;
    }> = [];

    if (user.role === "teacher") {
      const classes = await getClassesByTeacher(user.id);
      const classMap = new Map(classes.map((item) => [item.id, item]));
      const assignments = await getAssignmentsByClassIds(classes.map((item) => item.id));
      assignments.forEach((assignment) => {
        if (!inWindow(assignment.dueDate)) return;
        items.push({
          id: assignment.id,
          type: "assignment",
          title: assignment.title,
          date: assignment.dueDate,
          className: classMap.get(assignment.classId)?.name ?? "-"
        });
      });
      const announcements = await getAnnouncementsByClassIds(classes.map((item) => item.id));
      announcements.forEach((announcement) => {
        if (!inWindow(announcement.createdAt)) return;
        items.push({
          id: announcement.id,
          type: "announcement",
          title: announcement.title,
          date: announcement.createdAt,
          className: classMap.get(announcement.classId)?.name ?? "-",
          description: announcement.content
        });
      });
    } else if (user.role === "student" || user.role === "parent") {
      const studentId = user.role === "parent" ? user.studentId : user.id;
      if (!studentId) {
        badRequest("missing student");
      }
      const classes = await getClassesByStudent(studentId);
      const classMap = new Map(classes.map((item) => [item.id, item]));
      const assignments = await getAssignmentsByClassIds(classes.map((item) => item.id));
      const progress = await getAssignmentProgressByStudent(studentId);
      const progressMap = new Map(progress.map((item) => [item.assignmentId, item]));
      assignments.forEach((assignment) => {
        if (!inWindow(assignment.dueDate)) return;
        const record = progressMap.get(assignment.id);
        items.push({
          id: assignment.id,
          type: "assignment",
          title: assignment.title,
          date: assignment.dueDate,
          className: classMap.get(assignment.classId)?.name ?? "-",
          status: record?.status ?? "pending"
        });
      });
      const announcements = await getAnnouncementsByClassIds(classes.map((item) => item.id));
      announcements.forEach((announcement) => {
        if (!inWindow(announcement.createdAt)) return;
        items.push({
          id: announcement.id,
          type: "announcement",
          title: announcement.title,
          date: announcement.createdAt,
          className: classMap.get(announcement.classId)?.name ?? "-",
          description: announcement.content
        });
      });

      const corrections = await getCorrectionTasksByUser(studentId);
      corrections.forEach((task) => {
        if (!inWindow(task.dueDate)) return;
        items.push({
          id: task.id,
          type: "correction",
          title: "错题订正",
          date: task.dueDate,
          status: task.status
        });
      });
    } else {
      unauthorized();
    }

    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { data: items };
  }
});
