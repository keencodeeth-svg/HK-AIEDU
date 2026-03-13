import crypto from "crypto";
import { buildStudyVariantProgressMessage, buildStudyVariantQuestionId, STUDY_VARIANT_ATTEMPT_REASON } from "@/lib/ai-study-progress";
import { getKnowledgePoints } from "@/lib/content";
import { getMasteryRecord, getWeaknessRankMap, updateMasteryByAttempt } from "@/lib/mastery";
import { enrichPlanWithMastery } from "@/lib/plan-enrichment";
import { addAttempt, refreshStudyPlan } from "@/lib/progress";
import { retrieveKnowledgePoints, retrieveSimilarQuestion } from "@/lib/rag";
import { unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createAiRoute } from "@/lib/api/domains";

const studyVariantProgressBodySchema = v.object<{
  question: string;
  subject?: string;
  grade?: string;
  knowledgePointId?: string;
  knowledgePointTitle?: string;
  variant: {
    stem: string;
    answer: string;
    explanation: string;
    studentAnswer: string;
  };
}>(
  {
    question: v.string({ minLength: 1 }),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    knowledgePointId: v.optional(v.string({ minLength: 1 })),
    knowledgePointTitle: v.optional(v.string({ minLength: 1 })),
    variant: v.object(
      {
        stem: v.string({ minLength: 1 }),
        answer: v.string({ minLength: 1 }),
        explanation: v.string({ minLength: 1 }),
        studentAnswer: v.string({ minLength: 1 })
      },
      { allowUnknown: false }
    )
  },
  { allowUnknown: false }
);

export const POST = createAiRoute({
  role: ["student", "teacher", "parent", "admin", "school_admin"],
  body: studyVariantProgressBodySchema,
  cache: "private-realtime",
  handler: async ({ body, user }) => {
    if (!user) {
      unauthorized();
    }

    const subject = body.subject?.trim();
    const grade = body.grade?.trim();
    const question = body.question.trim();
    const studentAnswer = body.variant.studentAnswer.trim();
    let knowledgePointId = body.knowledgePointId?.trim() || "";
    let knowledgePointTitle = body.knowledgePointTitle?.trim() || "";

    if (!knowledgePointId && knowledgePointTitle && subject) {
      try {
        const knowledgePoints = await getKnowledgePoints();
        const matched = knowledgePoints.find(
          (item) =>
            item.subject === subject &&
            (!grade || item.grade === grade) &&
            item.title.trim() === knowledgePointTitle
        );
        knowledgePointId = matched?.id?.trim() ?? "";
      } catch {
        // Best effort only. Retrieval fallback below can still try to recover.
      }
    }

    if ((!knowledgePointId || !knowledgePointTitle) && subject) {
      try {
        const matchedKnowledgePoints = await retrieveKnowledgePoints(question, subject, grade);
        if (!knowledgePointId) {
          knowledgePointId = matchedKnowledgePoints[0]?.id?.trim() ?? "";
        }
        if (!knowledgePointTitle) {
          knowledgePointTitle = matchedKnowledgePoints[0]?.title?.trim() ?? "";
        }
      } catch {
        // Best effort only. Tutor can continue even when retrieval is unavailable.
      }
    }

    if ((!knowledgePointId || !knowledgePointTitle) && subject) {
      try {
        const similarQuestion = await retrieveSimilarQuestion(question, subject, grade);
        if (similarQuestion?.knowledgePointId) {
          knowledgePointId = knowledgePointId || similarQuestion.knowledgePointId;
          if (!knowledgePointTitle) {
            const knowledgePoints = await getKnowledgePoints();
            knowledgePointTitle =
              knowledgePoints.find((item) => item.id === similarQuestion.knowledgePointId)?.title?.trim() ?? "";
          }
        }
      } catch {
        // Similar-question fallback is best effort only.
      }
    }

    if (user.role !== "student") {
      return {
        data: {
          persisted: false,
          message: "当前角色可体验学习模式，但不会计入学生成长画像。",
          syncedAttemptCount: 0,
          knowledgePointId: knowledgePointId || undefined,
          knowledgePointTitle: knowledgePointTitle || undefined,
          mastery: null,
          plan: null
        }
      };
    }

    if (!subject || !knowledgePointId) {
      return {
        data: {
          persisted: false,
          message: "当前变式练习暂时还没能稳定映射到知识点，因此未计入成长画像。",
          syncedAttemptCount: 0,
          knowledgePointId: knowledgePointId || undefined,
          knowledgePointTitle: knowledgePointTitle || undefined,
          mastery: null,
          plan: null
        }
      };
    }

    const previousMastery = await getMasteryRecord(user.id, knowledgePointId, subject);
    const previousScore = previousMastery?.masteryScore ?? 0;
    const correct = studentAnswer === body.variant.answer.trim();

    await addAttempt(
      {
        id: crypto.randomBytes(10).toString("hex"),
        userId: user.id,
        questionId: buildStudyVariantQuestionId({
          subject,
          grade,
          knowledgePointId,
          stem: body.variant.stem
        }),
        subject,
        knowledgePointId,
        correct,
        answer: studentAnswer,
        reason: STUDY_VARIANT_ATTEMPT_REASON,
        createdAt: new Date().toISOString()
      },
      { skipReviewScheduling: true }
    );

    const masteryUpdate = await updateMasteryByAttempt({
      userId: user.id,
      knowledgePointId,
      subject
    });
    const masteryRecords = masteryUpdate.records;
    const mastery = masteryUpdate.record;
    const weaknessRankMap = getWeaknessRankMap(masteryRecords, subject);
    const weaknessRank = weaknessRankMap.get(knowledgePointId) ?? null;
    const masteryScore = mastery?.masteryScore ?? previousScore;
    const masteryDelta = masteryScore - previousScore;

    let planItem = null;
    try {
      const plan = await refreshStudyPlan(user.id, subject);
      const enrichedPlan = enrichPlanWithMastery(plan, new Map(masteryRecords.map((item) => [item.knowledgePointId, item])), weaknessRankMap);
      planItem = enrichedPlan.items.find((item) => item.knowledgePointId === knowledgePointId) ?? null;
    } catch {
      planItem = null;
    }

    return {
      data: {
        persisted: true,
        message: buildStudyVariantProgressMessage({
          persisted: true,
          knowledgePointTitle,
          masteryScore,
          masteryDelta
        }),
        syncedAttemptCount: 1,
        knowledgePointId,
        knowledgePointTitle: knowledgePointTitle || undefined,
        mastery: mastery
          ? {
              knowledgePointId,
              subject,
              masteryScore,
              masteryDelta,
              weaknessRank,
              masteryLevel: mastery.masteryLevel,
              confidenceScore: mastery.confidenceScore,
              recencyWeight: mastery.recencyWeight,
              masteryTrend7d: mastery.masteryTrend7d,
              correct: mastery.correct,
              total: mastery.total,
              lastAttemptAt: mastery.lastAttemptAt
            }
          : null,
        plan: planItem
          ? {
              subject,
              knowledgePointId,
              targetCount: planItem.targetCount,
              dueDate: planItem.dueDate,
              masteryScore: planItem.masteryScore,
              masteryLevel: planItem.masteryLevel,
              confidenceScore: planItem.confidenceScore,
              weaknessRank: planItem.weaknessRank,
              recommendedReason: planItem.recommendedReason
            }
          : null
      }
    };
  }
});
