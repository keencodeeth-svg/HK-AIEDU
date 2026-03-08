import { getUsers, getCurrentUser } from "@/lib/auth";
import { getAssignmentsByClassIds, getAssignmentProgressByStudent } from "@/lib/assignments";
import {
  buildWeekDays,
  combineDateAndTime,
  getDateKey,
  getWeekdayLabel,
  getWeekdayFromDate,
  listClassScheduleSessions,
  type ClassScheduleSession,
  type LessonStatus,
  type ScheduleLessonBase,
  type ScheduleLessonOccurrence,
  type ScheduleWeekDay
} from "@/lib/class-schedules";
import { getClassesByStudent, getClassesByTeacher } from "@/lib/classes";
import { SUBJECT_LABELS } from "@/lib/constants";
import { getModulesByClass } from "@/lib/modules";
import { badRequest, unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

function compareSessionTime(left: { startTime: string; endTime: string }, right: { startTime: string; endTime: string }) {
  if (left.startTime !== right.startTime) return left.startTime.localeCompare(right.startTime);
  return left.endTime.localeCompare(right.endTime);
}

function compareOccurrenceTime(left: { startAt: string }, right: { startAt: string }) {
  return new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
}

function resolveLessonStatus(startAt: string, endAt: string, nowTs: number): LessonStatus {
  const startTs = new Date(startAt).getTime();
  const endTs = new Date(endAt).getTime();
  if (startTs <= nowTs && nowTs < endTs) return "in_progress";
  if (startTs > nowTs) return "upcoming";
  return "finished";
}

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || (user.role !== "student" && user.role !== "teacher" && user.role !== "parent")) {
      unauthorized();
    }

    const role = user.role;
    const studentId = role === "student" ? user.id : role === "parent" ? user.studentId ?? null : null;
    if (role === "parent" && !studentId) {
      badRequest("missing student");
    }

    const classes = role === "teacher" ? await getClassesByTeacher(user.id) : await getClassesByStudent(studentId ?? user.id);
    const classIds = classes.map((item) => item.id);
    const classMap = new Map(classes.map((item) => [item.id, item]));

    const [sessions, assignments, users, moduleLists, progress] = await Promise.all([
      listClassScheduleSessions({ classIds }),
      getAssignmentsByClassIds(classIds),
      getUsers(),
      Promise.all(classes.map((klass) => getModulesByClass(klass.id))),
      studentId ? getAssignmentProgressByStudent(studentId) : Promise.resolve([])
    ]);

    const teacherNameById = new Map(users.filter((item) => item.role === "teacher").map((item) => [item.id, item.name]));
    const moduleCountByClass = new Map(classes.map((klass, index) => [klass.id, moduleLists[index]?.length ?? 0]));
    const progressMap = new Map(progress.map((item) => [item.assignmentId, item]));
    const assignmentsByClass = new Map<string, typeof assignments>();

    classIds.forEach((classId) => assignmentsByClass.set(classId, []));
    assignments.forEach((assignment) => {
      const list = assignmentsByClass.get(assignment.classId) ?? [];
      list.push(assignment);
      assignmentsByClass.set(assignment.classId, list);
    });

    const assignmentMetaByClass = new Map<string, {
      pendingAssignmentCount: number;
      nextAssignmentId?: string;
      nextAssignmentTitle?: string;
      nextAssignmentDueAt?: string;
    }>();

    classes.forEach((klass) => {
      const classAssignments = [...(assignmentsByClass.get(klass.id) ?? [])].sort(
        (left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime()
      );
      if (studentId) {
        const pendingAssignments = classAssignments.filter((item) => progressMap.get(item.id)?.status !== "completed");
        assignmentMetaByClass.set(klass.id, {
          pendingAssignmentCount: pendingAssignments.length,
          nextAssignmentId: pendingAssignments[0]?.id,
          nextAssignmentTitle: pendingAssignments[0]?.title,
          nextAssignmentDueAt: pendingAssignments[0]?.dueDate
        });
        return;
      }

      assignmentMetaByClass.set(klass.id, {
        pendingAssignmentCount: classAssignments.length,
        nextAssignmentId: classAssignments[0]?.id,
        nextAssignmentTitle: classAssignments[0]?.title,
        nextAssignmentDueAt: classAssignments[0]?.dueDate
      });
    });

    function resolveAction(base: {
      nextAssignmentId?: string;
      moduleCount: number;
    }) {
      if (role === "student") {
        if (base.nextAssignmentId) {
          return { actionHref: `/student/assignments/${base.nextAssignmentId}`, actionLabel: "去准备作业" };
        }
        if (base.moduleCount > 0) {
          return { actionHref: "/student/modules", actionLabel: "去课程模块" };
        }
        return { actionHref: "/course", actionLabel: "查看课程主页" };
      }

      if (role === "parent") {
        if (base.nextAssignmentId) {
          return { actionHref: "/parent", actionLabel: "查看孩子任务" };
        }
        if (base.moduleCount > 0) {
          return { actionHref: "/course", actionLabel: "查看课程主页" };
        }
        return { actionHref: "/calendar", actionLabel: "查看课程安排" };
      }

      if (base.nextAssignmentId) {
        return { actionHref: "/teacher/submissions", actionLabel: "查看提交箱" };
      }
      if (base.moduleCount > 0) {
        return { actionHref: "/teacher/modules", actionLabel: "查看课程模块" };
      }
      return { actionHref: "/course", actionLabel: "查看课程主页" };
    }

    function buildLessonBase(session: ClassScheduleSession): ScheduleLessonBase {
      const klass = classMap.get(session.classId);
      if (!klass) {
        throw new Error(`class missing for schedule session ${session.id}`);
      }
      const assignmentMeta = assignmentMetaByClass.get(session.classId) ?? {
        pendingAssignmentCount: 0,
        nextAssignmentId: undefined,
        nextAssignmentTitle: undefined,
        nextAssignmentDueAt: undefined
      };
      const moduleCount = moduleCountByClass.get(session.classId) ?? 0;
      return {
        ...session,
        className: klass.name,
        subject: klass.subject,
        subjectLabel: SUBJECT_LABELS[klass.subject] ?? klass.subject,
        grade: klass.grade,
        teacherId: klass.teacherId,
        teacherName: klass.teacherId ? teacherNameById.get(klass.teacherId) : undefined,
        weekdayLabel: getWeekdayLabel(session.weekday),
        moduleCount,
        pendingAssignmentCount: assignmentMeta.pendingAssignmentCount,
        nextAssignmentId: assignmentMeta.nextAssignmentId,
        nextAssignmentTitle: assignmentMeta.nextAssignmentTitle,
        nextAssignmentDueAt: assignmentMeta.nextAssignmentDueAt,
        ...resolveAction({
          nextAssignmentId: assignmentMeta.nextAssignmentId,
          moduleCount
        })
      };
    }

    function buildOccurrence(session: ClassScheduleSession, dateKey: string): ScheduleLessonOccurrence {
      const base = buildLessonBase(session);
      const startAt = combineDateAndTime(dateKey, session.startTime).toISOString();
      const endAt = combineDateAndTime(dateKey, session.endTime).toISOString();
      return {
        ...base,
        date: dateKey,
        startAt,
        endAt,
        status: resolveLessonStatus(startAt, endAt, Date.now())
      };
    }

    const weekly: ScheduleWeekDay[] = buildWeekDays().map((day) => ({
      ...day,
      lessons: sessions
        .filter((item) => item.weekday === day.weekday)
        .sort(compareSessionTime)
        .map((item) => buildLessonBase(item))
    }));

    const today = new Date();
    const todayWeekday = getWeekdayFromDate(today);
    const todayDateKey = getDateKey(today);
    const todayLessons = sessions
      .filter((item) => item.weekday === todayWeekday)
      .sort(compareSessionTime)
      .map((item) => buildOccurrence(item, todayDateKey));

    const upcomingLessons: ScheduleLessonOccurrence[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const nowTs = Date.now();

    for (let offset = 0; offset < 8; offset += 1) {
      const target = new Date(start);
      target.setDate(start.getDate() + offset);
      const weekday = getWeekdayFromDate(target);
      const dateKey = getDateKey(target);
      sessions
        .filter((item) => item.weekday === weekday)
        .sort(compareSessionTime)
        .forEach((item) => {
          const occurrence = buildOccurrence(item, dateKey);
          if (new Date(occurrence.endAt).getTime() >= nowTs) {
            upcomingLessons.push(occurrence);
          }
        });
    }

    upcomingLessons.sort(compareOccurrenceTime);

    return {
      data: {
        generatedAt: new Date().toISOString(),
        role,
        summary: {
          classCount: classes.length,
          scheduledClassCount: new Set(sessions.map((item) => item.classId)).size,
          classesWithoutScheduleCount: Math.max(classes.length - new Set(sessions.map((item) => item.classId)).size, 0),
          totalLessonsToday: todayLessons.length,
          remainingLessonsToday: todayLessons.filter((item) => new Date(item.endAt).getTime() >= nowTs).length,
          totalLessonsThisWeek: weekly.reduce((sum, item) => sum + item.lessons.length, 0)
        },
        nextLesson: upcomingLessons[0] ?? null,
        todayLessons,
        weekly
      }
    };
  }
});
