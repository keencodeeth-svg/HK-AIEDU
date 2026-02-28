import { getClassesByStudent } from "@/lib/classes";
import {
  ensureExamAssignment,
  getExamAssignment,
  getExamPaperById,
  getExamSubmission,
  markExamAssignmentInProgress,
  upsertExamAnswerDraft
} from "@/lib/exams";
import { resolveExamAvailability } from "@/lib/exam-availability";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createExamRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const passthrough = (value: unknown) => value;

const autosaveBodySchema = v.object<{ answers: unknown }>(
  {
    answers: passthrough
  },
  { allowUnknown: false }
);

const examParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

function normalizeAnswers(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    badRequest("answers must be an object");
  }
  const answers: Record<string, string> = {};
  for (const [questionId, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== "string") {
      badRequest(`answers.${questionId} must be a string`);
    }
    answers[questionId] = value;
  }
  return answers;
}

function assertExamTimeNotExceeded(input: {
  endAt: string;
  durationMinutes?: number;
  startedAt?: string;
  graceMs?: number;
}) {
  const now = Date.now();
  const endDeadline = new Date(input.endAt).getTime();
  const durationDeadline =
    input.durationMinutes && input.startedAt
      ? new Date(input.startedAt).getTime() + input.durationMinutes * 60 * 1000
      : Number.POSITIVE_INFINITY;
  const effectiveDeadline = Math.min(endDeadline, durationDeadline);
  const graceMs = Math.max(0, Number(input.graceMs ?? 0));
  if (Number.isFinite(effectiveDeadline) && now > effectiveDeadline + graceMs) {
    badRequest("考试作答时间已结束");
  }
}

export const POST = createExamRoute({
  role: "student",
  params: examParamsSchema,
  cache: "private-realtime",
  handler: async ({ request, params, user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const paperId = params.id;
    const paper = await getExamPaperById(paperId);
    if (!paper) {
      notFound("not found");
    }

    const classIds = new Set((await getClassesByStudent(user.id)).map((item) => item.id));
    if (!classIds.has(paper.classId)) {
      notFound("not found");
    }

    const availability = resolveExamAvailability({
      status: paper.status,
      startAt: paper.startAt,
      endAt: paper.endAt
    });
    if (!availability.canSubmit) {
      badRequest(availability.lockReason ?? "考试当前不可作答");
    }

    const assignmentBeforeSave =
      paper.publishMode === "targeted"
        ? await getExamAssignment(paper.id, user.id)
        : await ensureExamAssignment(paper.id, user.id);
    if (!assignmentBeforeSave) {
      notFound("not found");
    }
    assertExamTimeNotExceeded({
      endAt: paper.endAt,
      durationMinutes: paper.durationMinutes,
      startedAt: assignmentBeforeSave.startedAt
    });

    const submitted = await getExamSubmission(paper.id, user.id);
    if (submitted) {
      badRequest("考试已提交");
    }

    const body = await parseJson(request, autosaveBodySchema);
    const answers = normalizeAnswers(body.answers);
    const draft = await upsertExamAnswerDraft({
      paperId: paper.id,
      studentId: user.id,
      answers
    });
    const assignment = await markExamAssignmentInProgress({
      paperId: paper.id,
      studentId: user.id
    });

    return {
      savedAt: draft.updatedAt,
      status: assignment.status,
      startedAt: assignment.startedAt ?? null
    };
  }
});
