import { getAssignmentById } from "@/lib/assignments";
import { getClassById } from "@/lib/classes";
import {
  combineDateAndTime,
  getClassScheduleSessionById,
  getDateKey,
  getWeekdayFromDate,
  getWeekdayLabel
} from "@/lib/class-schedules";
import type { Difficulty } from "@/lib/types";
import { apiSuccess, badRequest, notFound, unauthorized } from "@/lib/api/http";
import { SUBJECT_LABELS } from "@/lib/constants";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";
import { getAssignmentLessonLink, upsertAssignmentLessonLink } from "@/lib/assignment-lesson-links";
import { publishTeacherAssignment } from "@/lib/teacher-assignment-publishing";

const createSchedulePrestudyBodySchema = v.object<{
  classId: string;
  scheduleSessionId: string;
  lessonDate: string;
  title?: string;
  description?: string;
  dueDate?: string;
  questionCount?: number;
  knowledgePointId?: string;
  mode?: "bank" | "ai";
  difficulty?: Difficulty;
  questionType?: string;
  submissionType?: "quiz" | "upload" | "essay";
  maxUploads?: number;
  gradingFocus?: string;
  note?: string;
}>(
  {
    classId: v.string({ minLength: 1 }),
    scheduleSessionId: v.string({ minLength: 1 }),
    lessonDate: v.string({ minLength: 1 }),
    title: v.optional(v.string({ allowEmpty: true, trim: false })),
    description: v.optional(v.string({ allowEmpty: true, trim: false })),
    dueDate: v.optional(v.string({ minLength: 1 })),
    questionCount: v.optional(v.number({ coerce: true, integer: true, min: 0 })),
    knowledgePointId: v.optional(v.string({ minLength: 1 })),
    mode: v.optional(v.enum(["bank", "ai"] as const)),
    difficulty: v.optional(v.enum(["easy", "medium", "hard"] as const)),
    questionType: v.optional(v.string({ minLength: 1 })),
    submissionType: v.optional(v.enum(["quiz", "upload", "essay"] as const)),
    maxUploads: v.optional(v.number({ coerce: true, integer: true, min: 1, max: 20 })),
    gradingFocus: v.optional(v.string({ allowEmpty: true, trim: false })),
    note: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

function normalizeLessonDate(input: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    badRequest("lessonDate invalid");
  }
  return getDateKey(parsed);
}

function buildDefaultDueDate(lessonStartAt: Date) {
  const now = Date.now();
  const preferred = new Date(lessonStartAt);
  preferred.setHours(preferred.getHours() - 12);
  const latestAllowed = new Date(lessonStartAt.getTime() - 15 * 60 * 1000);
  const earliestAllowed = new Date(Math.min(latestAllowed.getTime(), now + 30 * 60 * 1000));

  if (preferred.getTime() >= earliestAllowed.getTime() && preferred.getTime() <= latestAllowed.getTime()) {
    return preferred.toISOString();
  }
  if (earliestAllowed.getTime() <= latestAllowed.getTime()) {
    return earliestAllowed.toISOString();
  }
  return new Date(Math.max(now + 15 * 60 * 1000, lessonStartAt.getTime() - 5 * 60 * 1000)).toISOString();
}

function buildDefaultTitle(input: {
  className: string;
  weekday: number;
  slotLabel?: string;
  subjectLabel?: string;
}) {
  const slotText = input.slotLabel ? ` · ${input.slotLabel}` : "";
  const subjectText = input.subjectLabel ? `${input.subjectLabel} ` : "";
  return `预习任务：${input.className} · ${subjectText}${getWeekdayLabel(input.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7)}${slotText}`;
}

function buildDefaultDescription(input: {
  focusSummary?: string;
  note?: string;
  lessonDate: string;
}) {
  const parts = [`请在 ${input.lessonDate} 上课前完成本次预习，进入课堂前先把重点过一遍。`];
  if (input.focusSummary) {
    parts.push(`课堂焦点：${input.focusSummary}`);
  }
  if (input.note) {
    parts.push(`老师提醒：${input.note}`);
  }
  return parts.join("\n");
}

export const POST = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ request, user, meta }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const body = await parseJson(request, createSchedulePrestudyBodySchema);
    const session = await getClassScheduleSessionById(body.scheduleSessionId);
    if (!session || session.classId !== body.classId) {
      notFound("schedule session not found");
    }

    const klass = await getClassById(body.classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound("class not found");
    }

    const lessonDate = normalizeLessonDate(body.lessonDate);
    const lessonAnchor = new Date(`${lessonDate}T00:00:00`);
    if (getWeekdayFromDate(lessonAnchor) !== session.weekday) {
      badRequest("lessonDate does not match schedule weekday");
    }

    const lessonStartAt = combineDateAndTime(lessonDate, session.startTime);
    const lessonEndAt = combineDateAndTime(lessonDate, session.endTime);
    if (lessonEndAt.getTime() < Date.now()) {
      badRequest("只能为当前或未来课次布置预习任务");
    }

    const existingLink = await getAssignmentLessonLink({
      scheduleSessionId: session.id,
      lessonDate,
      taskKind: "prestudy"
    });
    if (existingLink) {
      const existingAssignment = await getAssignmentById(existingLink.assignmentId);
      if (existingAssignment) {
        return apiSuccess(
          {
            data: existingAssignment,
            existing: true,
            link: existingLink
          },
          { requestId: meta.requestId }
        );
      }
    }

    const dueDate = body.dueDate?.trim() ? body.dueDate : buildDefaultDueDate(lessonStartAt);
    const title = body.title?.trim()
      ? body.title.trim()
      : buildDefaultTitle({
          className: klass.name,
          weekday: session.weekday,
          slotLabel: session.slotLabel,
          subjectLabel: SUBJECT_LABELS[klass.subject] ?? klass.subject
        });
    const description = body.description?.trim()
      ? body.description
      : buildDefaultDescription({
          focusSummary: session.focusSummary,
          note: session.note,
          lessonDate
        });

    const result = await publishTeacherAssignment({
      teacherId: user.id,
      classId: body.classId,
      title,
      description,
      dueDate,
      questionCount: body.questionCount,
      knowledgePointId: body.knowledgePointId,
      mode: body.mode,
      difficulty: body.difficulty,
      questionType: body.questionType,
      submissionType: body.submissionType,
      maxUploads: body.maxUploads,
      gradingFocus: body.gradingFocus
    });

    const dueAtTs = new Date(result.assignment.dueDate).getTime();
    const publishLeadMinutes = dueAtTs < lessonStartAt.getTime()
      ? Math.max(0, Math.round((lessonStartAt.getTime() - dueAtTs) / 60_000))
      : undefined;

    const link = await upsertAssignmentLessonLink({
      assignmentId: result.assignment.id,
      classId: body.classId,
      scheduleSessionId: session.id,
      taskKind: "prestudy",
      teacherId: user.id,
      lessonDate,
      note: body.note,
      publishLeadMinutes
    });

    return apiSuccess(
      {
        data: result.assignment,
        existing: false,
        fallback: result.fallbackMode,
        link,
        lesson: {
          date: lessonDate,
          startAt: lessonStartAt.toISOString(),
          endAt: lessonEndAt.toISOString()
        },
        message: result.fallbackMode === "bank" ? "AI 未配置，已自动改为题库抽题" : undefined
      },
      { requestId: meta.requestId }
    );
  }
});
