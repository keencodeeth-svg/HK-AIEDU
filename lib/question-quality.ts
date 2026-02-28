import crypto from "crypto";
import { isDbEnabled, query, queryOne } from "./db";
import { readJson, writeJson } from "./storage";
import type { Question } from "./types";

const QUALITY_FILE = "question-quality-metrics.json";

export type QualityRiskLevel = "low" | "medium" | "high";

export type QuestionQualitySnapshot = {
  qualityScore: number;
  duplicateRisk: QualityRiskLevel;
  ambiguityRisk: QualityRiskLevel;
  answerConsistency: number;
  duplicateClusterId: string | null;
  answerConflict: boolean;
  riskLevel: QualityRiskLevel;
  isolated: boolean;
  isolationReason: string[];
  issues: string[];
};

export type QuestionQualityMetric = QuestionQualitySnapshot & {
  id: string;
  questionId: string;
  checkedAt: string;
};

export type QuestionQualityInput = {
  questionId?: string;
  subject?: string;
  grade?: string;
  knowledgePointId?: string;
  stem: string;
  options: string[];
  answer: string;
  explanation?: string;
};

export type QuestionQualityCandidate = Pick<
  Question,
  "id" | "subject" | "grade" | "knowledgePointId" | "stem" | "answer"
>;

type DbQuestionQualityMetric = {
  id: string;
  question_id: string;
  quality_score: number;
  duplicate_risk: string;
  ambiguity_risk: string;
  answer_consistency: number;
  duplicate_cluster_id: string | null;
  answer_conflict: boolean | null;
  risk_level: string | null;
  isolated: boolean | null;
  isolation_reason: string[] | null;
  issues: string[] | null;
  checked_at: string;
};

function clampInt(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？,.!?;:；：、"'`~\-()（）【】\[\]{}]/g, "");
}

function normalizeRisk(value: string | null | undefined): QualityRiskLevel {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "low";
}

function buildClusterId(seed: string) {
  const hash = crypto.createHash("md5").update(seed).digest("hex").slice(0, 10);
  return `dup-${hash}`;
}

function buildCharSet(text: string) {
  const normalized = normalizeText(text);
  const set = new Set<string>();
  for (const char of normalized) {
    set.add(char);
  }
  return set;
}

function calcSimilarity(a: string, b: string) {
  const setA = buildCharSet(a);
  const setB = buildCharSet(b);
  if (!setA.size || !setB.size) return 0;

  let common = 0;
  setA.forEach((char) => {
    if (setB.has(char)) {
      common += 1;
    }
  });
  return common / Math.max(setA.size, setB.size);
}

function deriveRiskLevel(input: {
  qualityScore: number;
  duplicateRisk: QualityRiskLevel;
  ambiguityRisk: QualityRiskLevel;
  answerConsistency: number;
  answerConflict: boolean;
}) {
  if (
    input.answerConflict ||
    input.duplicateRisk === "high" ||
    input.ambiguityRisk === "high" ||
    input.answerConsistency < 60 ||
    input.qualityScore < 55
  ) {
    return "high" as QualityRiskLevel;
  }
  if (
    input.duplicateRisk === "medium" ||
    input.ambiguityRisk === "medium" ||
    input.answerConsistency < 75 ||
    input.qualityScore < 80
  ) {
    return "medium" as QualityRiskLevel;
  }
  return "low" as QualityRiskLevel;
}

function buildIsolationReason(input: {
  riskLevel: QualityRiskLevel;
  issues: string[];
  answerConflict: boolean;
  duplicateRisk: QualityRiskLevel;
  ambiguityRisk: QualityRiskLevel;
}) {
  if (input.riskLevel !== "high") return [];
  const reasons = [...input.issues];
  if (input.answerConflict) {
    reasons.unshift("疑似答案冲突：高相似题存在不同答案。");
  }
  if (input.duplicateRisk === "high") {
    reasons.unshift("重复风险高：题干与已有题高度相似。");
  }
  if (input.ambiguityRisk === "high") {
    reasons.unshift("歧义风险高：题干/选项存在歧义。");
  }
  return Array.from(new Set(reasons)).slice(0, 6);
}

function mapDbMetric(row: DbQuestionQualityMetric): QuestionQualityMetric {
  const riskLevel = normalizeRisk(row.risk_level);
  const isolated = Boolean(row.isolated);
  return {
    id: row.id,
    questionId: row.question_id,
    qualityScore: clampInt(row.quality_score),
    duplicateRisk: normalizeRisk(row.duplicate_risk),
    ambiguityRisk: normalizeRisk(row.ambiguity_risk),
    answerConsistency: clampInt(row.answer_consistency),
    duplicateClusterId: row.duplicate_cluster_id ?? null,
    answerConflict: Boolean(row.answer_conflict),
    riskLevel,
    isolated,
    isolationReason: row.isolation_reason ?? [],
    issues: row.issues ?? [],
    checkedAt: row.checked_at
  };
}

function readQualityMetricsFromFile() {
  return readJson<QuestionQualityMetric[]>(QUALITY_FILE, []);
}

function upsertQualityMetricToFile(metric: QuestionQualityMetric) {
  const list = readQualityMetricsFromFile();
  const index = list.findIndex((item) => item.questionId === metric.questionId);
  if (index >= 0) {
    list[index] = metric;
  } else {
    list.push(metric);
  }
  try {
    writeJson(QUALITY_FILE, list);
  } catch {
    // file persistence is best-effort when db storage is unavailable
  }
}

function isRecoverableQualityStoreError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  return (
    lower.includes("question_quality_metrics") ||
    lower.includes("relation") ||
    lower.includes("db:migrate") ||
    lower.includes("schema") ||
    lower.includes("does not exist")
  );
}

function evaluateDuplicateRisk(
  input: Pick<QuestionQualityInput, "questionId" | "knowledgePointId" | "stem" | "answer">,
  candidates: QuestionQualityCandidate[]
) {
  const normalizedStem = normalizeText(input.stem);
  const normalizedAnswer = normalizeText(input.answer);
  if (!normalizedStem) {
    return {
      risk: "high" as QualityRiskLevel,
      issues: ["题干为空，无法进行有效去重。"],
      clusterId: null as string | null,
      answerConflict: false
    };
  }

  let exactMatches = 0;
  let maxSimilarity = 0;
  let sameKnowledgePointSimilarity = 0;
  let answerConflict = false;
  const clusterCandidates: Array<{ id: string; similarity: number }> = [];

  candidates.forEach((candidate) => {
    if (input.questionId && candidate.id === input.questionId) {
      return;
    }
    const candidateNormalized = normalizeText(candidate.stem);
    if (!candidateNormalized) {
      return;
    }

    let similarity = 0;
    if (candidateNormalized === normalizedStem) {
      exactMatches += 1;
      similarity = 1;
    } else {
      similarity = calcSimilarity(normalizedStem, candidateNormalized);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
      if (input.knowledgePointId && candidate.knowledgePointId === input.knowledgePointId) {
        sameKnowledgePointSimilarity = Math.max(sameKnowledgePointSimilarity, similarity);
      }
    }

    if (similarity >= 0.82) {
      clusterCandidates.push({ id: candidate.id, similarity });
    }

    if (similarity >= 0.92) {
      const candidateAnswer = normalizeText(candidate.answer ?? "");
      if (normalizedAnswer && candidateAnswer && candidateAnswer !== normalizedAnswer) {
        answerConflict = true;
      }
    }
  });

  const sortedIds = clusterCandidates.map((item) => item.id).sort();
  const clusterSeed = [normalizedStem.slice(0, 32), ...sortedIds].join("|");
  const clusterId = sortedIds.length ? buildClusterId(clusterSeed) : null;
  const issues: string[] = [];

  let risk: QualityRiskLevel = "low";
  if (exactMatches > 0 || maxSimilarity >= 0.92) {
    risk = "high";
    issues.push("题干与题库已有题目重复或高度相似。");
  } else if (maxSimilarity >= 0.78 || sameKnowledgePointSimilarity >= 0.72) {
    risk = "medium";
    issues.push("题干与已有题目相似度较高，建议改写。");
  }

  if (answerConflict) {
    risk = "high";
    issues.push("高相似题出现答案冲突，请人工复核。");
  }

  return {
    risk,
    issues: Array.from(new Set(issues)),
    clusterId,
    answerConflict
  };
}

function toAmbiguityRisk(score: number): QualityRiskLevel {
  if (score >= 60) return "high";
  if (score >= 25) return "medium";
  return "low";
}

export function evaluateQuestionQuality(
  input: QuestionQualityInput,
  candidates: QuestionQualityCandidate[] = []
): QuestionQualitySnapshot {
  const stem = input.stem.trim();
  const options = input.options.map((item) => item.trim()).filter(Boolean);
  const answer = input.answer.trim();
  const explanation = input.explanation?.trim() ?? "";

  const issues: string[] = [];
  let ambiguityScore = 0;

  if (options.length < 4) {
    issues.push("选项数量不足 4 个。");
    ambiguityScore += 35;
  }

  const normalizedOptions = options.map(normalizeText);
  const uniqueOptions = new Set(normalizedOptions);
  if (uniqueOptions.size !== normalizedOptions.length) {
    issues.push("存在重复选项，可能导致歧义。");
    ambiguityScore += 25;
  }

  const normalizedAnswer = normalizeText(answer);
  const answerMatchCount = normalizedOptions.filter((item) => item === normalizedAnswer).length;
  const answerInOptions = answerMatchCount > 0;
  if (!answerInOptions) {
    issues.push("答案不在选项中。");
    ambiguityScore += 45;
  }

  if (stem.length < 8) {
    issues.push("题干过短，建议补充关键条件。");
    ambiguityScore += 15;
  }

  if (explanation.length < 8) {
    issues.push("解析过短，建议补充解题步骤。");
    ambiguityScore += 10;
  }

  let answerConsistency = 100;
  if (!answerInOptions) {
    answerConsistency -= 70;
  }
  if (answerMatchCount > 1) {
    answerConsistency -= 20;
  }
  if (explanation.length < 8) {
    answerConsistency -= 10;
  }
  answerConsistency = clampInt(answerConsistency);

  const comparableCandidates = candidates.filter((candidate) => {
    if (input.subject && candidate.subject !== input.subject) return false;
    if (input.grade && candidate.grade !== input.grade) return false;
    return true;
  });

  const duplicate = evaluateDuplicateRisk(
    {
      questionId: input.questionId,
      knowledgePointId: input.knowledgePointId,
      stem,
      answer
    },
    comparableCandidates
  );

  issues.push(...duplicate.issues);
  const ambiguityRisk = toAmbiguityRisk(ambiguityScore);

  let penalty = 0;
  penalty += duplicate.risk === "high" ? 30 : duplicate.risk === "medium" ? 15 : 0;
  penalty += ambiguityRisk === "high" ? 30 : ambiguityRisk === "medium" ? 15 : 0;
  penalty += duplicate.answerConflict ? 25 : 0;
  penalty += Math.round((100 - answerConsistency) * 0.4);

  const qualityScore = clampInt(100 - penalty);
  const riskLevel = deriveRiskLevel({
    qualityScore,
    duplicateRisk: duplicate.risk,
    ambiguityRisk,
    answerConsistency,
    answerConflict: duplicate.answerConflict
  });
  const isolated = riskLevel === "high";
  const isolationReason = buildIsolationReason({
    riskLevel,
    issues,
    answerConflict: duplicate.answerConflict,
    duplicateRisk: duplicate.risk,
    ambiguityRisk
  });

  return {
    qualityScore,
    duplicateRisk: duplicate.risk,
    ambiguityRisk,
    answerConsistency,
    duplicateClusterId: duplicate.clusterId,
    answerConflict: duplicate.answerConflict,
    riskLevel,
    isolated,
    isolationReason,
    issues: Array.from(new Set(issues))
  };
}

export async function getQuestionQualityMetric(questionId: string) {
  if (!isDbEnabled()) {
    const list = readQualityMetricsFromFile();
    return list.find((item) => item.questionId === questionId) ?? null;
  }

  try {
    const row = await queryOne<DbQuestionQualityMetric>(
      "SELECT * FROM question_quality_metrics WHERE question_id = $1",
      [questionId]
    );
    return row ? mapDbMetric(row) : null;
  } catch (error) {
    if (!isRecoverableQualityStoreError(error)) {
      throw error;
    }
    const list = readQualityMetricsFromFile();
    return list.find((item) => item.questionId === questionId) ?? null;
  }
}

export async function listQuestionQualityMetrics(params: {
  questionIds?: string[];
  isolated?: boolean;
} = {}) {
  const ids = params.questionIds;
  if (ids && ids.length === 0) {
    return [] as QuestionQualityMetric[];
  }

  if (!isDbEnabled()) {
    const list = readQualityMetricsFromFile();
    const filtered = list.filter((item) => {
      if (ids && !ids.includes(item.questionId)) return false;
      if (params.isolated !== undefined && Boolean(item.isolated) !== params.isolated) return false;
      return true;
    });
    return filtered.sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  }

  const where: string[] = [];
  const values: Array<string[] | boolean> = [];
  if (ids) {
    values.push(ids);
    where.push(`question_id = ANY($${values.length}::text[])`);
  }
  if (params.isolated !== undefined) {
    values.push(params.isolated);
    where.push(`isolated = $${values.length}`);
  }

  const sql = `
    SELECT *
    FROM question_quality_metrics
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY checked_at DESC
  `;
  try {
    const rows = await query<DbQuestionQualityMetric>(sql, values);
    return rows.map(mapDbMetric);
  } catch (error) {
    if (!isRecoverableQualityStoreError(error)) {
      throw error;
    }
    const list = readQualityMetricsFromFile();
    const filtered = list.filter((item) => {
      if (ids && !ids.includes(item.questionId)) return false;
      if (params.isolated !== undefined && Boolean(item.isolated) !== params.isolated) return false;
      return true;
    });
    return filtered.sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  }
}

export async function upsertQuestionQualityMetric(
  input: { questionId: string } & QuestionQualitySnapshot & { checkedAt?: string }
) {
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const normalizedRiskLevel = normalizeRisk(input.riskLevel);
  const isolated = Boolean(input.isolated);

  if (!isDbEnabled()) {
    const list = readQualityMetricsFromFile();
    const index = list.findIndex((item) => item.questionId === input.questionId);
    const next: QuestionQualityMetric = {
      id: index >= 0 ? list[index].id : `qqm-${crypto.randomBytes(6).toString("hex")}`,
      questionId: input.questionId,
      qualityScore: clampInt(input.qualityScore),
      duplicateRisk: normalizeRisk(input.duplicateRisk),
      ambiguityRisk: normalizeRisk(input.ambiguityRisk),
      answerConsistency: clampInt(input.answerConsistency),
      duplicateClusterId: input.duplicateClusterId ?? null,
      answerConflict: Boolean(input.answerConflict),
      riskLevel: normalizedRiskLevel,
      isolated,
      isolationReason: Array.from(new Set(input.isolationReason ?? [])),
      issues: Array.from(new Set(input.issues)),
      checkedAt
    };
    upsertQualityMetricToFile(next);
    return next;
  }

  const fallbackMetric: QuestionQualityMetric = {
    id: `qqm-${crypto.randomBytes(6).toString("hex")}`,
    questionId: input.questionId,
    qualityScore: clampInt(input.qualityScore),
    duplicateRisk: normalizeRisk(input.duplicateRisk),
    ambiguityRisk: normalizeRisk(input.ambiguityRisk),
    answerConsistency: clampInt(input.answerConsistency),
    duplicateClusterId: input.duplicateClusterId ?? null,
    answerConflict: Boolean(input.answerConflict),
    riskLevel: normalizedRiskLevel,
    isolated,
    isolationReason: Array.from(new Set(input.isolationReason ?? [])),
    issues: Array.from(new Set(input.issues)),
    checkedAt
  };

  try {
    const existing = await queryOne<DbQuestionQualityMetric>(
      "SELECT * FROM question_quality_metrics WHERE question_id = $1",
      [input.questionId]
    );

    const row = await queryOne<DbQuestionQualityMetric>(
      `INSERT INTO question_quality_metrics
        (id, question_id, quality_score, duplicate_risk, ambiguity_risk, answer_consistency, duplicate_cluster_id, answer_conflict, risk_level, isolated, isolation_reason, issues, checked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (question_id) DO UPDATE SET
         quality_score = EXCLUDED.quality_score,
         duplicate_risk = EXCLUDED.duplicate_risk,
         ambiguity_risk = EXCLUDED.ambiguity_risk,
         answer_consistency = EXCLUDED.answer_consistency,
         duplicate_cluster_id = EXCLUDED.duplicate_cluster_id,
         answer_conflict = EXCLUDED.answer_conflict,
         risk_level = EXCLUDED.risk_level,
         isolated = EXCLUDED.isolated,
         isolation_reason = EXCLUDED.isolation_reason,
         issues = EXCLUDED.issues,
         checked_at = EXCLUDED.checked_at
       RETURNING *`,
      [
        existing?.id ?? fallbackMetric.id,
        input.questionId,
        fallbackMetric.qualityScore,
        fallbackMetric.duplicateRisk,
        fallbackMetric.ambiguityRisk,
        fallbackMetric.answerConsistency,
        fallbackMetric.duplicateClusterId,
        fallbackMetric.answerConflict,
        fallbackMetric.riskLevel,
        fallbackMetric.isolated,
        fallbackMetric.isolationReason,
        fallbackMetric.issues,
        checkedAt
      ]
    );
    return row ? mapDbMetric(row) : fallbackMetric;
  } catch (error) {
    if (!isRecoverableQualityStoreError(error)) {
      throw error;
    }
    upsertQualityMetricToFile(fallbackMetric);
    return fallbackMetric;
  }
}

export async function evaluateAndUpsertQuestionQuality(params: {
  question: Question;
  candidates?: QuestionQualityCandidate[];
}) {
  const snapshot = evaluateQuestionQuality(
    {
      questionId: params.question.id,
      subject: params.question.subject,
      grade: params.question.grade,
      knowledgePointId: params.question.knowledgePointId,
      stem: params.question.stem,
      options: params.question.options,
      answer: params.question.answer,
      explanation: params.question.explanation
    },
    params.candidates ?? []
  );
  return upsertQuestionQualityMetric({
    questionId: params.question.id,
    ...snapshot
  });
}

export async function setQuestionIsolation(input: {
  questionId: string;
  isolated: boolean;
  isolationReason?: string[];
}) {
  const existing = await getQuestionQualityMetric(input.questionId);
  const reasons = Array.from(new Set(input.isolationReason ?? existing?.isolationReason ?? []));
  if (!existing) {
    return upsertQuestionQualityMetric({
      questionId: input.questionId,
      qualityScore: 0,
      duplicateRisk: "low",
      ambiguityRisk: "low",
      answerConsistency: 0,
      duplicateClusterId: null,
      answerConflict: false,
      riskLevel: input.isolated ? "high" : "low",
      isolated: input.isolated,
      isolationReason: reasons,
      issues: []
    });
  }

  return upsertQuestionQualityMetric({
    ...existing,
    isolated: input.isolated,
    riskLevel: input.isolated ? existing.riskLevel || "high" : existing.riskLevel,
    isolationReason: reasons.length ? reasons : existing.isolationReason,
    checkedAt: new Date().toISOString()
  });
}

export async function deleteQuestionQualityMetric(questionId: string) {
  if (!isDbEnabled()) {
    const list = readQualityMetricsFromFile();
    const next = list.filter((item) => item.questionId !== questionId);
    try {
      writeJson(QUALITY_FILE, next);
    } catch {
      // best effort
    }
    return list.length !== next.length;
  }

  try {
    const rows = await query<{ id: string }>(
      "DELETE FROM question_quality_metrics WHERE question_id = $1 RETURNING id",
      [questionId]
    );
    return rows.length > 0;
  } catch (error) {
    if (!isRecoverableQualityStoreError(error)) {
      throw error;
    }
    const list = readQualityMetricsFromFile();
    const next = list.filter((item) => item.questionId !== questionId);
    try {
      writeJson(QUALITY_FILE, next);
    } catch {
      // best effort
    }
    return list.length !== next.length;
  }
}

export function attachQualityFields<T extends { id: string }>(
  item: T,
  metric: QuestionQualityMetric | null
) {
  return {
    ...item,
    qualityScore: metric?.qualityScore ?? null,
    duplicateRisk: metric?.duplicateRisk ?? null,
    ambiguityRisk: metric?.ambiguityRisk ?? null,
    answerConsistency: metric?.answerConsistency ?? null,
    duplicateClusterId: metric?.duplicateClusterId ?? null,
    answerConflict: metric?.answerConflict ?? false,
    riskLevel: metric?.riskLevel ?? null,
    isolated: metric?.isolated ?? false,
    isolationReason: metric?.isolationReason ?? [],
    qualityIssues: metric?.issues ?? [],
    qualityCheckedAt: metric?.checkedAt ?? null
  };
}
