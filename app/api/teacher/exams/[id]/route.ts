import { getCurrentUser } from "@/lib/auth";
import { getClassById, getClassStudents } from "@/lib/classes";
import { getQuestions } from "@/lib/content";
import { evaluateExamRisk } from "@/lib/exam-risk";
import {
  ensureExamAssignmentsForPaper,
  getExamPaperById,
  getExamPaperItems,
  getExamSubmissionsByPaper,
  updateExamPaperStatus
} from "@/lib/exams";
import { getExamEventsByPaper } from "@/lib/exam-events";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createExamRoute } from "@/lib/api/domains";

const updateStatusBodySchema = v.object<{ action: "close" | "reopen" }>(
  {
    action: v.enum(["close", "reopen"] as const)
  },
  { allowUnknown: false }
);

export const GET = createExamRoute({
  cache: "private-short",
  handler: async ({ params }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const paperId = params.id;
    const paper = await getExamPaperById(paperId);
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
    const eventAggregates = await getExamEventsByPaper(paper.id);
    const eventMap = new Map(eventAggregates.map((item) => [item.studentId, item]));
    const items = await getExamPaperItems(paper.id);
    const students = await getClassStudents(paper.classId);
    const studentMap = new Map(students.map((student) => [student.id, student]));
    const targetStudentIds =
      paper.publishMode === "targeted"
        ? Array.from(
            new Set([...assignmentMap.keys(), ...submissionMap.keys(), ...eventMap.keys()]).values()
          )
        : students.map((student) => student.id);
    // Targeted mode roster is derived from observed records to remain backward-compatible.

    const roster = targetStudentIds
      .map((studentId) => {
        const student = studentMap.get(studentId);
        if (!student) return null;
        const assignment = assignmentMap.get(student.id);
        const submission = submissionMap.get(student.id);
        const examEvent = eventMap.get(student.id);
        const risk = evaluateExamRisk({
          antiCheatLevel: paper.antiCheatLevel,
          blurCount: examEvent?.blurCount ?? 0,
          visibilityHiddenCount: examEvent?.visibilityHiddenCount ?? 0,
          startedAt: assignment?.startedAt,
          submittedAt: assignment?.submittedAt ?? submission?.submittedAt,
          durationMinutes: paper.durationMinutes,
          answerCount: Object.values(submission?.answers ?? {}).filter((value) => String(value ?? "").trim()).length,
          questionCount: items.length,
          score: assignment?.score ?? submission?.score,
          total: assignment?.total ?? submission?.total
        });
        return {
          ...student,
          status: assignment?.status ?? (submission ? "submitted" : "pending"),
          score: assignment?.score ?? submission?.score ?? null,
          total: assignment?.total ?? submission?.total ?? null,
          assignedAt: assignment?.assignedAt ?? null,
          startedAt: assignment?.startedAt ?? null,
          submittedAt: assignment?.submittedAt ?? submission?.submittedAt ?? null,
          blurCount: examEvent?.blurCount ?? 0,
          visibilityHiddenCount: examEvent?.visibilityHiddenCount ?? 0,
          lastExamEventAt: examEvent?.lastEventAt ?? null,
          riskScore: risk.riskScore,
          riskLevel: risk.riskLevel,
          riskReasons: risk.riskReasons,
          recommendedAction: risk.recommendedAction
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const questionMap = new Map((await getQuestions()).map((item) => [item.id, item]));
    const questions = items
      .map((item) => {
        const question = questionMap.get(item.questionId);
        if (!question) return null;
        return {
          id: question.id,
          stem: question.stem,
          options: question.options,
          answer: question.answer,
          explanation: question.explanation,
          score: item.score,
          orderIndex: item.orderIndex
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const completed = roster.filter((item) => item.status === "submitted").length;
    const scored = roster.filter(
      (item) => typeof item.score === "number" && typeof item.total === "number" && (item.total ?? 0) > 0
    );
    const avgScore = scored.length
      ? Math.round(
          scored.reduce((sum, item) => sum + ((item.score ?? 0) / (item.total ?? 1)) * 100, 0) / scored.length
        )
      : 0;

    return {
      exam: paper,
      class: {
        id: klass.id,
        name: klass.name,
        subject: klass.subject,
        grade: klass.grade
      },
      summary: {
        assigned: roster.length,
        submitted: completed,
        pending: roster.length - completed,
        avgScore,
        totalBlurCount: roster.reduce((sum, item) => sum + (item.blurCount ?? 0), 0),
        totalVisibilityHiddenCount: roster.reduce((sum, item) => sum + (item.visibilityHiddenCount ?? 0), 0),
        highRiskCount: roster.filter((item) => item.riskLevel === "high").length,
        mediumRiskCount: roster.filter((item) => item.riskLevel === "medium").length
      },
      questions,
      students: roster
    };
  }
});

export const PATCH = createExamRoute({
  cache: "private-realtime",
  handler: async ({ request, params }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const paperId = params.id;
    const paper = await getExamPaperById(paperId);
    if (!paper) {
      notFound("not found");
    }

    const klass = await getClassById(paper.classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound("not found");
    }

    const body = await parseJson(request, updateStatusBodySchema);
    // Only state mutation allowed here is close/reopen; question roster remains immutable.
    const nextStatus = body.action === "close" ? "closed" : "published";
    if (paper.status === nextStatus) {
      badRequest(nextStatus === "closed" ? "考试已关闭" : "考试已开放");
    }

    const updated = await updateExamPaperStatus({
      paperId: paper.id,
      status: nextStatus
    });
    if (!updated) {
      notFound("not found");
    }

    return {
      data: updated,
      message: nextStatus === "closed" ? "考试已关闭" : "考试已重新开放"
    };
  }
});
