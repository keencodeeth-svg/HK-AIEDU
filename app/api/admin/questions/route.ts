import { createQuestion, getKnowledgePoints, getQuestions } from "@/lib/content";
import { requireRole } from "@/lib/guard";
import { addAdminLog } from "@/lib/admin-log";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import { badRequest, unauthorized } from "@/lib/api/http";
import { isDbEnabled, query as runDbQuery } from "@/lib/db";
import type { Question } from "@/lib/types";
import {
  attachQualityFields,
  evaluateAndUpsertQuestionQuality,
  listQuestionQualityMetrics,
  type QuestionQualityMetric
} from "@/lib/question-quality";
import {
  createQuestionBodySchema,
  isAllowedSubject,
  normalizeDifficulty,
  trimStringArray
} from "@/lib/api/schemas/admin";
import { parseJson, parseSearchParams, v } from "@/lib/api/validation";
import { createAdminRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

type QuestionSortBy = "updatedAt" | "subject" | "grade" | "chapter" | "difficulty" | "questionType";
type QuestionSortDir = "asc" | "desc";

type ParsedListQuery = {
  subject?: string;
  grade?: string;
  chapter?: string;
  knowledgePointId?: string;
  difficulty?: string;
  questionType?: string;
  search?: string;
  pool?: "all" | "isolated" | "active";
  riskLevel?: "all" | "low" | "medium" | "high";
  answerConflict?: "all" | "yes" | "no";
  duplicateClusterId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: QuestionSortBy;
  sortDir?: QuestionSortDir;
};

type ListQuestionsFilters = {
  subject?: string;
  grade?: string;
  chapter?: string;
  knowledgePointId?: string;
  difficulty?: string;
  questionType?: string;
  search?: string;
  pool: "all" | "isolated" | "active";
  riskLevel: "all" | "low" | "medium" | "high";
  answerConflict: "all" | "yes" | "no";
  duplicateClusterId?: string;
  sortBy: QuestionSortBy;
  sortDir: QuestionSortDir;
  shouldPaginate: boolean;
  page: number;
  pageSize: number;
};

type QuestionTreeNode = {
  subject: string;
  count: number;
  grades: Array<{
    grade: string;
    count: number;
    chapters: Array<{ chapter: string; count: number }>;
  }>;
};

type DbQuestionListRow = {
  id: string;
  subject: string;
  grade: string;
  knowledge_point_id: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: string | null;
  question_type: string | null;
  tags: string[] | null;
  abilities: string[] | null;
};

type DbFacetRow = {
  value: string | null;
  count: number | string;
};

type DbTreeRow = {
  subject: string;
  grade: string;
  chapter: string | null;
  count: number | string;
};

type DbQualitySummaryRow = {
  tracked_count: number | string;
  isolated_count: number | string;
  high_risk_count: number | string;
  medium_risk_count: number | string;
  answer_conflict_count: number | string;
  duplicate_cluster_count: number | string;
};

type DbTopClusterRow = {
  id: string;
  count: number | string;
  isolated_count: number | string;
  high_risk_count: number | string;
};

const listQuestionsQuerySchema = v.object<ParsedListQuery>(
  {
    subject: v.optional(v.string({ allowEmpty: true, trim: false })),
    grade: v.optional(v.string({ allowEmpty: true, trim: false })),
    chapter: v.optional(v.string({ allowEmpty: true, trim: false })),
    knowledgePointId: v.optional(v.string({ allowEmpty: true, trim: false })),
    difficulty: v.optional(v.string({ allowEmpty: true, trim: false })),
    questionType: v.optional(v.string({ allowEmpty: true, trim: false })),
    search: v.optional(v.string({ allowEmpty: true, trim: false })),
    pool: v.optional(v.enum(["all", "isolated", "active"] as const)),
    riskLevel: v.optional(v.enum(["all", "low", "medium", "high"] as const)),
    answerConflict: v.optional(v.enum(["all", "yes", "no"] as const)),
    duplicateClusterId: v.optional(v.string({ allowEmpty: true, trim: false })),
    page: v.optional(v.number({ integer: true, min: 1, coerce: true })),
    pageSize: v.optional(v.number({ integer: true, min: 1, max: 200, coerce: true })),
    sortBy: v.optional(
      v.enum(["updatedAt", "subject", "grade", "chapter", "difficulty", "questionType"] as const)
    ),
    sortDir: v.optional(v.enum(["asc", "desc"] as const))
  },
  { allowUnknown: true }
);

const SORT_SQL_BY: Record<QuestionSortBy, string> = {
  updatedAt: "q.updated_at",
  subject: "q.subject",
  grade: "q.grade",
  chapter: "COALESCE(kp.chapter, '未分章节')",
  difficulty: "COALESCE(q.difficulty, 'medium')",
  questionType: "COALESCE(q.question_type, 'choice')"
};

function normalizeQueryString(value?: string) {
  const next = value?.trim();
  return next ? next : undefined;
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeFilters(query: ParsedListQuery): ListQuestionsFilters {
  return {
    subject: normalizeQueryString(query.subject),
    grade: normalizeQueryString(query.grade),
    chapter: normalizeQueryString(query.chapter),
    knowledgePointId: normalizeQueryString(query.knowledgePointId),
    difficulty: normalizeQueryString(query.difficulty),
    questionType: normalizeQueryString(query.questionType),
    search: normalizeQueryString(query.search),
    pool: query.pool ?? "all",
    riskLevel: query.riskLevel ?? "all",
    answerConflict: query.answerConflict ?? "all",
    duplicateClusterId: normalizeQueryString(query.duplicateClusterId),
    sortBy: query.sortBy ?? "updatedAt",
    sortDir: query.sortDir ?? "desc",
    shouldPaginate: query.page !== undefined || query.pageSize !== undefined,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 30
  };
}

function buildFacet(values: string[]) {
  const map = new Map<string, number>();
  values.forEach((value) => {
    const key = value.trim();
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function mapDbQuestion(row: DbQuestionListRow): Question {
  const difficulty =
    row.difficulty === "easy" || row.difficulty === "medium" || row.difficulty === "hard"
      ? row.difficulty
      : undefined;
  return {
    id: row.id,
    subject: row.subject as Question["subject"],
    grade: row.grade,
    knowledgePointId: row.knowledge_point_id,
    stem: row.stem,
    options: row.options,
    answer: row.answer,
    explanation: row.explanation,
    difficulty,
    questionType: row.question_type ?? undefined,
    tags: row.tags ?? [],
    abilities: row.abilities ?? []
  };
}

function buildResponseFilters(filters: ListQuestionsFilters) {
  return {
    subject: filters.subject ?? null,
    grade: filters.grade ?? null,
    chapter: filters.chapter ?? null,
    knowledgePointId: filters.knowledgePointId ?? null,
    difficulty: filters.difficulty ?? null,
    questionType: filters.questionType ?? null,
    search: filters.search ?? null,
    pool: filters.pool,
    riskLevel: filters.riskLevel,
    answerConflict: filters.answerConflict,
    duplicateClusterId: filters.duplicateClusterId ?? null,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir
  };
}

function isHighQualityRisk(metric?: {
  riskLevel?: string | null;
  duplicateRisk?: string | null;
  ambiguityRisk?: string | null;
  answerConflict?: boolean | null;
}) {
  if (!metric) return false;
  return (
    metric.riskLevel === "high" ||
    metric.duplicateRisk === "high" ||
    metric.ambiguityRisk === "high" ||
    Boolean(metric.answerConflict)
  );
}

function isMediumQualityRisk(metric?: {
  riskLevel?: string | null;
  duplicateRisk?: string | null;
  ambiguityRisk?: string | null;
}) {
  if (!metric) return false;
  if (isHighQualityRisk(metric)) return false;
  return (
    metric.riskLevel === "medium" ||
    metric.duplicateRisk === "medium" ||
    metric.ambiguityRisk === "medium"
  );
}

function buildQuestionTree(rows: Array<{ subject: string; grade: string; chapter: string; count: number }>) {
  const treeMap = new Map<string, QuestionTreeNode>();
  rows.forEach((row) => {
    const subjectNode =
      treeMap.get(row.subject) ??
      ({
        subject: row.subject,
        count: 0,
        grades: []
      } as QuestionTreeNode);
    subjectNode.count += row.count;

    let gradeNode = subjectNode.grades.find((entry) => entry.grade === row.grade);
    if (!gradeNode) {
      gradeNode = { grade: row.grade, count: 0, chapters: [] };
      subjectNode.grades.push(gradeNode);
    }
    gradeNode.count += row.count;

    const chapterNode = gradeNode.chapters.find((entry) => entry.chapter === row.chapter);
    if (chapterNode) {
      chapterNode.count += row.count;
    } else {
      gradeNode.chapters.push({ chapter: row.chapter, count: row.count });
    }

    treeMap.set(row.subject, subjectNode);
  });

  return Array.from(treeMap.values())
    .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject))
    .map((subjectNode) => ({
      ...subjectNode,
      grades: subjectNode.grades
        .slice()
        .sort((a, b) => a.grade.localeCompare(b.grade, "zh-Hans-CN", { numeric: true }))
        .map((gradeNode) => ({
          ...gradeNode,
          chapters: gradeNode.chapters
            .slice()
            .sort((a, b) => b.count - a.count || a.chapter.localeCompare(b.chapter))
        }))
    }));
}

function buildDbWhere(filters: ListQuestionsFilters) {
  const values: Array<string | boolean | number> = [];
  const where: string[] = [];
  const addValue = (value: string | boolean | number) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.subject) where.push(`q.subject = ${addValue(filters.subject)}`);
  if (filters.grade) where.push(`q.grade = ${addValue(filters.grade)}`);
  if (filters.knowledgePointId) where.push(`q.knowledge_point_id = ${addValue(filters.knowledgePointId)}`);
  if (filters.difficulty) where.push(`COALESCE(q.difficulty, 'medium') = ${addValue(filters.difficulty)}`);
  if (filters.questionType) where.push(`COALESCE(q.question_type, 'choice') = ${addValue(filters.questionType)}`);
  if (filters.chapter) where.push(`COALESCE(kp.chapter, '未分章节') = ${addValue(filters.chapter)}`);
  if (filters.search) {
    const searchValue = addValue(`%${filters.search}%`);
    where.push(
      `(q.id ILIKE ${searchValue}
        OR q.stem ILIKE ${searchValue}
        OR q.answer ILIKE ${searchValue}
        OR q.explanation ILIKE ${searchValue}
        OR COALESCE(array_to_string(q.tags, ' '), '') ILIKE ${searchValue}
        OR COALESCE(array_to_string(q.abilities, ' '), '') ILIKE ${searchValue}
        OR COALESCE(kp.chapter, '未分章节') ILIKE ${searchValue})`
    );
  }

  if (filters.pool === "isolated") {
    where.push("COALESCE(qm.isolated, false) = true");
  } else if (filters.pool === "active") {
    where.push("COALESCE(qm.isolated, false) = false");
  }

  if (filters.riskLevel !== "all") {
    where.push(`COALESCE(qm.risk_level, 'low') = ${addValue(filters.riskLevel)}`);
  }

  if (filters.answerConflict === "yes") {
    where.push("COALESCE(qm.answer_conflict, false) = true");
  } else if (filters.answerConflict === "no") {
    where.push("COALESCE(qm.answer_conflict, false) = false");
  }

  if (filters.duplicateClusterId) {
    where.push(`COALESCE(qm.duplicate_cluster_id, '') ILIKE ${addValue(`%${filters.duplicateClusterId}%`)}`);
  }

  return {
    fromSql: `
      FROM questions q
      LEFT JOIN knowledge_points kp ON kp.id = q.knowledge_point_id
      LEFT JOIN question_quality_metrics qm ON qm.question_id = q.id
    `,
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    values
  };
}

async function listQuestionsFromDb(filters: ListQuestionsFilters) {
  const { fromSql, whereSql, values } = buildDbWhere(filters);
  const sortExpr = SORT_SQL_BY[filters.sortBy];
  const sortDir = filters.sortDir === "asc" ? "ASC" : "DESC";
  const tieBreakSql = filters.sortBy === "updatedAt" ? "q.id DESC" : "q.updated_at DESC, q.id DESC";
  const orderSql = `ORDER BY ${sortExpr} ${sortDir}, ${tieBreakSql}`;

  const totalRows = await runDbQuery<{ total: number | string }>(
    `SELECT COUNT(*)::int AS total ${fromSql} ${whereSql}`,
    values
  );
  const total = toNumber(totalRows[0]?.total);
  const totalPages = filters.shouldPaginate ? Math.max(1, Math.ceil(total / filters.pageSize)) : 1;
  const safePage = filters.shouldPaginate ? Math.min(Math.max(filters.page, 1), totalPages) : 1;

  const pageValues = [...values];
  const limitSql = filters.shouldPaginate
    ? `LIMIT $${pageValues.push(filters.pageSize)} OFFSET $${pageValues.push((safePage - 1) * filters.pageSize)}`
    : "";

  const rows = await runDbQuery<DbQuestionListRow>(
    `
      SELECT
        q.id,
        q.subject,
        q.grade,
        q.knowledge_point_id,
        q.stem,
        q.options,
        q.answer,
        q.explanation,
        q.difficulty,
        q.question_type,
        q.tags,
        q.abilities
      ${fromSql}
      ${whereSql}
      ${orderSql}
      ${limitSql}
    `,
    pageValues
  );

  const pagedQuestions = rows.map(mapDbQuestion);
  const qualityMetricMap = new Map<string, QuestionQualityMetric>();
  if (pagedQuestions.length) {
    const metrics = await listQuestionQualityMetrics({
      questionIds: pagedQuestions.map((item) => item.id)
    });
    metrics.forEach((metric) => qualityMetricMap.set(metric.questionId, metric));
  }
  const data = pagedQuestions.map((item) => attachQualityFields(item, qualityMetricMap.get(item.id) ?? null));

  const [subjectFacetRows, gradeFacetRows, chapterFacetRows, difficultyFacetRows, typeFacetRows, treeRows] =
    await Promise.all([
      runDbQuery<DbFacetRow>(
        `SELECT q.subject AS value, COUNT(*)::int AS count ${fromSql} ${whereSql} GROUP BY q.subject ORDER BY 2 DESC, 1 ASC`,
        values
      ),
      runDbQuery<DbFacetRow>(
        `SELECT q.grade AS value, COUNT(*)::int AS count ${fromSql} ${whereSql} GROUP BY q.grade ORDER BY 2 DESC, 1 ASC`,
        values
      ),
      runDbQuery<DbFacetRow>(
        `SELECT COALESCE(kp.chapter, '未分章节') AS value, COUNT(*)::int AS count ${fromSql} ${whereSql} GROUP BY COALESCE(kp.chapter, '未分章节') ORDER BY 2 DESC, 1 ASC`,
        values
      ),
      runDbQuery<DbFacetRow>(
        `SELECT COALESCE(q.difficulty, 'medium') AS value, COUNT(*)::int AS count ${fromSql} ${whereSql} GROUP BY COALESCE(q.difficulty, 'medium') ORDER BY 2 DESC, 1 ASC`,
        values
      ),
      runDbQuery<DbFacetRow>(
        `SELECT COALESCE(q.question_type, 'choice') AS value, COUNT(*)::int AS count ${fromSql} ${whereSql} GROUP BY COALESCE(q.question_type, 'choice') ORDER BY 2 DESC, 1 ASC`,
        values
      ),
      runDbQuery<DbTreeRow>(
        `SELECT q.subject, q.grade, COALESCE(kp.chapter, '未分章节') AS chapter, COUNT(*)::int AS count ${fromSql} ${whereSql} GROUP BY q.subject, q.grade, COALESCE(kp.chapter, '未分章节')`,
        values
      )
    ]);

  const highRiskSql =
    "(qm.risk_level = 'high' OR qm.duplicate_risk = 'high' OR qm.ambiguity_risk = 'high' OR COALESCE(qm.answer_conflict, false) = true)";
  const mediumRiskSql = `NOT ${highRiskSql} AND (qm.risk_level = 'medium' OR qm.duplicate_risk = 'medium' OR qm.ambiguity_risk = 'medium')`;

  const qualitySummaryRows = await runDbQuery<DbQualitySummaryRow>(
    `
      SELECT
        COUNT(qm.question_id)::int AS tracked_count,
        COUNT(*) FILTER (WHERE qm.question_id IS NOT NULL AND COALESCE(qm.isolated, false) = true)::int AS isolated_count,
        COUNT(*) FILTER (WHERE qm.question_id IS NOT NULL AND ${highRiskSql})::int AS high_risk_count,
        COUNT(*) FILTER (WHERE qm.question_id IS NOT NULL AND ${mediumRiskSql})::int AS medium_risk_count,
        COUNT(*) FILTER (WHERE qm.question_id IS NOT NULL AND COALESCE(qm.answer_conflict, false) = true)::int AS answer_conflict_count,
        COUNT(DISTINCT qm.duplicate_cluster_id)::int AS duplicate_cluster_count
      ${fromSql}
      ${whereSql}
    `,
    values
  );

  const topClusterWhere = whereSql
    ? `${whereSql} AND qm.duplicate_cluster_id IS NOT NULL`
    : "WHERE qm.duplicate_cluster_id IS NOT NULL";
  const topDuplicateClusterRows = await runDbQuery<DbTopClusterRow>(
    `
      SELECT
        qm.duplicate_cluster_id AS id,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE COALESCE(qm.isolated, false) = true)::int AS isolated_count,
        COUNT(*) FILTER (WHERE ${highRiskSql})::int AS high_risk_count
      ${fromSql}
      ${topClusterWhere}
      GROUP BY qm.duplicate_cluster_id
      ORDER BY 2 DESC, 4 DESC, 1 ASC
      LIMIT 8
    `,
    values
  );

  const summary = qualitySummaryRows[0];
  return {
    data,
    meta: {
      total,
      page: safePage,
      pageSize: filters.shouldPaginate ? filters.pageSize : total,
      totalPages
    },
    facets: {
      subjects: subjectFacetRows
        .filter((row) => row.value)
        .map((row) => ({ value: row.value ?? "", count: toNumber(row.count) })),
      grades: gradeFacetRows
        .filter((row) => row.value)
        .map((row) => ({ value: row.value ?? "", count: toNumber(row.count) })),
      chapters: chapterFacetRows
        .filter((row) => row.value)
        .map((row) => ({ value: row.value ?? "", count: toNumber(row.count) })),
      difficulties: difficultyFacetRows
        .filter((row) => row.value)
        .map((row) => ({ value: row.value ?? "", count: toNumber(row.count) })),
      questionTypes: typeFacetRows
        .filter((row) => row.value)
        .map((row) => ({ value: row.value ?? "", count: toNumber(row.count) }))
    },
    tree: buildQuestionTree(
      treeRows.map((row) => ({
        subject: row.subject,
        grade: row.grade,
        chapter: row.chapter ?? "未分章节",
        count: toNumber(row.count)
      }))
    ),
    filters: buildResponseFilters(filters),
    qualitySummary: {
      trackedCount: toNumber(summary?.tracked_count),
      isolatedCount: toNumber(summary?.isolated_count),
      highRiskCount: toNumber(summary?.high_risk_count),
      mediumRiskCount: toNumber(summary?.medium_risk_count),
      answerConflictCount: toNumber(summary?.answer_conflict_count),
      duplicateClusterCount: toNumber(summary?.duplicate_cluster_count),
      topDuplicateClusters: topDuplicateClusterRows.map((row) => ({
        id: row.id,
        count: toNumber(row.count),
        isolatedCount: toNumber(row.isolated_count),
        highRiskCount: toNumber(row.high_risk_count)
      }))
    }
  };
}

export const GET = createAdminRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }

    const parsedQuery = parseSearchParams(request, listQuestionsQuerySchema);
    const filters = normalizeFilters(parsedQuery);

    if (isDbEnabled()) {
      return listQuestionsFromDb(filters);
    }

    const [questions, knowledgePoints] = await Promise.all([getQuestions(), getKnowledgePoints()]);
    const chapterByKnowledgePointId = new Map(
      knowledgePoints.map((item) => [item.id, item.chapter || "未分章节"])
    );
    const searchNeedle = filters.search?.toLowerCase();
    const duplicateClusterNeedle = filters.duplicateClusterId?.toLowerCase();

    const filtered = questions.filter((item) => {
      if (filters.subject && item.subject !== filters.subject) return false;
      if (filters.grade && item.grade !== filters.grade) return false;
      if (filters.knowledgePointId && item.knowledgePointId !== filters.knowledgePointId) return false;
      if (filters.difficulty && (item.difficulty ?? "medium") !== filters.difficulty) return false;
      if (filters.questionType && (item.questionType ?? "choice") !== filters.questionType) return false;
      const itemChapter = chapterByKnowledgePointId.get(item.knowledgePointId) ?? "未分章节";
      if (filters.chapter && itemChapter !== filters.chapter) return false;
      if (searchNeedle) {
        const content = [
          item.id,
          item.stem,
          item.answer,
          item.explanation,
          ...(item.tags ?? []),
          ...(item.abilities ?? []),
          itemChapter
        ]
          .join(" ")
          .toLowerCase();
        if (!content.includes(searchNeedle)) return false;
      }
      return true;
    });

    const qualityMetrics = await listQuestionQualityMetrics({
      questionIds: filtered.map((item) => item.id)
    });
    const qualityMetricMap = new Map(qualityMetrics.map((item) => [item.questionId, item]));

    const qualityFiltered = filtered.filter((item) => {
      const metric = qualityMetricMap.get(item.id);
      const isolated = Boolean(metric?.isolated);
      if (filters.pool === "isolated" && !isolated) return false;
      if (filters.pool === "active" && isolated) return false;

      if (filters.riskLevel !== "all" && (metric?.riskLevel ?? "low") !== filters.riskLevel) {
        return false;
      }

      if (filters.answerConflict === "yes" && !metric?.answerConflict) {
        return false;
      }
      if (filters.answerConflict === "no" && Boolean(metric?.answerConflict)) {
        return false;
      }

      if (duplicateClusterNeedle) {
        const cluster = metric?.duplicateClusterId?.toLowerCase() ?? "";
        if (!cluster || !cluster.includes(duplicateClusterNeedle)) {
          return false;
        }
      }
      return true;
    });

    const sorted = qualityFiltered.slice().sort((a, b) => {
      const chapterA = chapterByKnowledgePointId.get(a.knowledgePointId) ?? "未分章节";
      const chapterB = chapterByKnowledgePointId.get(b.knowledgePointId) ?? "未分章节";
      const diffA = a.difficulty ?? "medium";
      const diffB = b.difficulty ?? "medium";
      const typeA = a.questionType ?? "choice";
      const typeB = b.questionType ?? "choice";

      let result = 0;
      if (filters.sortBy === "subject") {
        result = a.subject.localeCompare(b.subject);
      } else if (filters.sortBy === "grade") {
        result = a.grade.localeCompare(b.grade, "zh-Hans-CN", { numeric: true });
      } else if (filters.sortBy === "chapter") {
        result = chapterA.localeCompare(chapterB);
      } else if (filters.sortBy === "difficulty") {
        result = diffA.localeCompare(diffB);
      } else if (filters.sortBy === "questionType") {
        result = typeA.localeCompare(typeB);
      } else {
        result = b.id.localeCompare(a.id);
      }
      return filters.sortDir === "asc" ? result : -result;
    });

    const total = sorted.length;
    const totalPages = filters.shouldPaginate ? Math.max(1, Math.ceil(total / filters.pageSize)) : 1;
    const safePage = filters.shouldPaginate ? Math.min(Math.max(filters.page, 1), totalPages) : 1;
    const start = filters.shouldPaginate ? (safePage - 1) * filters.pageSize : 0;
    const end = filters.shouldPaginate ? start + filters.pageSize : sorted.length;
    const paged = sorted.slice(start, end);

    const data = paged.map((item) => attachQualityFields(item, qualityMetricMap.get(item.id) ?? null));
    const metricsOfSorted = sorted.map((item) => qualityMetricMap.get(item.id)).filter(Boolean);
    const isolatedCount = metricsOfSorted.filter((item) => Boolean(item?.isolated)).length;
    const answerConflictCount = metricsOfSorted.filter((item) => Boolean(item?.answerConflict)).length;
    const highRiskCount = metricsOfSorted.filter((item) => isHighQualityRisk(item)).length;
    const mediumRiskCount = metricsOfSorted.filter((item) => isMediumQualityRisk(item)).length;
    const duplicateClusters = new Map<
      string,
      { id: string; count: number; isolatedCount: number; highRiskCount: number }
    >();
    metricsOfSorted.forEach((metric) => {
      const clusterId = metric?.duplicateClusterId;
      if (!clusterId) return;
      const current = duplicateClusters.get(clusterId) ?? {
        id: clusterId,
        count: 0,
        isolatedCount: 0,
        highRiskCount: 0
      };
      current.count += 1;
      if (metric?.isolated) current.isolatedCount += 1;
      if (isHighQualityRisk(metric)) current.highRiskCount += 1;
      duplicateClusters.set(clusterId, current);
    });
    const topDuplicateClusters = Array.from(duplicateClusters.values())
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if (b.highRiskCount !== a.highRiskCount) return b.highRiskCount - a.highRiskCount;
        return a.id.localeCompare(b.id);
      })
      .slice(0, 8);

    const facetsSource = sorted;
    const subjectFacet = buildFacet(facetsSource.map((item) => item.subject));
    const gradeFacet = buildFacet(facetsSource.map((item) => item.grade));
    const chapterFacet = buildFacet(
      facetsSource.map((item) => chapterByKnowledgePointId.get(item.knowledgePointId) ?? "未分章节")
    );
    const difficultyFacet = buildFacet(facetsSource.map((item) => item.difficulty ?? "medium"));
    const questionTypeFacet = buildFacet(facetsSource.map((item) => item.questionType ?? "choice"));

    const tree = buildQuestionTree(
      facetsSource.map((item) => ({
        subject: item.subject,
        grade: item.grade,
        chapter: chapterByKnowledgePointId.get(item.knowledgePointId) ?? "未分章节",
        count: 1
      }))
    );

    return {
      data,
      meta: {
        total,
        page: safePage,
        pageSize: filters.shouldPaginate ? filters.pageSize : total,
        totalPages
      },
      facets: {
        subjects: subjectFacet,
        grades: gradeFacet,
        chapters: chapterFacet,
        difficulties: difficultyFacet,
        questionTypes: questionTypeFacet
      },
      tree,
      filters: buildResponseFilters(filters),
      qualitySummary: {
        trackedCount: metricsOfSorted.length,
        isolatedCount,
        highRiskCount,
        mediumRiskCount,
        answerConflictCount,
        duplicateClusterCount: duplicateClusters.size,
        topDuplicateClusters
      }
    };
  }
});

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    assertAdminStepUp(user);

    const body = await parseJson(request, createQuestionBodySchema);
    const subject = body.subject?.trim();
    const grade = body.grade?.trim();
    const knowledgePointId = body.knowledgePointId?.trim();
    const stem = body.stem?.trim();
    const answer = body.answer?.trim();
    const explanation = body.explanation?.trim() ?? "";
    const questionType = body.questionType?.trim() || "choice";

    if (!subject || !grade || !knowledgePointId || !stem || !body.options || !answer) {
      badRequest("missing fields");
    }
    if (!isAllowedSubject(subject)) {
      badRequest("invalid subject");
    }
    const difficulty = normalizeDifficulty(body.difficulty);

    const options = trimStringArray(body.options);
    const tags = trimStringArray(body.tags);
    const abilities = trimStringArray(body.abilities);
    const qualityCandidates = await getQuestions();

    const next = await createQuestion({
      subject,
      grade,
      knowledgePointId,
      stem,
      options,
      answer,
      explanation,
      difficulty,
      questionType,
      tags,
      abilities
    });

    const quality = next
      ? await evaluateAndUpsertQuestionQuality({
          question: next,
          candidates: qualityCandidates
        })
      : null;

    if (next) {
      await addAdminLog({
        adminId: user.id,
        action: "create_question",
        entityType: "question",
        entityId: next.id,
        detail: `${next.subject} ${next.grade} ${next.knowledgePointId}`
      });
    }

    return { data: next ? attachQualityFields(next, quality) : null };
  }
});
