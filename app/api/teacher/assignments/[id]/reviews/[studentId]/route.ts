import { getCurrentUser, getParentsByStudentId, getUserById } from "@/lib/auth";
import { getAssignmentAIReview } from "@/lib/assignment-ai";
import { getAssignmentUploads } from "@/lib/assignment-uploads";
import { getAssignmentById, getAssignmentItems, getAssignmentSubmission } from "@/lib/assignments";
import { getClassById, getClassStudentIds } from "@/lib/classes";
import { getQuestions } from "@/lib/content";
import { createNotification } from "@/lib/notifications";
import { getReview, saveReview } from "@/lib/reviews";
import { ensureDefaultRubrics, getReviewRubrics, saveReviewRubrics } from "@/lib/rubrics";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const reviewBodySchema = v.object<{
  overallComment?: string;
  items?: Array<{ questionId: string; wrongTag?: string; comment?: string }>;
  rubrics?: Array<{ rubricId: string; score: number; comment?: string }>;
}>(
  {
    overallComment: v.optional(v.string({ allowEmpty: true, trim: true })),
    items: v.optional(
      v.array(
        v.object<{
          questionId: string;
          wrongTag?: string;
          comment?: string;
        }>(
          {
            questionId: v.string({ minLength: 1 }),
            wrongTag: v.optional(v.string({ allowEmpty: true, trim: true })),
            comment: v.optional(v.string({ allowEmpty: true, trim: true }))
          },
          { allowUnknown: false }
        )
      )
    ),
    rubrics: v.optional(
      v.array(
        v.object<{
          rubricId: string;
          score: number;
          comment?: string;
        }>(
          {
            rubricId: v.string({ minLength: 1 }),
            score: v.number({ coerce: true, min: 0 }),
            comment: v.optional(v.string({ allowEmpty: true, trim: true }))
          },
          { allowUnknown: false }
        )
      )
    )
  },
  { allowUnknown: false }
);

async function assertTeacherAccess(assignmentId: string, studentId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    unauthorized();
  }

  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) {
    notFound();
  }

  const klass = await getClassById(assignment.classId);
  if (!klass || klass.teacherId !== user.id) {
    notFound();
  }

  const studentIds = await getClassStudentIds(klass.id);
  if (!studentIds.includes(studentId)) {
    notFound("student not in class");
  }

  return { assignment, klass };
}

export const GET = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ params }) => {
    const assignmentId = params.id;
    const studentId = params.studentId;

    const { assignment, klass } = await assertTeacherAccess(assignmentId, studentId);

    const student = await getUserById(studentId);
    if (!student) {
      notFound("student not found");
    }

    const submission = await getAssignmentSubmission(assignment.id, studentId);
    const uploads = await getAssignmentUploads(assignment.id, studentId);
    const aiReview = await getAssignmentAIReview(assignment.id, studentId);
    const items = await getAssignmentItems(assignment.id);
    const questions = await getQuestions();
    const questionMap = new Map(questions.map((item) => [item.id, item]));

    const details = items
      .map((item) => {
        const question = questionMap.get(item.questionId);
        if (!question) return null;
        const answer = submission?.answers?.[question.id] ?? "";
        const correct = answer === question.answer;
        return {
          id: question.id,
          stem: question.stem,
          options: question.options,
          answer,
          correctAnswer: question.answer,
          explanation: question.explanation,
          correct
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const reviewResult = await getReview(assignment.id, studentId);
    const rubrics = await ensureDefaultRubrics({
      assignmentId: assignment.id,
      submissionType: assignment.submissionType
    });
    const reviewRubrics = reviewResult.review ? await getReviewRubrics(reviewResult.review.id) : [];

    return {
      assignment,
      class: klass,
      student: { id: student.id, name: student.name, email: student.email },
      submission,
      uploads,
      aiReview,
      questions: details,
      review: reviewResult.review,
      reviewItems: reviewResult.items,
      rubrics,
      reviewRubrics
    };
  }
});

export const POST = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ request, params }) => {
    const assignmentId = params.id;
    const studentId = params.studentId;

    const { assignment } = await assertTeacherAccess(assignmentId, studentId);
    const body = await parseJson(request, reviewBodySchema);

    const saved = await saveReview({
      assignmentId,
      studentId,
      overallComment: body.overallComment?.trim(),
      items: body.items ?? []
    });

    if (saved.review && body.rubrics?.length) {
      await saveReviewRubrics({
        reviewId: saved.review.id,
        items: body.rubrics.map((item) => ({
          rubricId: item.rubricId,
          score: item.score,
          comment: item.comment
        }))
      });
    }

    await createNotification({
      userId: studentId,
      title: "作业批改已完成",
      content: `作业「${assignment.title}」已完成批改，请查看老师点评。`,
      type: "review"
    });

    const parents = await getParentsByStudentId(studentId);
    for (const parent of parents) {
      await createNotification({
        userId: parent.id,
        title: "孩子作业批改完成",
        content: `作业「${assignment.title}」已完成批改，可查看老师点评。`,
        type: "review"
      });
    }

    const reviewRubrics = saved.review ? await getReviewRubrics(saved.review.id) : [];
    return { review: saved.review, reviewItems: saved.items, reviewRubrics };
  }
});
