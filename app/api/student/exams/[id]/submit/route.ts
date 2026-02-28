import { getClassesByStudent } from "@/lib/classes";
import { getQuestions } from "@/lib/content";
import { getExamEventByPaperAndStudent } from "@/lib/exam-events";
import { evaluateExamRisk } from "@/lib/exam-risk";
import { resolveExamAvailability } from "@/lib/exam-availability";
import {
  ensureExamAssignment,
  getExamAssignment,
  getExamAnswerDraft,
  getExamPaperById,
  getExamPaperItems,
  getExamSubmission,
  markExamAssignmentSubmitted,
  upsertExamAnswerDraft,
  upsertExamSubmission
} from "@/lib/exams";
import { buildExamReviewPack, getExamReviewPack, upsertExamReviewPack } from "@/lib/exam-review-pack";
import { enqueueWrongReview } from "@/lib/wrong-review";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createExamRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const passthrough = (value: unknown) => value;

const submitBodySchema = v.object<{ answers?: unknown }>(
  {
    answers: v.optional(passthrough)
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
  if (input === undefined || input === null) return null;
  if (typeof input !== "object" || Array.isArray(input)) {
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

function scoreExamByItems(input: {
  items: Array<{ questionId: string; score: number }>;
  questionMap: Map<string, { id: string; answer: string }>;
  answers: Record<string, string>;
}) {
  let score = 0;
  let total = 0;
  const details: Array<{
    questionId: string;
    correct: boolean;
    answer: string;
    correctAnswer: string;
    score: number;
  }> = [];

  input.items.forEach((item) => {
    const question = input.questionMap.get(item.questionId);
    if (!question) return;
    const answer = input.answers[question.id] ?? "";
    const correct = answer === question.answer;
    const questionScore = Math.max(1, item.score);
    total += questionScore;
    if (correct) {
      score += questionScore;
    }
    details.push({
      questionId: question.id,
      correct,
      answer,
      correctAnswer: question.answer,
      score: questionScore
    });
  });

  return { score, total, details };
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

    const assignmentBeforeSubmit =
      paper.publishMode === "targeted"
        ? await getExamAssignment(paper.id, user.id)
        : await ensureExamAssignment(paper.id, user.id);
    if (!assignmentBeforeSubmit) {
      notFound("not found");
    }
    const existingSubmission = await getExamSubmission(paper.id, user.id);
    const availability = resolveExamAvailability({
      status: paper.status,
      startAt: paper.startAt,
      endAt: paper.endAt
    });

    if (!existingSubmission) {
      if (!availability.canSubmit) {
        badRequest(availability.lockReason ?? "考试当前不可提交");
      }
      assertExamTimeNotExceeded({
        endAt: paper.endAt,
        durationMinutes: paper.durationMinutes,
        startedAt: assignmentBeforeSubmit.startedAt,
        graceMs: 120000
      });
    }

    const items = await getExamPaperItems(paper.id);
    if (!items.length) {
      badRequest("考试题目为空");
    }

    const questionMap = new Map((await getQuestions()).map((item) => [item.id, item]));
    if (existingSubmission) {
      const existingReviewPack = await getExamReviewPack(paper.id, user.id);
      const rescored = scoreExamByItems({
        items,
        questionMap,
        answers: existingSubmission.answers
      });
      const existingEvent = await getExamEventByPaperAndStudent(paper.id, user.id);
      const risk = evaluateExamRisk({
        antiCheatLevel: paper.antiCheatLevel,
        blurCount: existingEvent?.blurCount ?? 0,
        visibilityHiddenCount: existingEvent?.visibilityHiddenCount ?? 0,
        startedAt: assignmentBeforeSubmit.startedAt,
        submittedAt: existingSubmission.submittedAt,
        durationMinutes: paper.durationMinutes,
        answerCount: Object.values(existingSubmission.answers ?? {}).filter((item) => String(item ?? "").trim()).length,
        questionCount: items.length,
        score: existingSubmission.score,
        total: existingSubmission.total
      });
      const wrongCount = rescored.details.filter((item) => !item.correct).length;
      return {
        score: existingSubmission.score,
        total: existingSubmission.total,
        submittedAt: existingSubmission.submittedAt,
        details: rescored.details,
        wrongCount,
        queuedReviewCount: 0,
        reviewPackSummary: existingReviewPack?.data
          ? {
              wrongCount: existingReviewPack.data.wrongCount,
              estimatedMinutes: existingReviewPack.data.summary.estimatedMinutes,
              topWeakKnowledgePoints: existingReviewPack.data.summary.topWeakKnowledgePoints
            }
          : null,
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        riskReasons: risk.riskReasons,
        recommendedAction: risk.recommendedAction,
        alreadySubmitted: true
      };
    }

    const body = await parseJson(request, submitBodySchema);
    const inputAnswers = normalizeAnswers(body.answers);
    const draft = await getExamAnswerDraft(paper.id, user.id);
    const answers = inputAnswers ?? draft?.answers ?? {};
    const rescored = scoreExamByItems({
      items,
      questionMap,
      answers
    });
    const wrongDetails = rescored.details.filter((item) => !item.correct);
    const wrongQuestions = wrongDetails
      .map((item) => questionMap.get(item.questionId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    await upsertExamAnswerDraft({
      paperId: paper.id,
      studentId: user.id,
      answers
    });

    const submission = await upsertExamSubmission({
      paperId: paper.id,
      studentId: user.id,
      answers,
      score: rescored.score,
      total: rescored.total
    });

    await markExamAssignmentSubmitted({
      paperId: paper.id,
      studentId: user.id,
      score: rescored.score,
      total: rescored.total
    });

    const queued = await Promise.all(
      wrongQuestions.map((question) =>
        enqueueWrongReview({
          userId: user.id,
          questionId: question.id,
          subject: question.subject,
          knowledgePointId: question.knowledgePointId
        })
      )
    );
    const queuedReviewCount = queued.filter((item) => Boolean(item)).length;
    const reviewPackData = await buildExamReviewPack({
      wrongDetails: wrongDetails.map((item) => ({
        questionId: item.questionId,
        answer: item.answer,
        correctAnswer: item.correctAnswer,
        score: item.score,
        correct: item.correct
      })),
      wrongQuestions: wrongQuestions.map((item) => ({
        id: item.id,
        stem: item.stem,
        knowledgePointId: item.knowledgePointId,
        difficulty: item.difficulty,
        questionType: item.questionType
      }))
    });

    const reviewPack = await upsertExamReviewPack({
      paperId: paper.id,
      studentId: user.id,
      data: reviewPackData
    });
    const event = await getExamEventByPaperAndStudent(paper.id, user.id);
    const risk = evaluateExamRisk({
      antiCheatLevel: paper.antiCheatLevel,
      blurCount: event?.blurCount ?? 0,
      visibilityHiddenCount: event?.visibilityHiddenCount ?? 0,
      startedAt: assignmentBeforeSubmit.startedAt,
      submittedAt: submission.submittedAt,
      durationMinutes: paper.durationMinutes,
      answerCount: Object.values(answers).filter((item) => String(item ?? "").trim()).length,
      questionCount: items.length,
      score: submission.score,
      total: submission.total
    });

    return {
      score: submission.score,
      total: submission.total,
      submittedAt: submission.submittedAt,
      details: rescored.details,
      wrongCount: wrongDetails.length,
      queuedReviewCount,
      reviewPackSummary: reviewPack?.data
        ? {
            wrongCount: reviewPack.data.wrongCount,
            estimatedMinutes: reviewPack.data.summary.estimatedMinutes,
            topWeakKnowledgePoints: reviewPack.data.summary.topWeakKnowledgePoints
          }
        : null,
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      riskReasons: risk.riskReasons,
      recommendedAction: risk.recommendedAction,
      alreadySubmitted: false
    };
  }
});
