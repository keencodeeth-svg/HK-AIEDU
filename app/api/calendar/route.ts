import { getCurrentUser } from "@/lib/auth";
import { getClassesByStudent, getClassesByTeacher } from "@/lib/classes";
import { getAssignmentsByClassIds, getAssignmentProgressByStudent } from "@/lib/assignments";
import { getAnnouncementsByClassIds } from "@/lib/announcements";
import { getCorrectionTasksByUser } from "@/lib/corrections";
import { listAssignmentLessonLinks } from "@/lib/assignment-lesson-links";
import { combineDateAndTime, getDateKey, getWeekdayFromDate, listClassScheduleSessions } from "@/lib/class-schedules";
import { badRequest, unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

function inWindow(date: string) {
  const time = new Date(date).getTime();
  const now = Date.now();
  const start = now - 7 * 24 * 60 * 60 * 1000;
  const end = now + 30 * 24 * 60 * 60 * 1000;
  return time >= start && time <= end;
}

function getLessonStatus(startAt: string, endAt: string) {
  const nowTs = Date.now();
  const startTs = new Date(startAt).getTime();
  const endTs = new Date(endAt).getTime();
  if (startTs <= nowTs && nowTs < endTs) return "in_progress";
  if (startTs > nowTs) return "upcoming";
  return "finished";
}

async function buildLessonTimelineItems(classMap: Map<string, { name: string }>, classIds: string[]) {
  if (!classIds.length) return [] as Array<{
    id: string;
    type: string;
    title: string;
    date: string;
    className?: string;
    status?: string;
    description?: string;
  }>;

  const sessions = await listClassScheduleSessions({ classIds });
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 2);
  const items: Array<{
    id: string;
    type: string;
    title: string;
    date: string;
    className?: string;
    status?: string;
    description?: string;
  }> = [];

  for (let offset = 0; offset <= 16; offset += 1) {
    const target = new Date(start);
    target.setDate(start.getDate() + offset);
    const weekday = getWeekdayFromDate(target);
    const dateKey = getDateKey(target);
    sessions
      .filter((item) => item.weekday === weekday)
      .forEach((item) => {
        const startAt = combineDateAndTime(dateKey, item.startTime).toISOString();
        const endAt = combineDateAndTime(dateKey, item.endTime).toISOString();
        if (!inWindow(startAt)) return;
        const noteParts = [item.slotLabel, `${item.startTime}-${item.endTime}`, item.room, item.focusSummary].filter(Boolean);
        items.push({
          id: `${item.id}-${dateKey}`,
          type: "lesson",
          title: `课程：${classMap.get(item.classId)?.name ?? "班级课程"}`,
          date: startAt,
          className: classMap.get(item.classId)?.name ?? "-",
          status: getLessonStatus(startAt, endAt),
          description: noteParts.join(" · ")
        });
      });
  }

  return items;
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
      const classIds = classes.map((item) => item.id);
      const classMap = new Map(classes.map((item) => [item.id, item]));
      items.push(...(await buildLessonTimelineItems(classMap, classIds)));

      const assignments = await getAssignmentsByClassIds(classIds);
      const lessonLinks = await listAssignmentLessonLinks({
        classIds,
        assignmentIds: assignments.map((item) => item.id),
        taskKind: "prestudy"
      });
      const linkByAssignmentId = new Map(lessonLinks.map((item) => [item.assignmentId, item]));
      assignments.forEach((assignment) => {
        if (!inWindow(assignment.dueDate)) return;
        const link = linkByAssignmentId.get(assignment.id);
        items.push({
          id: assignment.id,
          type: "assignment",
          title: link ? `预习任务：${assignment.title}` : assignment.title,
          date: assignment.dueDate,
          className: classMap.get(assignment.classId)?.name ?? "-",
          description: link ? `关联课次：${link.lessonDate} · 课前任务` : undefined
        });
      });
      const announcements = await getAnnouncementsByClassIds(classIds);
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
      const classIds = classes.map((item) => item.id);
      const classMap = new Map(classes.map((item) => [item.id, item]));
      items.push(...(await buildLessonTimelineItems(classMap, classIds)));

      const assignments = await getAssignmentsByClassIds(classIds);
      const progress = await getAssignmentProgressByStudent(studentId);
      const progressMap = new Map(progress.map((item) => [item.assignmentId, item]));
      const lessonLinks = await listAssignmentLessonLinks({
        classIds,
        assignmentIds: assignments.map((item) => item.id),
        taskKind: "prestudy"
      });
      const linkByAssignmentId = new Map(lessonLinks.map((item) => [item.assignmentId, item]));
      assignments.forEach((assignment) => {
        if (!inWindow(assignment.dueDate)) return;
        const record = progressMap.get(assignment.id);
        const link = linkByAssignmentId.get(assignment.id);
        items.push({
          id: assignment.id,
          type: "assignment",
          title: link ? `预习任务：${assignment.title}` : assignment.title,
          date: assignment.dueDate,
          className: classMap.get(assignment.classId)?.name ?? "-",
          status: record?.status ?? "pending",
          description: link ? `关联课次：${link.lessonDate} · 上课前完成更顺手` : undefined
        });
      });
      const announcements = await getAnnouncementsByClassIds(classIds);
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

    items.sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());

    return { data: items };
  }
});
