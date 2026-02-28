import { createQuestion, getKnowledgePoints, getQuestions } from "@/lib/content";
import { requireRole } from "@/lib/guard";
import { addAdminLog } from "@/lib/admin-log";
import { badRequest, unauthorized } from "@/lib/api/http";
import {
  attachQualityFields,
  evaluateAndUpsertQuestionQuality,
  listQuestionQualityMetrics
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

const listQuestionsQuerySchema = v.object<{
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
  sortBy?: "updatedAt" | "subject" | "grade" | "chapter" | "difficulty" | "questionType";
  sortDir?: "asc" | "desc";
}>(
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

function normalizeQueryString(value?: string) {
  const next = value?.trim();
  return next ? next : undefined;
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

type QuestionTreeNode = {
  subject: string;
  count: number;
  grades: Array<{
    grade: string;
    count: number;
    chapters: Array<{ chapter: string; count: number }>;
  }>;
};

export const GET = createAdminRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }

  const query = parseSearchParams(request, listQuestionsQuerySchema);
  const subject = normalizeQueryString(query.subject);
  const grade = normalizeQueryString(query.grade);
  const chapter = normalizeQueryString(query.chapter);
  const knowledgePointId = normalizeQueryString(query.knowledgePointId);
  const difficulty = normalizeQueryString(query.difficulty);
  const questionType = normalizeQueryString(query.questionType);
  const search = normalizeQueryString(query.search)?.toLowerCase();
  const pool = query.pool ?? "all";
  const riskLevel = query.riskLevel ?? "all";
  const answerConflict = query.answerConflict ?? "all";
  const duplicateClusterId = normalizeQueryString(query.duplicateClusterId)?.toLowerCase();
  const sortBy = query.sortBy ?? "updatedAt";
  const sortDir = query.sortDir ?? "desc";
  const shouldPaginate = query.page !== undefined || query.pageSize !== undefined;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 30;

  const [questions, knowledgePoints] = await Promise.all([getQuestions(), getKnowledgePoints()]);
  const chapterByKnowledgePointId = new Map(
    knowledgePoints.map((item) => [item.id, item.chapter || "未分章节"])
  );

  const filtered = questions.filter((item) => {
    if (subject && item.subject !== subject) return false;
    if (grade && item.grade !== grade) return false;
    if (knowledgePointId && item.knowledgePointId !== knowledgePointId) return false;
    if (difficulty && (item.difficulty ?? "medium") !== difficulty) return false;
    if (questionType && (item.questionType ?? "choice") !== questionType) return false;
    const itemChapter = chapterByKnowledgePointId.get(item.knowledgePointId) ?? "未分章节";
    if (chapter && itemChapter !== chapter) return false;
    if (search) {
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
      if (!content.includes(search)) return false;
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
    if (pool === "isolated" && !isolated) return false;
    if (pool === "active" && isolated) return false;

    if (riskLevel !== "all" && (metric?.riskLevel ?? "low") !== riskLevel) {
      return false;
    }

    if (answerConflict === "yes" && !metric?.answerConflict) {
      return false;
    }
    if (answerConflict === "no" && Boolean(metric?.answerConflict)) {
      return false;
    }

    if (duplicateClusterId) {
      const cluster = metric?.duplicateClusterId?.toLowerCase() ?? "";
      if (!cluster || !cluster.includes(duplicateClusterId)) {
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
    if (sortBy === "subject") {
      result = a.subject.localeCompare(b.subject);
    } else if (sortBy === "grade") {
      result = a.grade.localeCompare(b.grade, "zh-Hans-CN", { numeric: true });
    } else if (sortBy === "chapter") {
      result = chapterA.localeCompare(chapterB);
    } else if (sortBy === "difficulty") {
      result = diffA.localeCompare(diffB);
    } else if (sortBy === "questionType") {
      result = typeA.localeCompare(typeB);
    } else {
      result = b.id.localeCompare(a.id);
    }
    return sortDir === "asc" ? result : -result;
  });

  const total = sorted.length;
  const totalPages = shouldPaginate ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const safePage = shouldPaginate ? Math.min(Math.max(page, 1), totalPages) : 1;
  const start = shouldPaginate ? (safePage - 1) * pageSize : 0;
  const end = shouldPaginate ? start + pageSize : sorted.length;
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

  const treeMap = new Map<string, QuestionTreeNode>();
  facetsSource.forEach((item) => {
    const chapterValue = chapterByKnowledgePointId.get(item.knowledgePointId) ?? "未分章节";
    const subjectNode =
      treeMap.get(item.subject) ??
      ({
        subject: item.subject,
        count: 0,
        grades: []
      } as QuestionTreeNode);
    subjectNode.count += 1;

    let gradeNode = subjectNode.grades.find((entry) => entry.grade === item.grade);
    if (!gradeNode) {
      gradeNode = { grade: item.grade, count: 0, chapters: [] };
      subjectNode.grades.push(gradeNode);
    }
    gradeNode.count += 1;

    const chapterNode = gradeNode.chapters.find((entry) => entry.chapter === chapterValue);
    if (chapterNode) {
      chapterNode.count += 1;
    } else {
      gradeNode.chapters.push({ chapter: chapterValue, count: 1 });
    }

    treeMap.set(item.subject, subjectNode);
  });

  const tree = Array.from(treeMap.values())
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

    return {
      data,
      meta: {
        total,
        page: safePage,
        pageSize: shouldPaginate ? pageSize : total,
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
      filters: {
        subject: subject ?? null,
        grade: grade ?? null,
        chapter: chapter ?? null,
        knowledgePointId: knowledgePointId ?? null,
        difficulty: difficulty ?? null,
        questionType: questionType ?? null,
        search: search ?? null,
        pool,
        riskLevel,
        answerConflict,
        duplicateClusterId: duplicateClusterId ?? null,
        sortBy,
        sortDir
      },
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
