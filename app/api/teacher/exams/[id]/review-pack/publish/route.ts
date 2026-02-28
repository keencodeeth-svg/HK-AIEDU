import { getCurrentUser, getParentsByStudentId } from "@/lib/auth";
import { addAdminLog } from "@/lib/admin-log";
import { getClassById } from "@/lib/classes";
import { getQuestions } from "@/lib/content";
import { getExamEventsByPaper } from "@/lib/exam-events";
import { evaluateExamRisk, type ExamRiskLevel } from "@/lib/exam-risk";
import { buildExamReviewPack, getExamReviewPack, upsertExamReviewPack } from "@/lib/exam-review-pack";
import {
  ensureExamAssignmentsForPaper,
  getExamPaperById,
  getExamPaperItems,
  getExamSubmission,
  getExamSubmissionsByPaper
} from "@/lib/exams";
import { createNotification } from "@/lib/notifications";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, parseParams, v } from "@/lib/api/validation";
import { createExamRoute } from "@/lib/api/domains";

const paramsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

const bodySchema = v.object<{
  studentIds?: string[];
  minRiskLevel?: "high" | "medium" | "low";
  includeParents?: boolean;
  dryRun?: boolean;
}>(
  {
    studentIds: v.optional(v.array(v.string({ minLength: 1 }), { maxLength: 200 })),
    minRiskLevel: v.optional(v.enum(["high", "medium", "low"] as const)),
    includeParents: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean())
  },
  { allowUnknown: false }
);

function levelRank(level: ExamRiskLevel) {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function isRiskIncluded(level: ExamRiskLevel, minRiskLevel: ExamRiskLevel) {
  return levelRank(level) >= levelRank(minRiskLevel);
}

function toDateTimeText(value: string) {
  return new Date(value).toLocaleString("zh-CN");
}

export const POST = createExamRoute({
  cache: "private-realtime",
  handler: async ({ request, params }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const parsed = parseParams(params, paramsSchema);
    const body = await parseJson(request, bodySchema);
    const minRiskLevel = body.minRiskLevel ?? "high";
    const includeParents = body.includeParents !== false;
    const dryRun = body.dryRun === true;

    const paper = await getExamPaperById(parsed.id);
    if (!paper) {
      notFound("not found");
    }
    const klass = await getClassById(paper.classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound("not found");
    }

    const assignments = await ensureExamAssignmentsForPaper(paper.id);
    const assignmentMap = new Map(assignments.map((item) => [item.studentId, item]));
    const submissions = await getExamSubmissionsByPaper(paper.id);
    const submissionMap = new Map(submissions.map((item) => [item.studentId, item]));
    const events = await getExamEventsByPaper(paper.id);
    const eventMap = new Map(events.map((item) => [item.studentId, item]));
    const items = await getExamPaperItems(paper.id);
    if (!items.length) {
      badRequest("考试题目为空");
    }

    const itemQuestionIds = Array.from(new Set(items.map((item) => item.questionId)));
    const questions = await getQuestions();
    const questionMap = new Map(
      questions.filter((item) => itemQuestionIds.includes(item.id)).map((item) => [item.id, item])
    );

    const requestedStudentIds = new Set((body.studentIds ?? []).map((item) => item.trim()).filter(Boolean));
    const candidateStudentIds = Array.from(new Set([...assignmentMap.keys(), ...submissionMap.keys()])).filter(
      (studentId) => (requestedStudentIds.size ? requestedStudentIds.has(studentId) : true)
    );

    let targeted = 0;
    let publishedStudents = 0;
    let publishedParents = 0;
    let skippedNoSubmission = 0;
    let skippedLowRisk = 0;
    let generatedPackCount = 0;
    const published: Array<{
      studentId: string;
      riskScore: number;
      riskLevel: ExamRiskLevel;
      wrongCount: number;
      estimatedMinutes: number;
    }> = [];

    for (const studentId of candidateStudentIds.slice(0, 120)) {
      const assignment = assignmentMap.get(studentId);
      const submission = submissionMap.get(studentId) ?? (await getExamSubmission(paper.id, studentId));
      if (!submission) {
        skippedNoSubmission += 1;
        continue;
      }

      const risk = evaluateExamRisk({
        antiCheatLevel: paper.antiCheatLevel,
        blurCount: eventMap.get(studentId)?.blurCount ?? 0,
        visibilityHiddenCount: eventMap.get(studentId)?.visibilityHiddenCount ?? 0,
        startedAt: assignment?.startedAt,
        submittedAt: assignment?.submittedAt ?? submission.submittedAt,
        durationMinutes: paper.durationMinutes,
        answerCount: Object.values(submission.answers ?? {}).filter((value) => String(value ?? "").trim()).length,
        questionCount: items.length,
        score: submission.score,
        total: submission.total
      });
      targeted += 1;

      if (!isRiskIncluded(risk.riskLevel, minRiskLevel)) {
        skippedLowRisk += 1;
        continue;
      }

      let reviewPack = await getExamReviewPack(paper.id, studentId);
      let reviewPackData = reviewPack?.data ?? null;
      if (!reviewPackData) {
        const wrongDetails: Array<{
          questionId: string;
          answer: string;
          correctAnswer: string;
          score: number;
          correct: boolean;
        }> = [];
        const wrongQuestions: Array<{
          id: string;
          stem: string;
          knowledgePointId: string;
          difficulty?: string;
          questionType?: string;
        }> = [];

        items.forEach((item) => {
          const question = questionMap.get(item.questionId);
          if (!question) return;
          const answer = submission.answers?.[question.id] ?? "";
          const correct = answer === question.answer;
          if (!correct) {
            wrongDetails.push({
              questionId: question.id,
              answer,
              correctAnswer: question.answer,
              score: item.score,
              correct
            });
            wrongQuestions.push({
              id: question.id,
              stem: question.stem,
              knowledgePointId: question.knowledgePointId,
              difficulty: question.difficulty,
              questionType: question.questionType
            });
          }
        });

        const packData = await buildExamReviewPack({
          wrongDetails,
          wrongQuestions
        });
        reviewPack = await upsertExamReviewPack({
          paperId: paper.id,
          studentId,
          data: packData
        });
        reviewPackData = reviewPack?.data ?? packData;
        generatedPackCount += 1;
      }

      if (!reviewPackData) {
        continue;
      }

      const actionText = reviewPackData.actionItems
        .slice(0, 2)
        .map((item, index) => `${index + 1}. ${item.title}（约${item.estimatedMinutes}分钟）`)
        .join("；");
      const title = `考试复盘任务：${paper.title}`;
      const content =
        `老师已发布考试复盘任务，请在今日完成。\n` +
        `风险等级：${risk.riskLevel}（${risk.riskScore}）\n` +
        `建议动作：${risk.recommendedAction}\n` +
        `优先任务：${actionText || "完成错题复盘与24h复练"}\n` +
        `提交时间：${toDateTimeText(submission.submittedAt)}`;

      if (!dryRun) {
        await createNotification({
          userId: studentId,
          title,
          content,
          type: "exam_review_pack"
        });
        publishedStudents += 1;

        if (includeParents) {
          const parents = await getParentsByStudentId(studentId);
          for (const parent of parents.slice(0, 3)) {
            await createNotification({
              userId: parent.id,
              title: `孩子考试复盘提醒：${paper.title}`,
              content: `老师已发布考试复盘任务，请协助孩子按计划完成。风险等级：${risk.riskLevel}（${risk.riskScore}）。`,
              type: "exam_review_pack_parent"
            });
            publishedParents += 1;
          }
        }
      }

      published.push({
        studentId,
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        wrongCount: reviewPackData.wrongCount,
        estimatedMinutes: reviewPackData.summary.estimatedMinutes
      });
    }

    await addAdminLog({
      adminId: user.id,
      action: "teacher_publish_exam_review_pack",
      entityType: "exam",
      entityId: paper.id,
      detail: `targeted=${targeted},publishedStudents=${publishedStudents},publishedParents=${publishedParents},dryRun=${dryRun}`
    });

    return {
      data: {
        paperId: paper.id,
        dryRun,
        minRiskLevel,
        targetedStudents: targeted,
        publishedStudents,
        publishedParents,
        skippedNoSubmission,
        skippedLowRisk,
        generatedPackCount,
        published: published.sort((a, b) => {
          if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
          return a.studentId.localeCompare(b.studentId);
        }),
        message: dryRun
          ? "已完成发布预览（未实际发送通知）"
          : `已发布复盘任务：学生 ${publishedStudents} 人，家长 ${publishedParents} 人`
      }
    };
  }
});
