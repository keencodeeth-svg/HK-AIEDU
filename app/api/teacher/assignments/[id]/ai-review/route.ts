import { getCurrentUser } from "@/lib/auth";
import { getClassById, getClassStudentIds } from "@/lib/classes";
import { getAssignmentById, getAssignmentSubmission } from "@/lib/assignments";
import { getAssignmentUploads } from "@/lib/assignment-uploads";
import { generateHomeworkReview } from "@/lib/ai";
import { assessAiQuality } from "@/lib/ai-quality-control";
import { upsertAssignmentAIReview } from "@/lib/assignment-ai";
import { badRequest, notFound, unauthorized, withApi } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

const assignmentAiReviewBodySchema = v.object<{ studentId: string }>(
  {
    studentId: v.string({ minLength: 1 })
  },
  { allowUnknown: false }
);

export const POST = withApi(async (request, context) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    unauthorized();
  }

  const body = await parseJson(request, assignmentAiReviewBodySchema);

  const assignment = await getAssignmentById(context.params.id);
  if (!assignment) {
    notFound("not found");
  }

  const klass = await getClassById(assignment.classId);
  if (!klass || klass.teacherId !== user.id) {
    notFound("not found");
  }
  const studentIds = await getClassStudentIds(klass.id);
  if (!studentIds.includes(body.studentId)) {
    notFound("student not in class");
  }

  const uploads = await getAssignmentUploads(assignment.id, body.studentId);
  const submission = await getAssignmentSubmission(assignment.id, body.studentId);
  const hasUploads = uploads.length > 0;
  const submissionText = submission?.submissionText?.trim();

  if (assignment.submissionType === "quiz") {
    badRequest("该作业为在线题目，不支持 AI 批改");
  }
  if (assignment.submissionType === "upload" && !hasUploads) {
    badRequest("学生未上传作业");
  }
  if (assignment.submissionType === "essay" && !hasUploads && !submissionText) {
    badRequest("学生未提交作文内容或附件");
  }

  const review = await generateHomeworkReview({
    subject: klass.subject,
    grade: klass.grade,
    assignmentTitle: assignment.title,
    assignmentDescription: assignment.description,
    focus: assignment.gradingFocus,
    submissionType: assignment.submissionType,
    submissionText,
    images: uploads.map((item) => ({
      mimeType: item.mimeType,
      base64: item.contentBase64,
      fileName: item.fileName
    }))
  });

  const quality = assessAiQuality({
    kind: "assignment_review",
    provider: review.provider,
    textBlocks: [
      review.summary,
      ...(review.strengths ?? []),
      ...(review.issues ?? []),
      ...(review.suggestions ?? []),
      review.writing?.summary ?? ""
    ],
    listCountHint:
      (review.rubric?.length ?? 0) +
      (review.strengths?.length ?? 0) +
      (review.suggestions?.length ?? 0)
  });

  const result = {
    ...review,
    quality,
    manualReviewRule: quality.needsHumanReview ? "建议教师先人工复核关键评分项再下发。" : ""
  };

  const saved = await upsertAssignmentAIReview({
    assignmentId: assignment.id,
    studentId: body.studentId,
    result,
    provider: review.provider
  });

  return {
    data: saved,
    quality
  };
});
