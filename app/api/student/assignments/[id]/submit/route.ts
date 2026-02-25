import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { getClassesByStudent } from "@/lib/classes";
import {
  completeAssignmentProgress,
  getAssignmentById,
  getAssignmentItems,
  upsertAssignmentSubmission
} from "@/lib/assignments";
import { getQuestions } from "@/lib/content";
import { addAttempt } from "@/lib/progress";
import { syncMasteryFromAttempts } from "@/lib/mastery";
import { getAssignmentUploads } from "@/lib/assignment-uploads";
import { badRequest, notFound, unauthorized, withApi } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

const passthrough = (value: unknown) => value;

const submitBodySchema = v.object<{
  answers?: unknown;
  submissionText?: string;
}>(
  {
    answers: v.optional(passthrough),
    submissionText: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

function normalizeAnswers(input: unknown) {
  if (input === undefined) return {} as Record<string, string>;
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

export const POST = withApi(async (request, context) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    unauthorized();
  }

  const assignmentId = context.params.id;
  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) {
    notFound("not found");
  }

  const classes = await getClassesByStudent(user.id);
  const classIds = new Set(classes.map((item) => item.id));
  if (!classIds.has(assignment.classId)) {
    notFound("not found");
  }

  const body = await parseJson(request, submitBodySchema);
  const answers = normalizeAnswers(body.answers);

  const items = await getAssignmentItems(assignment.id);
  const questions = await getQuestions();
  const questionMap = new Map(questions.map((item) => [item.id, item]));

  let score = 0;
  const details = [] as Array<{
    questionId: string;
    correct: boolean;
    answer: string;
    correctAnswer: string;
    explanation: string;
  }>;

  const isUpload = assignment.submissionType === "upload";
  const isEssay = assignment.submissionType === "essay";
  const uploads = isUpload || isEssay ? await getAssignmentUploads(assignment.id, user.id) : [];
  const hasUploads = uploads.length > 0;
  const hasText = Boolean(body.submissionText?.trim());

  if (isUpload && !hasUploads) {
    badRequest("请先上传作业文件");
  }
  if (isEssay && !hasUploads && !hasText) {
    badRequest("请填写作文内容或上传作业图片");
  }

  if (!isUpload && !isEssay) {
    for (const item of items) {
      const question = questionMap.get(item.questionId);
      if (!question) {
        continue;
      }
      const answer = answers[question.id] ?? "";
      const correct = answer === question.answer;
      if (correct) score += 1;

      await addAttempt({
        id: crypto.randomBytes(10).toString("hex"),
        userId: user.id,
        questionId: question.id,
        subject: question.subject,
        knowledgePointId: question.knowledgePointId,
        correct,
        answer,
        createdAt: new Date().toISOString()
      });

      details.push({
        questionId: question.id,
        correct,
        answer,
        correctAnswer: question.answer,
        explanation: question.explanation
      });
    }

    await syncMasteryFromAttempts(user.id);
  }

  const total = isUpload || isEssay ? null : items.length;
  await completeAssignmentProgress({
    assignmentId: assignment.id,
    studentId: user.id,
    score: isUpload || isEssay ? null : score,
    total
  });

  await upsertAssignmentSubmission({
    assignmentId: assignment.id,
    studentId: user.id,
    answers: isUpload ? {} : answers,
    score: isUpload || isEssay ? 0 : score,
    total: isUpload || isEssay ? 0 : items.length,
    submissionText: body.submissionText
  });

  return {
    score: isUpload || isEssay ? 0 : score,
    total: isUpload || isEssay ? 0 : items.length,
    details,
    submissionText: body.submissionText
  };
});
