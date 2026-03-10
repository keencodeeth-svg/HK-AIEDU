import { getUsers, getCurrentUser } from "@/lib/auth";
import { getAssignmentsByClassIds, getAssignmentProgress, getAssignmentProgressByStudent } from "@/lib/assignments";
import { listAssignmentLessonLinks } from "@/lib/assignment-lesson-links";
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

type PrestudyProgressSummary = {
  completedCount: number;
  pendingCount: number;
  totalCount: number;
  completionRate: number;
};

type LinkedLessonAssignmentMeta = {
  assignmentId: string;
  title: string;
  dueAt: string;
  progressStatus?: string;
  progressSummary: PrestudyProgressSummary;
  note?: string;
  lessonDate: string;
};

function buildLinkKey(sessionId: string, lessonDate: string) {
  return `${sessionId}:${lessonDate}`;
}

function resolveNextOccurrence(session: ClassScheduleSession, now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  for (let offset = 0; offset <= 8; offset += 1) {
    const target = new Date(start);
    target.setDate(start.getDate() + offset);
    if (getWeekdayFromDate(target) !== session.weekday) continue;
    const dateKey = getDateKey(target);
    const startAt = combineDateAndTime(dateKey, session.startTime);
    const endAt = combineDateAndTime(dateKey, session.endTime);
    if (endAt.getTime() < now.getTime()) continue;
    return {
      date: dateKey,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString()
    };
  }

  return undefined;
}

function buildSingleStudentProgressSummary(status?: string): PrestudyProgressSummary {
  const completed = status === "completed" ? 1 : 0;
  const pending = completed ? 0 : 1;
  return {
    completedCount: completed,
    pendingCount: pending,
    totalCount: 1,
    completionRate: completed
  };
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
    const now = new Date();
    const nowTs = now.getTime();

    const [sessions, assignments, users, moduleLists, progress, lessonLinks] = await Promise.all([
      listClassScheduleSessions({ classIds }),
      getAssignmentsByClassIds(classIds),
      getUsers(),
      Promise.all(classes.map((klass) => getModulesByClass(klass.id))),
      studentId ? getAssignmentProgressByStudent(studentId) : Promise.resolve([]),
      listAssignmentLessonLinks({ classIds, taskKind: "prestudy" })
    ]);

    const teacherNameById = new Map(users.filter((item) => item.role === "teacher").map((item) => [item.id, item.name]));
    const moduleCountByClass = new Map(classes.map((klass, index) => [klass.id, moduleLists[index]?.length ?? 0]));
    const progressMap = new Map(progress.map((item) => [item.assignmentId, item]));
    const assignmentsById = new Map(assignments.map((item) => [item.id, item]));
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

    const nextOccurrenceBySessionId = new Map(
      sessions.map((session) => [session.id, resolveNextOccurrence(session, now)])
    );

    const linkedAssignmentIds = Array.from(new Set(lessonLinks.map((item) => item.assignmentId))).filter((id) => assignmentsById.has(id));
    const linkedProgressSummaryByAssignmentId = new Map<string, PrestudyProgressSummary>();

    if (role === "teacher") {
      const linkedProgressLists = await Promise.all(
        linkedAssignmentIds.map(async (assignmentId) => [assignmentId, await getAssignmentProgress(assignmentId)] as const)
      );
      linkedProgressLists.forEach(([assignmentId, records]) => {
        const completedCount = records.filter((item) => item.status === "completed").length;
        const totalCount = records.length;
        const pendingCount = Math.max(totalCount - completedCount, 0);
        linkedProgressSummaryByAssignmentId.set(assignmentId, {
          completedCount,
          pendingCount,
          totalCount,
          completionRate: totalCount ? completedCount / totalCount : 0
        });
      });
    }

    const linkedAssignmentByKey = new Map<string, LinkedLessonAssignmentMeta>();
    lessonLinks.forEach((link) => {
      const assignment = assignmentsById.get(link.assignmentId);
      if (!assignment) return;
      linkedAssignmentByKey.set(buildLinkKey(link.scheduleSessionId, link.lessonDate), {
        assignmentId: assignment.id,
        title: assignment.title,
        dueAt: assignment.dueDate,
        progressStatus: studentId ? progressMap.get(assignment.id)?.status : undefined,
        progressSummary:
          role === "teacher"
            ? linkedProgressSummaryByAssignmentId.get(assignment.id) ?? {
                completedCount: 0,
                pendingCount: 0,
                totalCount: 0,
                completionRate: 0
              }
            : buildSingleStudentProgressSummary(progressMap.get(assignment.id)?.status),
        note: link.note,
        lessonDate: link.lessonDate
      });
    });

    function resolveAction(base: {
      classAssignmentId?: string;
      prestudyAssignmentId?: string;
      prestudyProgressStatus?: string;
      moduleCount: number;
    }) {
      if (role === "student") {
        if (base.prestudyAssignmentId) {
          return {
            actionHref: `/student/assignments/${base.prestudyAssignmentId}`,
            actionLabel: base.prestudyProgressStatus === "completed" ? "查看预习回顾" : "去完成预习"
          };
        }
        if (base.classAssignmentId) {
          return { actionHref: `/student/assignments/${base.classAssignmentId}`, actionLabel: "去准备作业" };
        }
        if (base.moduleCount > 0) {
          return { actionHref: "/student/modules", actionLabel: "去课程模块" };
        }
        return { actionHref: "/course", actionLabel: "查看课程主页" };
      }

      if (role === "parent") {
        if (base.prestudyAssignmentId) {
          return {
            actionHref: "/parent",
            actionLabel: base.prestudyProgressStatus === "completed" ? "查看预习回顾" : "查看预习进度"
          };
        }
        if (base.classAssignmentId) {
          return { actionHref: "/parent", actionLabel: "查看孩子任务" };
        }
        if (base.moduleCount > 0) {
          return { actionHref: "/course", actionLabel: "查看课程主页" };
        }
        return { actionHref: "/calendar", actionLabel: "查看课程安排" };
      }

      if (base.prestudyAssignmentId) {
        return { actionHref: `/teacher/assignments/${base.prestudyAssignmentId}`, actionLabel: "查看预习任务" };
      }
      return { actionHref: "/calendar", actionLabel: "去布置预习" };
    }

    function buildLessonDecorations(session: ClassScheduleSession, lessonDate?: string) {
      const assignmentMeta = assignmentMetaByClass.get(session.classId) ?? {
        pendingAssignmentCount: 0,
        nextAssignmentId: undefined,
        nextAssignmentTitle: undefined,
        nextAssignmentDueAt: undefined
      };
      const nextOccurrence = nextOccurrenceBySessionId.get(session.id);
      const linkedAssignment = lessonDate
        ? linkedAssignmentByKey.get(buildLinkKey(session.id, lessonDate))
        : nextOccurrence?.date
          ? linkedAssignmentByKey.get(buildLinkKey(session.id, nextOccurrence.date))
          : undefined;
      const moduleCount = moduleCountByClass.get(session.classId) ?? 0;
      const preferredAssignmentId = linkedAssignment?.assignmentId ?? assignmentMeta.nextAssignmentId;
      return {
        nextOccurrenceDate: nextOccurrence?.date,
        nextOccurrenceStartAt: nextOccurrence?.startAt,
        nextOccurrenceEndAt: nextOccurrence?.endAt,
        pendingAssignmentCount: assignmentMeta.pendingAssignmentCount,
        prestudyAssignmentCount: linkedAssignment ? 1 : 0,
        prestudyAssignmentId: linkedAssignment?.assignmentId,
        prestudyAssignmentTitle: linkedAssignment?.title,
        prestudyAssignmentDueAt: linkedAssignment?.dueAt,
        prestudyAssignmentStatus: linkedAssignment?.progressStatus,
        prestudyCompletedCount: linkedAssignment?.progressSummary.completedCount,
        prestudyPendingCount: linkedAssignment?.progressSummary.pendingCount,
        prestudyTotalCount: linkedAssignment?.progressSummary.totalCount,
        prestudyCompletionRate: linkedAssignment?.progressSummary.completionRate,
        prestudyLessonDate: linkedAssignment?.lessonDate,
        prestudyNote: linkedAssignment?.note,
        nextAssignmentId: preferredAssignmentId,
        nextAssignmentTitle: linkedAssignment?.title ?? assignmentMeta.nextAssignmentTitle,
        nextAssignmentDueAt: linkedAssignment?.dueAt ?? assignmentMeta.nextAssignmentDueAt,
        ...resolveAction({
          classAssignmentId: assignmentMeta.nextAssignmentId,
          prestudyAssignmentId: linkedAssignment?.assignmentId,
          prestudyProgressStatus: linkedAssignment?.progressStatus,
          moduleCount
        })
      };
    }

    function buildLessonBase(session: ClassScheduleSession): ScheduleLessonBase {
      const klass = classMap.get(session.classId);
      if (!klass) {
        throw new Error(`class missing for schedule session ${session.id}`);
      }
      return {
        ...session,
        className: klass.name,
        subject: klass.subject,
        subjectLabel: SUBJECT_LABELS[klass.subject] ?? klass.subject,
        grade: klass.grade,
        teacherId: klass.teacherId,
        teacherName: klass.teacherId ? teacherNameById.get(klass.teacherId) : undefined,
        weekdayLabel: getWeekdayLabel(session.weekday),
        moduleCount: moduleCountByClass.get(session.classId) ?? 0,
        ...buildLessonDecorations(session)
      };
    }

    function buildOccurrence(session: ClassScheduleSession, dateKey: string): ScheduleLessonOccurrence {
      const base = buildLessonBase(session);
      const startAt = combineDateAndTime(dateKey, session.startTime).toISOString();
      const endAt = combineDateAndTime(dateKey, session.endTime).toISOString();
      return {
        ...base,
        ...buildLessonDecorations(session, dateKey),
        date: dateKey,
        startAt,
        endAt,
        status: resolveLessonStatus(startAt, endAt, nowTs)
      };
    }

    const weekly: ScheduleWeekDay[] = buildWeekDays().map((day) => ({
      ...day,
      lessons: sessions
        .filter((item) => item.weekday === day.weekday)
        .sort(compareSessionTime)
        .map((item) => buildLessonBase(item))
    }));

    const todayWeekday = getWeekdayFromDate(now);
    const todayDateKey = getDateKey(now);
    const todayLessons = sessions
      .filter((item) => item.weekday === todayWeekday)
      .sort(compareSessionTime)
      .map((item) => buildOccurrence(item, todayDateKey));

    const upcomingLessons: ScheduleLessonOccurrence[] = [];
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

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
    const scheduledClassCount = new Set(sessions.map((item) => item.classId)).size;

    return {
      data: {
        generatedAt: new Date().toISOString(),
        role,
        summary: {
          classCount: classes.length,
          scheduledClassCount,
          classesWithoutScheduleCount: Math.max(classes.length - scheduledClassCount, 0),
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
