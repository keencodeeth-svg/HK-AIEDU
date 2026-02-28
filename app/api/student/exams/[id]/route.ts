import { getClassesByStudent } from "@/lib/classes";
import { getQuestions } from "@/lib/content";
import { getExamEventByPaperAndStudent } from "@/lib/exam-events";
import { evaluateExamRisk } from "@/lib/exam-risk";
import { getExamReviewPack } from "@/lib/exam-review-pack";
import { resolveExamAvailability } from "@/lib/exam-availability";
import {
  ensureExamAssignment,
  getExamAssignment,
  getExamAnswerDraft,
  getExamPaperById,
  getExamPaperItems,
  getExamSubmission,
  markExamAssignmentInProgress
} from "@/lib/exams";
import { notFound, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createExamRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const examParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const GET = createExamRoute({
  role: "student",
  params: examParamsSchema,
  cache: "private-short",
  handler: async ({ params, user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const paperId = params.id;
    const paper = await getExamPaperById(paperId);
    if (!paper) {
      notFound("not found");
    }

    const classes = await getClassesByStudent(user.id);
    const classMap = new Map(classes.map((item) => [item.id, item]));
    const klass = classMap.get(paper.classId);
    if (!klass) {
      notFound("not found");
    }

    let assignment =
      paper.publishMode === "targeted"
        ? await getExamAssignment(paper.id, user.id)
        : await ensureExamAssignment(paper.id, user.id);
    if (!assignment) {
      notFound("not found");
    }
    const draft = await getExamAnswerDraft(paper.id, user.id);
    const submission = await getExamSubmission(paper.id, user.id);
    const reviewPack = submission ? await getExamReviewPack(paper.id, user.id) : null;
    const serverNow = new Date().toISOString();
    const availability = resolveExamAvailability(
      {
        status: paper.status,
        startAt: paper.startAt,
        endAt: paper.endAt
      },
      new Date(serverNow).getTime()
    );

    if (!submission && assignment.status !== "submitted" && availability.canEnter) {
      assignment = await markExamAssignmentInProgress({
        paperId: paper.id,
        studentId: user.id
      });
    }

    const items = await getExamPaperItems(paper.id);
    const questionMap = new Map((await getQuestions()).map((item) => [item.id, item]));
    const questions = items
      .map((item) => {
        const question = questionMap.get(item.questionId);
        if (!question) return null;
        return {
          id: question.id,
          stem: question.stem,
          options: question.options,
          score: item.score,
          orderIndex: item.orderIndex
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const event = await getExamEventByPaperAndStudent(paper.id, user.id);
    const risk = evaluateExamRisk({
      antiCheatLevel: paper.antiCheatLevel,
      blurCount: event?.blurCount ?? 0,
      visibilityHiddenCount: event?.visibilityHiddenCount ?? 0,
      startedAt: assignment.startedAt,
      submittedAt: assignment.submittedAt ?? submission?.submittedAt,
      durationMinutes: paper.durationMinutes,
      answerCount: Object.values(submission?.answers ?? draft?.answers ?? {}).filter((value) =>
        String(value ?? "").trim()
      ).length,
      questionCount: items.length,
      score: submission?.score,
      total: submission?.total
    });

    return {
      exam: paper,
      class: {
        id: klass.id,
        name: klass.name,
        subject: klass.subject,
        grade: klass.grade
      },
      assignment: submission ? { ...assignment, status: "submitted" } : assignment,
      questions,
      draftAnswers: draft?.answers ?? {},
      submission: submission
        ? {
            score: submission.score,
            total: submission.total,
            submittedAt: submission.submittedAt,
            answers: submission.answers
          }
        : null,
      reviewPackSummary: reviewPack?.data
        ? {
            wrongCount: reviewPack.data.wrongCount,
            estimatedMinutes: reviewPack.data.summary.estimatedMinutes,
            topWeakKnowledgePoints: reviewPack.data.summary.topWeakKnowledgePoints
          }
        : null,
      access: {
        stage: availability.stage,
        canEnter: availability.canEnter,
        canSubmit: availability.canSubmit,
        lockReason: availability.lockReason,
        serverNow
      },
      risk
    };
  }
});
