import crypto from "crypto";
import { getKnowledgePoints } from "./content";
import { isDbEnabled, query, queryOne } from "./db";
import { readJson, writeJson } from "./storage";

export type ExamReviewWrongQuestion = {
  questionId: string;
  stem: string;
  knowledgePointId: string;
  knowledgePointTitle: string;
  difficulty: string;
  questionType: string;
  yourAnswer: string;
  correctAnswer: string;
  score: number;
};

export type ExamReviewActionItem = {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  knowledgePointIds: string[];
};

export type ExamReviewPlanItem = {
  day: number;
  title: string;
  focus: string;
  estimatedMinutes: number;
};

export type ExamReviewPackData = {
  wrongCount: number;
  generatedAt: string;
  summary: {
    topWeakKnowledgePoints: Array<{
      knowledgePointId: string;
      title: string;
      wrongCount: number;
    }>;
    wrongByDifficulty: Array<{ difficulty: string; count: number }>;
    wrongByType: Array<{ questionType: string; count: number }>;
    estimatedMinutes: number;
  };
  rootCauses: string[];
  actionItems: ExamReviewActionItem[];
  sevenDayPlan: ExamReviewPlanItem[];
  wrongQuestions: ExamReviewWrongQuestion[];
};

export type ExamReviewPack = {
  id: string;
  paperId: string;
  studentId: string;
  data: ExamReviewPackData;
  generatedAt: string;
};

type DbExamReviewPack = {
  id: string;
  paper_id: string;
  student_id: string;
  data: unknown;
  generated_at: string;
};

const EXAM_REVIEW_PACK_FILE = "exam-review-packages.json";

function parsePackData(raw: unknown): ExamReviewPackData | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return parsePackData(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as ExamReviewPackData;
}

function mapDbPack(row: DbExamReviewPack): ExamReviewPack {
  return {
    id: row.id,
    paperId: row.paper_id,
    studentId: row.student_id,
    data: parsePackData(row.data) ?? {
      wrongCount: 0,
      generatedAt: row.generated_at,
      summary: {
        topWeakKnowledgePoints: [],
        wrongByDifficulty: [],
        wrongByType: [],
        estimatedMinutes: 0
      },
      rootCauses: [],
      actionItems: [],
      sevenDayPlan: [],
      wrongQuestions: []
    },
    generatedAt: row.generated_at
  };
}

function buildRootCauses(input: { wrongQuestions: ExamReviewWrongQuestion[]; wrongCount: number }) {
  // Rule-based cause detection keeps output stable and explainable for parents/teachers.
  const causes: string[] = [];
  const unansweredCount = input.wrongQuestions.filter((item) => !item.yourAnswer?.trim()).length;
  const hardCount = input.wrongQuestions.filter((item) => item.difficulty === "hard").length;
  const kpCount = new Set(input.wrongQuestions.map((item) => item.knowledgePointId)).size;

  if (unansweredCount / Math.max(1, input.wrongCount) >= 0.3) {
    causes.push("存在未作答题目，需优先优化审题和时间分配策略。");
  }
  if (hardCount / Math.max(1, input.wrongCount) >= 0.4) {
    causes.push("高难题失分偏高，建议先巩固中档题再冲刺难题。");
  }
  if (kpCount <= 2 && input.wrongCount >= 3) {
    causes.push("错题集中在少量知识点，适合做专项集中修复。");
  }
  if (causes.length === 0) {
    causes.push("错题较分散，建议按错因类型逐题复盘并做变式训练。");
  }
  return causes.slice(0, 3);
}

export async function buildExamReviewPack(input: {
  wrongDetails: Array<{
    questionId: string;
    answer: string;
    correctAnswer: string;
    score: number;
    correct: boolean;
  }>;
  wrongQuestions: Array<{
    id: string;
    stem: string;
    knowledgePointId: string;
    difficulty?: string;
    questionType?: string;
  }>;
}) {
  const generatedAt = new Date().toISOString();
  const knowledgePoints = await getKnowledgePoints();
  const kpMap = new Map(knowledgePoints.map((item) => [item.id, item]));
  const questionMap = new Map(input.wrongQuestions.map((item) => [item.id, item]));

  const wrongQuestions: ExamReviewWrongQuestion[] = input.wrongDetails
    .filter((item) => !item.correct)
    .map((item) => {
      const question = questionMap.get(item.questionId);
      const kp = question ? kpMap.get(question.knowledgePointId) : null;
      return {
        questionId: item.questionId,
        stem: question?.stem ?? "题目",
        knowledgePointId: question?.knowledgePointId ?? "unknown",
        knowledgePointTitle: kp?.title ?? question?.knowledgePointId ?? "未知知识点",
        difficulty: question?.difficulty ?? "medium",
        questionType: question?.questionType ?? "choice",
        yourAnswer: item.answer ?? "",
        correctAnswer: item.correctAnswer,
        score: item.score
      };
    });

  const wrongCount = wrongQuestions.length;
  const kpStats = new Map<string, { title: string; wrongCount: number }>();
  const difficultyStats = new Map<string, number>();
  const typeStats = new Map<string, number>();

  wrongQuestions.forEach((item) => {
    const current = kpStats.get(item.knowledgePointId) ?? {
      title: item.knowledgePointTitle,
      wrongCount: 0
    };
    current.wrongCount += 1;
    kpStats.set(item.knowledgePointId, current);

    difficultyStats.set(item.difficulty, (difficultyStats.get(item.difficulty) ?? 0) + 1);
    typeStats.set(item.questionType, (typeStats.get(item.questionType) ?? 0) + 1);
  });

  const topWeakKnowledgePoints = Array.from(kpStats.entries())
    .map(([knowledgePointId, stat]) => ({
      knowledgePointId,
      title: stat.title,
      wrongCount: stat.wrongCount
    }))
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, 3);

  const wrongByDifficulty = Array.from(difficultyStats.entries())
    .map(([difficulty, count]) => ({ difficulty, count }))
    .sort((a, b) => b.count - a.count);

  const wrongByType = Array.from(typeStats.entries())
    .map(([questionType, count]) => ({ questionType, count }))
    .sort((a, b) => b.count - a.count);

  const estimatedMinutes = Math.max(15, Math.min(60, wrongCount * 8));
  const rootCauses = buildRootCauses({ wrongQuestions, wrongCount });

  const actionItems: ExamReviewActionItem[] = [
    {
      id: "review-pack-action-kp",
      title: "薄弱点专项修复",
      description:
        topWeakKnowledgePoints.length > 0
          ? `优先复练 ${topWeakKnowledgePoints[0].title}，连续完成 5 题并记录错因。`
          : "先完成错题回顾，定位核心薄弱点后再专项补练。",
      estimatedMinutes: 20,
      knowledgePointIds: topWeakKnowledgePoints.map((item) => item.knowledgePointId)
    },
    {
      id: "review-pack-action-wrongbook",
      title: "24h 错题复练",
      description: "将本次错题纳入今日复练清单，优先完成 24 小时内的复练题。",
      estimatedMinutes: 12,
      knowledgePointIds: topWeakKnowledgePoints.map((item) => item.knowledgePointId)
    },
    {
      id: "review-pack-action-variant",
      title: "变式巩固训练",
      description: "针对同知识点补做 2 题变式题，确认是否真正掌握。",
      estimatedMinutes: 15,
      knowledgePointIds: topWeakKnowledgePoints.map((item) => item.knowledgePointId)
    }
  ];

  const sevenDayPlan: ExamReviewPlanItem[] = [
    // Fixed cadence aligned with 24h/72h/7d review rhythm in wrong-question loop.
    { day: 1, title: "D1 错因复盘", focus: "逐题复盘本次错题并整理错因", estimatedMinutes: 20 },
    {
      day: 2,
      title: "D2 24h 复练",
      focus: topWeakKnowledgePoints[0]?.title
        ? `完成 ${topWeakKnowledgePoints[0].title} 相关复练`
        : "完成当天错题复练",
      estimatedMinutes: 15
    },
    {
      day: 3,
      title: "D3 变式训练",
      focus: "围绕同知识点补做变式题，检查迁移能力",
      estimatedMinutes: 15
    },
    { day: 4, title: "D4 查漏补缺", focus: "复看仍不稳定的题型，重做 3 题", estimatedMinutes: 15 },
    { day: 5, title: "D5 72h 复练", focus: "完成 72h 阶段复练，关注正确率", estimatedMinutes: 15 },
    { day: 6, title: "D6 小测验", focus: "做一组 5 题小测检验修复效果", estimatedMinutes: 15 },
    { day: 7, title: "D7 总结", focus: "对本周错题与提分点做总结", estimatedMinutes: 10 }
  ];

  return {
    wrongCount,
    generatedAt,
    summary: {
      topWeakKnowledgePoints,
      wrongByDifficulty,
      wrongByType,
      estimatedMinutes
    },
    rootCauses,
    actionItems,
    sevenDayPlan,
    wrongQuestions
  } satisfies ExamReviewPackData;
}

export async function getExamReviewPack(paperId: string, studentId: string) {
  if (!isDbEnabled()) {
    const list = readJson<ExamReviewPack[]>(EXAM_REVIEW_PACK_FILE, []);
    return list.find((item) => item.paperId === paperId && item.studentId === studentId) ?? null;
  }

  const row = await queryOne<DbExamReviewPack>(
    "SELECT * FROM exam_review_packages WHERE paper_id = $1 AND student_id = $2",
    [paperId, studentId]
  );
  return row ? mapDbPack(row) : null;
}

export async function upsertExamReviewPack(input: {
  paperId: string;
  studentId: string;
  data: ExamReviewPackData;
}) {
  const generatedAt = input.data.generatedAt || new Date().toISOString();

  if (!isDbEnabled()) {
    const list = readJson<ExamReviewPack[]>(EXAM_REVIEW_PACK_FILE, []);
    const index = list.findIndex(
      (item) => item.paperId === input.paperId && item.studentId === input.studentId
    );

    const next: ExamReviewPack = {
      id: index >= 0 ? list[index].id : `exam-review-pack-${crypto.randomBytes(6).toString("hex")}`,
      paperId: input.paperId,
      studentId: input.studentId,
      data: input.data,
      generatedAt
    };

    if (index >= 0) {
      list[index] = next;
    } else {
      list.push(next);
    }
    writeJson(EXAM_REVIEW_PACK_FILE, list);
    return next;
  }

  const existing = await queryOne<DbExamReviewPack>(
    "SELECT * FROM exam_review_packages WHERE paper_id = $1 AND student_id = $2",
    [input.paperId, input.studentId]
  );

  const row = await queryOne<DbExamReviewPack>(
    `INSERT INTO exam_review_packages (id, paper_id, student_id, data, generated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (paper_id, student_id) DO UPDATE SET
       data = EXCLUDED.data,
       generated_at = EXCLUDED.generated_at
     RETURNING *`,
    [
      existing?.id ?? `exam-review-pack-${crypto.randomBytes(6).toString("hex")}`,
      input.paperId,
      input.studentId,
      JSON.stringify(input.data),
      generatedAt
    ]
  );

  return row ? mapDbPack(row) : null;
}
