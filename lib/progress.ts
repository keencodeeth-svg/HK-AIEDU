import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { getKnowledgePoints, getQuestions } from "./content";
import type { Question } from "./types";
import { assertDatabaseEnabled, isDbEnabled, query, queryOne } from "./db";
import { updateMemorySchedule } from "./memory";
import { getReviewItemsByStudent } from "./reviews";
import { getFocusSessionsByUser } from "./focus";
import { getFavoritesByUser } from "./favorites";
import { enqueueWrongReview } from "./wrong-review";

export type QuestionAttempt = {
  id: string;
  userId: string;
  questionId: string;
  subject: string;
  knowledgePointId: string;
  correct: boolean;
  answer: string;
  reason?: string;
  createdAt: string;
};

export type StudyPlanItem = {
  knowledgePointId: string;
  targetCount: number;
  dueDate: string;
};

export type StudyPlan = {
  id?: string;
  userId: string;
  subject: string;
  createdAt: string;
  items: StudyPlanItem[];
};

const ATTEMPTS_FILE = "question-attempts.json";
const PLANS_FILE = "study-plans.json";
const DAY_MS = 24 * 60 * 60 * 1000;

type DbAttempt = {
  id: string;
  user_id: string;
  question_id: string;
  subject: string;
  knowledge_point_id: string;
  correct: boolean;
  answer: string;
  reason: string | null;
  created_at: string;
};

type DbPlan = {
  id: string;
  user_id: string;
  subject: string;
  created_at: string;
};

type DbPlanItem = {
  id: string;
  plan_id: string;
  knowledge_point_id: string;
  target_count: number;
  due_date: string;
};

type KnowledgePointTrend = {
  trend7d: number;
  recentTotal: number;
  previousTotal: number;
};

function buildKnowledgePointTrend(attempts: QuestionAttempt[]) {
  const now = Date.now();
  const recentStart = now - 7 * DAY_MS;
  const previousStart = now - 14 * DAY_MS;
  const trendMap = new Map<string, KnowledgePointTrend>();

  const bucket = new Map<
    string,
    { recentCorrect: number; recentTotal: number; previousCorrect: number; previousTotal: number }
  >();
  attempts.forEach((attempt) => {
    const ts = new Date(attempt.createdAt).getTime();
    const current = bucket.get(attempt.knowledgePointId) ?? {
      recentCorrect: 0,
      recentTotal: 0,
      previousCorrect: 0,
      previousTotal: 0
    };
    if (ts >= recentStart) {
      current.recentTotal += 1;
      current.recentCorrect += attempt.correct ? 1 : 0;
    } else if (ts >= previousStart) {
      current.previousTotal += 1;
      current.previousCorrect += attempt.correct ? 1 : 0;
    }
    bucket.set(attempt.knowledgePointId, current);
  });

  bucket.forEach((entry, knowledgePointId) => {
    const recentRatio = entry.recentTotal ? entry.recentCorrect / entry.recentTotal : 0;
    const previousRatio = entry.previousTotal ? entry.previousCorrect / entry.previousTotal : recentRatio;
    trendMap.set(knowledgePointId, {
      trend7d: Math.round((recentRatio - previousRatio) * 100),
      recentTotal: entry.recentTotal,
      previousTotal: entry.previousTotal
    });
  });

  return trendMap;
}

function resolvePlanTargetCount(params: { ratio: number; total: number; trend7d: number }) {
  const { ratio, total, trend7d } = params;
  let target = 5;
  if (ratio < 0.55) {
    target = 7;
  } else if (ratio < 0.7) {
    target = 6;
  } else if (ratio >= 0.85 && total >= 4) {
    target = 3;
  }

  if (total < 3) {
    target += 1;
  }
  if (trend7d < -8) {
    target += 1;
  } else if (trend7d > 8) {
    target = Math.max(3, target - 1);
  }
  return Math.max(3, Math.min(8, target));
}

function mapAttempt(row: DbAttempt): QuestionAttempt {
  return {
    id: row.id,
    userId: row.user_id,
    questionId: row.question_id,
    subject: row.subject,
    knowledgePointId: row.knowledge_point_id,
    correct: row.correct,
    answer: row.answer,
    reason: row.reason ?? undefined,
    createdAt: row.created_at
  };
}

export async function getAttempts(): Promise<QuestionAttempt[]> {
  if (!isDbEnabled()) {
    assertDatabaseEnabled("question_attempts");
    return readJson<QuestionAttempt[]>(ATTEMPTS_FILE, []);
  }
  const rows = await query<DbAttempt>("SELECT * FROM question_attempts");
  return rows.map(mapAttempt);
}

export async function saveAttempts(list: QuestionAttempt[]) {
  if (!isDbEnabled()) {
    assertDatabaseEnabled("question_attempts");
    writeJson(ATTEMPTS_FILE, list);
  }
}

export async function addAttempt(attempt: QuestionAttempt) {
  if (!isDbEnabled()) {
    assertDatabaseEnabled("question_attempts");
    const list = await getAttempts();
    list.push(attempt);
    await saveAttempts(list);
    await updateMemorySchedule({
      userId: attempt.userId,
      questionId: attempt.questionId,
      correct: attempt.correct
    });
    if (!attempt.correct) {
      await enqueueWrongReview({
        userId: attempt.userId,
        questionId: attempt.questionId,
        subject: attempt.subject,
        knowledgePointId: attempt.knowledgePointId
      });
    }
    return;
  }
  await query(
    `INSERT INTO question_attempts
     (id, user_id, question_id, subject, knowledge_point_id, correct, answer, reason, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      attempt.id,
      attempt.userId,
      attempt.questionId,
      attempt.subject,
      attempt.knowledgePointId,
      attempt.correct,
      attempt.answer,
      attempt.reason ?? null,
      attempt.createdAt
    ]
  );
  await updateMemorySchedule({
    userId: attempt.userId,
    questionId: attempt.questionId,
    correct: attempt.correct
  });
  if (!attempt.correct) {
    await enqueueWrongReview({
      userId: attempt.userId,
      questionId: attempt.questionId,
      subject: attempt.subject,
      knowledgePointId: attempt.knowledgePointId
    });
  }
}

export async function getAttemptsByUser(userId: string) {
  if (!isDbEnabled()) {
    assertDatabaseEnabled("question_attempts");
    return (await getAttempts()).filter((item) => item.userId === userId);
  }
  const rows = await query<DbAttempt>("SELECT * FROM question_attempts WHERE user_id = $1", [userId]);
  return rows.map(mapAttempt);
}

export async function getAttemptsByKnowledgePoint(userId: string, knowledgePointId: string, subject?: string) {
  if (!isDbEnabled()) {
    assertDatabaseEnabled("question_attempts");
    const attempts = await getAttemptsByUser(userId);
    return attempts.filter(
      (item) =>
        item.knowledgePointId === knowledgePointId &&
        (!subject || item.subject === subject)
    );
  }

  const rows = subject
    ? await query<DbAttempt>(
        "SELECT * FROM question_attempts WHERE user_id = $1 AND knowledge_point_id = $2 AND subject = $3",
        [userId, knowledgePointId, subject]
      )
    : await query<DbAttempt>(
        "SELECT * FROM question_attempts WHERE user_id = $1 AND knowledge_point_id = $2",
        [userId, knowledgePointId]
      );
  return rows.map(mapAttempt);
}

export async function getAttemptsByUsers(userIds: string[]) {
  if (!userIds.length) return [];
  if (!isDbEnabled()) {
    assertDatabaseEnabled("question_attempts");
    const attempts = await getAttempts();
    const set = new Set(userIds);
    return attempts.filter((item) => set.has(item.userId));
  }
  const rows = await query<DbAttempt>("SELECT * FROM question_attempts WHERE user_id = ANY($1)", [userIds]);
  return rows.map(mapAttempt);
}

export async function getLastAttemptByQuestion(userId: string) {
  const attempts = await getAttemptsByUser(userId);
  const map = new Map<string, QuestionAttempt>();
  attempts.forEach((attempt) => {
    const prev = map.get(attempt.questionId);
    if (!prev || new Date(attempt.createdAt).getTime() > new Date(prev.createdAt).getTime()) {
      map.set(attempt.questionId, attempt);
    }
  });
  return map;
}

export async function getWrongQuestionIds(userId: string) {
  const lastAttempts = await getLastAttemptByQuestion(userId);
  return Array.from(lastAttempts.values())
    .filter((attempt) => !attempt.correct)
    .map((attempt) => attempt.questionId);
}

export async function getMasteryByKnowledgePoint(userId: string, subject?: string) {
  const attempts = (await getAttemptsByUser(userId)).filter((attempt) =>
    subject ? attempt.subject === subject : true
  );
  const totals = new Map<string, { correct: number; total: number }>();
  attempts.forEach((attempt) => {
    const current = totals.get(attempt.knowledgePointId) ?? { correct: 0, total: 0 };
    current.total += 1;
    current.correct += attempt.correct ? 1 : 0;
    totals.set(attempt.knowledgePointId, current);
  });
  return totals;
}

type StudyPlanBuildMode = "generate" | "refresh";

function comparePlanCandidate(
  mode: StudyPlanBuildMode,
  a: { ratio: number; trend7d: number; total: number },
  b: { ratio: number; trend7d: number; total: number }
) {
  if (a.ratio === b.ratio) {
    if (a.trend7d === b.trend7d) {
      return mode === "refresh" ? a.total - b.total : 0;
    }
    return a.trend7d - b.trend7d;
  }
  return a.ratio - b.ratio;
}

async function buildStudyPlanDraft(userId: string, subject: string, mode: StudyPlanBuildMode) {
  const knowledgePoints = (await getKnowledgePoints()).filter((kp) => kp.subject === subject);
  const mastery = await getMasteryByKnowledgePoint(userId, subject);
  const trendMap = buildKnowledgePointTrend(
    (await getAttemptsByUser(userId)).filter((attempt) => attempt.subject === subject)
  );
  const ranked = knowledgePoints
    .map((kp) => {
      const stat = mastery.get(kp.id) ?? { correct: 0, total: 0 };
      const ratio = stat.total === 0 ? 0 : stat.correct / stat.total;
      const trend = trendMap.get(kp.id);
      return { kp, ratio, total: stat.total, trend7d: trend?.trend7d ?? 0 };
    })
    .sort((a, b) => comparePlanCandidate(mode, a, b))
    .slice(0, 5);

  const items: StudyPlanItem[] = ranked.map((item, index) => ({
    knowledgePointId: item.kp.id,
    targetCount: resolvePlanTargetCount({
      ratio: item.ratio,
      total: item.total,
      trend7d: item.trend7d
    }),
    dueDate: new Date(Date.now() + index * 24 * 60 * 60 * 1000).toISOString()
  }));

  const plan: StudyPlan = {
    userId,
    subject,
    createdAt: new Date().toISOString(),
    items
  };
  return plan;
}

async function saveStudyPlan(plan: StudyPlan) {
  const { userId, subject, items, createdAt } = plan;
  if (!isDbEnabled()) {
    assertDatabaseEnabled("study_plans");
    const plans = readJson<StudyPlan[]>(PLANS_FILE, []);
    const nextPlans = plans.filter((p) => !(p.userId === userId && p.subject === subject));
    nextPlans.push(plan);
    writeJson(PLANS_FILE, nextPlans);
    return plan;
  }

  const planId = `plan-${crypto.randomBytes(6).toString("hex")}`;
  await query(
    "DELETE FROM study_plan_items WHERE plan_id IN (SELECT id FROM study_plans WHERE user_id = $1 AND subject = $2)",
    [userId, subject]
  );
  await query("DELETE FROM study_plans WHERE user_id = $1 AND subject = $2", [userId, subject]);
  await query(
    "INSERT INTO study_plans (id, user_id, subject, created_at) VALUES ($1, $2, $3, $4)",
    [planId, userId, subject, createdAt]
  );

  for (const item of items) {
    await query(
      `INSERT INTO study_plan_items (id, plan_id, knowledge_point_id, target_count, due_date)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `item-${crypto.randomBytes(6).toString("hex")}`,
        planId,
        item.knowledgePointId,
        item.targetCount,
        item.dueDate
      ]
    );
  }

  return { ...plan, id: planId };
}

async function createOrRefreshStudyPlan(userId: string, subject: string, mode: StudyPlanBuildMode): Promise<StudyPlan> {
  const draft = await buildStudyPlanDraft(userId, subject, mode);
  return saveStudyPlan(draft);
}

export async function generateStudyPlan(userId: string, subject: string): Promise<StudyPlan> {
  return createOrRefreshStudyPlan(userId, subject, "generate");
}

export async function refreshStudyPlan(userId: string, subject: string): Promise<StudyPlan> {
  return createOrRefreshStudyPlan(userId, subject, "refresh");
}

export async function getStudyPlan(userId: string, subject: string) {
  if (!isDbEnabled()) {
    assertDatabaseEnabled("study_plans");
    const plans = readJson<StudyPlan[]>(PLANS_FILE, []);
    return plans.find((plan) => plan.userId === userId && plan.subject === subject) ?? null;
  }

  const plan = await queryOne<DbPlan>(
    "SELECT * FROM study_plans WHERE user_id = $1 AND subject = $2",
    [userId, subject]
  );
  if (!plan) return null;
  const items = await query<DbPlanItem>(
    "SELECT * FROM study_plan_items WHERE plan_id = $1",
    [plan.id]
  );
  return {
    id: plan.id,
    userId: plan.user_id,
    subject: plan.subject,
    createdAt: plan.created_at,
    items: items.map((item) => ({
      knowledgePointId: item.knowledge_point_id,
      targetCount: item.target_count,
      dueDate: item.due_date
    }))
  } as StudyPlan;
}

export async function generateStudyPlans(userId: string, subjects: string[]) {
  const plans: StudyPlan[] = [];
  for (const subject of subjects) {
    plans.push(await generateStudyPlan(userId, subject));
  }
  return plans;
}

export async function getStudyPlans(userId: string, subjects: string[]) {
  if (!isDbEnabled()) {
    assertDatabaseEnabled("study_plans");
    const plans = readJson<StudyPlan[]>(PLANS_FILE, []);
    return plans.filter((plan) => plan.userId === userId && subjects.includes(plan.subject));
  }

  const rows = await query<DbPlan>(
    "SELECT * FROM study_plans WHERE user_id = $1 AND subject = ANY($2)",
    [userId, subjects]
  );
  const planIds = rows.map((row) => row.id);
  if (!planIds.length) return [];
  const itemRows = await query<DbPlanItem>(
    "SELECT * FROM study_plan_items WHERE plan_id = ANY($1)",
    [planIds]
  );
  const itemsByPlan = new Map<string, DbPlanItem[]>();
  itemRows.forEach((item) => {
    const list = itemsByPlan.get(item.plan_id) ?? [];
    list.push(item);
    itemsByPlan.set(item.plan_id, list);
  });
  return rows.map((plan) => ({
    id: plan.id,
    userId: plan.user_id,
    subject: plan.subject,
    createdAt: plan.created_at,
    items: (itemsByPlan.get(plan.id) ?? []).map((item) => ({
      knowledgePointId: item.knowledge_point_id,
      targetCount: item.target_count,
      dueDate: item.due_date
    }))
  }));
}

export async function getPracticeQuestions(subject: string, grade: string, knowledgePointId?: string) {
  const questions = (await getQuestions()).filter((q) => q.subject === subject && q.grade === grade);
  if (knowledgePointId) {
    return questions.filter((q) => q.knowledgePointId === knowledgePointId);
  }
  return questions;
}

export async function getAdaptiveQuestions(params: {
  userId: string;
  subject: string;
  grade: string;
  knowledgePointId?: string;
}) {
  const { userId, subject, grade, knowledgePointId } = params;
  const questions = await getPracticeQuestions(subject, grade, knowledgePointId);
  if (knowledgePointId) return questions;

  const mastery = await getMasteryByKnowledgePoint(userId, subject);
  const reviewItems = await getReviewItemsByStudent(userId);
  const questionMap = new Map<string, Question>();
  questions.forEach((q) => questionMap.set(q.id, q));

  const wrongTagCounts = new Map<string, number>();
  reviewItems.forEach((item) => {
    const question = questionMap.get(item.questionId);
    if (!question) return;
    const current = wrongTagCounts.get(question.knowledgePointId) ?? 0;
    wrongTagCounts.set(question.knowledgePointId, current + 1);
  });

  const scoreByKp = new Map<string, number>();
  const totalsByKp = new Map<string, number>();
  questions.forEach((q) => {
    const stat = mastery.get(q.knowledgePointId) ?? { correct: 0, total: 0 };
    const ratio = stat.total === 0 ? 0 : stat.correct / stat.total;
    const wrongCount = wrongTagCounts.get(q.knowledgePointId) ?? 0;
    const coldStartBoost = stat.total === 0 ? 0.35 : 0;
    const wrongBoost = Math.min(0.6, wrongCount * 0.15);
    const score = (1 - ratio) + wrongBoost + coldStartBoost;
    if (!scoreByKp.has(q.knowledgePointId)) {
      scoreByKp.set(q.knowledgePointId, score);
      totalsByKp.set(q.knowledgePointId, stat.total);
    }
  });

  const ranked = Array.from(scoreByKp.entries())
    .map(([kpId, score]) => ({ kpId, score, total: totalsByKp.get(kpId) ?? 0 }))
    .sort((a, b) => {
      if (a.score === b.score) return a.total - b.total;
      return b.score - a.score;
    })
    .slice(0, 4)
    .map((item) => item.kpId);

  if (!ranked.length) return questions;
  return questions.filter((q) => ranked.includes(q.knowledgePointId));
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function getDiagnosticQuestions(subject: string, grade: string, count = 10) {
  const questions = await getPracticeQuestions(subject, grade);
  const groupMap = new Map<string, Question[]>();
  questions.forEach((q) => {
    const group = groupMap.get(q.knowledgePointId) ?? [];
    group.push(q);
    groupMap.set(q.knowledgePointId, group);
  });

  const keys = Array.from(groupMap.keys());
  keys.forEach((key) => {
    const group = groupMap.get(key);
    if (group) groupMap.set(key, shuffle(group));
  });

  const selected: Question[] = [];
  let progress = true;
  while (selected.length < count && progress) {
    progress = false;
    for (const key of keys) {
      const group = groupMap.get(key) ?? [];
      if (group.length === 0) continue;
      const next = group.pop();
      if (next) {
        selected.push(next);
        progress = true;
      }
      if (selected.length >= count) break;
    }
  }

  return selected.length ? selected : questions.slice(0, count);
}

export async function getWeakKnowledgePoints(userId: string, subject: string) {
  const mastery = await getMasteryByKnowledgePoint(userId, subject);
  const knowledgePoints = (await getKnowledgePoints()).filter((kp) => kp.subject === subject);
  return knowledgePoints
    .map((kp) => {
      const stat = mastery.get(kp.id) ?? { correct: 0, total: 0 };
      const ratio = stat.total === 0 ? 0 : stat.correct / stat.total;
      return { kp, ratio, total: stat.total };
    })
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 3);
}

export async function getWeeklyStats(userId: string) {
  const attempts = await getAttemptsByUser(userId);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = attempts.filter((a) => new Date(a.createdAt).getTime() >= weekAgo);
  const total = recent.length;
  const correct = recent.filter((a) => a.correct).length;
  return {
    total,
    correct,
    accuracy: total === 0 ? 0 : Math.round((correct / total) * 100)
  };
}

export async function getStatsBetween(userId: string, start: Date, end: Date) {
  const attempts = await getAttemptsByUser(userId);
  const recent = attempts.filter((a) => {
    const ts = new Date(a.createdAt).getTime();
    return ts >= start.getTime() && ts < end.getTime();
  });
  const total = recent.length;
  const correct = recent.filter((a) => a.correct).length;
  return {
    total,
    correct,
    accuracy: total === 0 ? 0 : Math.round((correct / total) * 100)
  };
}

function toLocalDateKey(input: Date) {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getDailyActivity(userId: string) {
  const attempts = await getAttemptsByUser(userId);
  const map = new Map<string, number>();
  attempts.forEach((attempt) => {
    const key = toLocalDateKey(new Date(attempt.createdAt));
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return map;
}

export async function getStreak(userId: string) {
  const activity = await getDailyActivity(userId);
  let streak = 0;
  const cursor = new Date();
  while (activity.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function getAccuracyLastDays(userId: string, days: number) {
  const attempts = await getAttemptsByUser(userId);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = attempts.filter((a) => new Date(a.createdAt).getTime() >= since);
  const total = recent.length;
  const correct = recent.filter((a) => a.correct).length;
  return {
    total,
    correct,
    accuracy: total === 0 ? 0 : Math.round((correct / total) * 100)
  };
}

export async function getDailyAccuracy(userId: string, days: number) {
  const attempts = await getAttemptsByUser(userId);
  const buckets = new Map<string, { correct: number; total: number }>();
  attempts.forEach((attempt) => {
    const key = toLocalDateKey(new Date(attempt.createdAt));
    const current = buckets.get(key) ?? { correct: 0, total: 0 };
    current.total += 1;
    current.correct += attempt.correct ? 1 : 0;
    buckets.set(key, current);
  });

  const result: { date: string; total: number; correct: number; accuracy: number }[] = [];
  const cursor = new Date();
  for (let i = 0; i < days; i += 1) {
    const dateKey = toLocalDateKey(new Date(cursor));
    const stat = buckets.get(dateKey) ?? { correct: 0, total: 0 };
    result.unshift({
      date: dateKey,
      total: stat.total,
      correct: stat.correct,
      accuracy: stat.total === 0 ? 0 : Math.round((stat.correct / stat.total) * 100)
    });
    cursor.setDate(cursor.getDate() - 1);
  }
  return result;
}

export async function getBadges(userId: string) {
  const attempts = await getAttemptsByUser(userId);
  const streak = await getStreak(userId);
  const weekly = await getAccuracyLastDays(userId, 7);
  const focusSessions = await getFocusSessionsByUser(userId);
  const favorites = await getFavoritesByUser(userId);
  const badges: { id: string; title: string; description: string }[] = [];

  if (attempts.length >= 1) {
    badges.push({ id: "first", title: "首次学习", description: "完成首次练习" });
  }
  if (streak >= 3) {
    badges.push({ id: "streak-3", title: "连学 3 天", description: "连续学习 3 天" });
  }
  if (weekly.total >= 5 && weekly.accuracy >= 80) {
    badges.push({ id: "accuracy-80", title: "高准确率", description: "近 7 天正确率 ≥ 80%" });
  }
  if (attempts.length >= 50) {
    badges.push({ id: "practice-50", title: "学习达人", description: "完成 50 道题" });
  }
  const focusCount = focusSessions.filter((item) => item.mode === "focus").length;
  const focusMinutes = focusSessions
    .filter((item) => item.mode === "focus")
    .reduce((sum, item) => sum + item.durationMinutes, 0);
  if (focusCount >= 3) {
    badges.push({ id: "focus-3", title: "专注三连", description: "完成 3 次专注计时" });
  }
  if (focusMinutes >= 120) {
    badges.push({ id: "focus-120", title: "专注达人", description: "累计专注 120 分钟" });
  }
  if (favorites.length >= 5) {
    badges.push({ id: "fav-5", title: "收藏小能手", description: "收藏 5 道题" });
  }
  const tagged = favorites.filter((item) => item.tags?.length).length;
  if (tagged >= 3) {
    badges.push({ id: "tag-3", title: "分类高手", description: "为 3 道题添加标签" });
  }
  return badges;
}

export async function getKnowledgeProfile(userId: string, subjects?: string[]) {
  const attempts = await getAttemptsByUser(userId);
  const knowledgePoints = await getKnowledgePoints();
  const filtered = subjects?.length
    ? knowledgePoints.filter((kp) => subjects.includes(kp.subject))
    : knowledgePoints;

  const stats = new Map<
    string,
    { correct: number; total: number; lastAttemptAt: string | null }
  >();

  attempts.forEach((attempt) => {
    const current = stats.get(attempt.knowledgePointId) ?? { correct: 0, total: 0, lastAttemptAt: null };
    current.total += 1;
    current.correct += attempt.correct ? 1 : 0;
    if (!current.lastAttemptAt || new Date(attempt.createdAt).getTime() > new Date(current.lastAttemptAt).getTime()) {
      current.lastAttemptAt = attempt.createdAt;
    }
    stats.set(attempt.knowledgePointId, current);
  });

  return filtered.map((kp) => {
    const stat = stats.get(kp.id) ?? { correct: 0, total: 0, lastAttemptAt: null };
    const ratio = stat.total === 0 ? 0 : stat.correct / stat.total;
    return {
      kp,
      correct: stat.correct,
      total: stat.total,
      ratio,
      lastAttemptAt: stat.lastAttemptAt
    };
  });
}
