import { getCurrentUser } from "@/lib/auth";
import { getClassesByStudent } from "@/lib/classes";
import { getQuestions } from "@/lib/content";
import { buildExamReviewPack, getExamReviewPack, upsertExamReviewPack } from "@/lib/exam-review-pack";
import { getExamPaperById, getExamPaperItems, getExamSubmission } from "@/lib/exams";
import { notFound, unauthorized, withApi } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export const GET = withApi(async (_request, context) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    unauthorized();
  }

  const paperId = context.params.id;
  const paper = await getExamPaperById(paperId);
  if (!paper) {
    notFound("not found");
  }

  const classIds = new Set((await getClassesByStudent(user.id)).map((item) => item.id));
  if (!classIds.has(paper.classId)) {
    notFound("not found");
  }

  const existing = await getExamReviewPack(paper.id, user.id);
  if (existing) {
    return { data: existing.data };
  }

  const submission = await getExamSubmission(paper.id, user.id);
  if (!submission) {
    notFound("not found");
  }

  const [items, questions] = await Promise.all([getExamPaperItems(paper.id), getQuestions()]);
  const questionMap = new Map(questions.map((item) => [item.id, item]));

  const wrongDetails = items
    .map((item) => {
      const question = questionMap.get(item.questionId);
      if (!question) return null;
      const answer = submission.answers[question.id] ?? "";
      const correct = answer === question.answer;
      return {
        questionId: question.id,
        answer,
        correctAnswer: question.answer,
        score: Math.max(1, item.score),
        correct
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const wrongQuestions = items
    .map((item) => questionMap.get(item.questionId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const reviewPackData = await buildExamReviewPack({
    wrongDetails,
    wrongQuestions: wrongQuestions.map((item) => ({
      id: item.id,
      stem: item.stem,
      knowledgePointId: item.knowledgePointId,
      difficulty: item.difficulty,
      questionType: item.questionType
    }))
  });

  const saved = await upsertExamReviewPack({
    paperId: paper.id,
    studentId: user.id,
    data: reviewPackData
  });

  return {
    data: saved?.data ?? reviewPackData
  };
});
