import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  AiQuestionForm,
  KnowledgePoint,
  QuestionFacets,
  QuestionForm,
  QuestionImportItemPayload,
  QuestionListMeta,
  QuestionQualityResultItem,
  QuestionQuery
} from "./types";

export const INITIAL_ADMIN_QUESTIONS_QUERY: QuestionQuery = {
  subject: "all",
  grade: "all",
  chapter: "all",
  difficulty: "all",
  questionType: "all",
  search: "",
  pool: "all",
  riskLevel: "all",
  answerConflict: "all",
  duplicateClusterId: ""
};

export const INITIAL_ADMIN_QUESTIONS_FACETS: QuestionFacets = {
  subjects: [],
  grades: [],
  chapters: [],
  difficulties: [],
  questionTypes: []
};

export const INITIAL_ADMIN_QUESTIONS_META: QuestionListMeta = {
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1
};

export const INITIAL_ADMIN_QUESTION_FORM: QuestionForm = {
  subject: "math",
  grade: "4",
  knowledgePointId: "",
  stem: "",
  options: "",
  answer: "",
  explanation: "",
  difficulty: "medium",
  questionType: "choice",
  tags: "",
  abilities: ""
};

export const INITIAL_ADMIN_AI_QUESTION_FORM: AiQuestionForm = {
  subject: "math",
  grade: "4",
  knowledgePointId: "",
  count: 1,
  difficulty: "medium",
  mode: "single",
  chapter: ""
};

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current.length || row.length) {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current.length || row.length) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

export function parseListText(input: string) {
  return input
    .split(/[,|，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolveAdminQuestionKnowledgePointId(
  knowledgePoints: Array<{ id: string; subject: string; grade: string }>,
  subject: string,
  grade: string,
  knowledgePointId: string
) {
  if (!knowledgePointId) {
    return "";
  }

  return knowledgePoints.some((item) => item.id === knowledgePointId && item.subject === subject && item.grade === grade)
    ? knowledgePointId
    : "";
}

export function filterAdminQuestionsKnowledgePoints(
  knowledgePoints: KnowledgePoint[],
  subject: string,
  grade: string
) {
  return knowledgePoints.filter((item) => item.subject === subject && item.grade === grade);
}

export function getAdminQuestionsChapterOptions(
  knowledgePoints: KnowledgePoint[],
  subject: string,
  grade: string
) {
  const chapters = filterAdminQuestionsKnowledgePoints(knowledgePoints, subject, grade)
    .map((item) => item.chapter)
    .filter(Boolean);
  return Array.from(new Set(chapters));
}

export function getAdminQuestionsPageDerivedState(options: {
  knowledgePoints: KnowledgePoint[];
  form: Pick<QuestionForm, "subject" | "grade">;
  aiForm: Pick<AiQuestionForm, "subject" | "grade">;
  meta: QuestionListMeta;
  knowledgePointsLoadError: string | null;
  questionsLoadError: string | null;
}) {
  const formKnowledgePoints = filterAdminQuestionsKnowledgePoints(
    options.knowledgePoints,
    options.form.subject,
    options.form.grade
  );
  const aiKnowledgePoints = filterAdminQuestionsKnowledgePoints(
    options.knowledgePoints,
    options.aiForm.subject,
    options.aiForm.grade
  );
  const chapterOptions = getAdminQuestionsChapterOptions(
    options.knowledgePoints,
    options.aiForm.subject,
    options.aiForm.grade
  );
  const { start: pageStart, end: pageEnd } = getAdminQuestionsPageRange(options.meta);

  return {
    formKnowledgePoints,
    aiKnowledgePoints,
    chapterOptions,
    loadError: options.questionsLoadError ?? options.knowledgePointsLoadError,
    pageStart,
    pageEnd
  };
}

export function resolveAdminQuestionsFormSelections(options: {
  form: Pick<QuestionForm, "subject" | "grade" | "knowledgePointId">;
  aiForm: Pick<AiQuestionForm, "subject" | "grade" | "knowledgePointId" | "mode" | "chapter">;
  formKnowledgePoints: Array<Pick<KnowledgePoint, "id" | "subject" | "grade">>;
  aiKnowledgePoints: Array<Pick<KnowledgePoint, "id" | "subject" | "grade">>;
  chapterOptions: string[];
}) {
  const nextFormKnowledgePointId =
    resolveAdminQuestionKnowledgePointId(
      options.formKnowledgePoints,
      options.form.subject,
      options.form.grade,
      options.form.knowledgePointId
    ) ||
    options.formKnowledgePoints[0]?.id ||
    "";

  const nextAiKnowledgePointId =
    resolveAdminQuestionKnowledgePointId(
      options.aiKnowledgePoints,
      options.aiForm.subject,
      options.aiForm.grade,
      options.aiForm.knowledgePointId
    ) ||
    options.aiKnowledgePoints[0]?.id ||
    "";

  const nextAiChapter =
    options.aiForm.mode !== "batch"
      ? options.aiForm.chapter
      : options.aiForm.chapter && options.chapterOptions.includes(options.aiForm.chapter)
        ? options.aiForm.chapter
        : options.chapterOptions[0] ?? "";

  return {
    nextFormKnowledgePointId,
    nextAiKnowledgePointId,
    nextAiChapter
  };
}

function getNormalizedAdminQuestionsMessage(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase();
}

export function isAdminQuestionMissingError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getNormalizedAdminQuestionsMessage(error);
  return requestMessage === "question not found" || (status === 404 && requestMessage === "not found");
}

export function isAdminQuestionKnowledgePointSelectionError(error: unknown) {
  const requestMessage = getNormalizedAdminQuestionsMessage(error);
  return requestMessage === "knowledge point not found" || requestMessage === "knowledge point mismatch";
}

export function getAdminQuestionsErrorMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getNormalizedAdminQuestionsMessage(error);

  if (status === 401 || status === 403) {
    return "管理员会话已失效，请重新登录后继续操作。";
  }
  if (requestMessage === "missing fields") {
    return "请填写完整的题目信息后再提交。";
  }
  if (requestMessage === "invalid subject") {
    return "学科参数无效，请刷新页面后重试。";
  }
  if (requestMessage === "items required") {
    return "没有可导入的题目，请检查导入内容后重试。";
  }
  if (requestMessage === "knowledge point not found") {
    return "所选知识点不存在，请刷新知识点列表后重试。";
  }
  if (requestMessage === "knowledge point mismatch") {
    return "所选知识点与当前学科不匹配，请重新选择知识点。";
  }
  if (requestMessage === "no knowledge points") {
    return "当前筛选范围没有可用于生成的知识点，请先创建知识点。";
  }
  if (requestMessage === "questionid required") {
    return "题目标识缺失，请刷新页面后重试。";
  }
  if (requestMessage === "isolated required") {
    return "隔离池状态无效，请刷新页面后重试。";
  }
  if (requestMessage === "question not found" || (status === 404 && requestMessage === "not found")) {
    return "题目不存在，可能已被其他管理员删除。";
  }
  if (requestMessage === "quality metric not found") {
    return "该题目暂无质检记录，请先执行批量重算。";
  }
  if (requestMessage === "no questions matched") {
    return "当前筛选条件下没有可重算的题目。";
  }
  if (requestMessage === "no questions to recheck") {
    return "当前范围内没有可重算的题目，请调整范围后重试。";
  }
  return getRequestErrorMessage(error, fallback);
}

export function buildAdminQuestionsSearchParams(query: QuestionQuery, page: number, pageSize: number) {
  const searchParams = new URLSearchParams();
  if (query.subject !== "all") searchParams.set("subject", query.subject);
  if (query.grade !== "all") searchParams.set("grade", query.grade);
  if (query.chapter !== "all") searchParams.set("chapter", query.chapter);
  if (query.difficulty !== "all") searchParams.set("difficulty", query.difficulty);
  if (query.questionType !== "all") searchParams.set("questionType", query.questionType);
  if (query.search.trim()) searchParams.set("search", query.search.trim());
  if (query.pool !== "all") searchParams.set("pool", query.pool);
  if (query.riskLevel !== "all") searchParams.set("riskLevel", query.riskLevel);
  if (query.answerConflict !== "all") searchParams.set("answerConflict", query.answerConflict);
  if (query.duplicateClusterId.trim()) searchParams.set("duplicateClusterId", query.duplicateClusterId.trim());
  searchParams.set("page", String(page));
  searchParams.set("pageSize", String(pageSize));
  return searchParams;
}

export function buildAdminQuestionsMeta(
  meta: QuestionListMeta | undefined,
  itemCount: number,
  page: number,
  pageSize: number
) {
  return (
    meta ?? {
      total: itemCount,
      page,
      pageSize,
      totalPages: 1
    }
  );
}

export function normalizeAdminQuestionsFacets(
  facets?: Partial<QuestionFacets> | null
): QuestionFacets {
  return {
    subjects: facets?.subjects ?? [],
    grades: facets?.grades ?? [],
    chapters: facets?.chapters ?? [],
    difficulties: facets?.difficulties ?? [],
    questionTypes: facets?.questionTypes ?? []
  };
}

export function isHighRiskQuestionQualityResult(item: QuestionQualityResultItem) {
  return item.duplicateRisk === "high" || item.ambiguityRisk === "high";
}

export function buildQuestionImportItems(
  rows: string[][],
  knowledgePoints: Array<{ id: string; title: string; subject: string }>
) {
  if (rows.length < 2) {
    return {
      items: [] as QuestionImportItemPayload[],
      errors: ["CSV 内容不足"]
    };
  }

  const headers = rows[0].map((header) => header.trim());
  const items: QuestionImportItemPayload[] = [];
  const errors: string[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.length) continue;
    const record: Record<string, string> = {};
    headers.forEach((key, headerIndex) => {
      record[key] = row[headerIndex] ?? "";
    });
    const options = (record.options || "")
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
    const tags = parseListText(record.tags || "");
    const abilities = parseListText(record.abilities || "");
    let knowledgePointId = record.knowledgePointId;
    if (!knowledgePointId && record.knowledgePointTitle) {
      const knowledgePoint = knowledgePoints.find(
        (item) => item.title === record.knowledgePointTitle && item.subject === record.subject
      );
      knowledgePointId = knowledgePoint?.id ?? "";
    }
    if (!knowledgePointId) {
      errors.push(`第 ${index + 1} 行：找不到知识点`);
      continue;
    }
    items.push({
      subject: record.subject,
      grade: record.grade,
      knowledgePointId,
      stem: record.stem,
      options,
      answer: record.answer,
      explanation: record.explanation,
      difficulty: record.difficulty,
      questionType: record.questionType,
      tags,
      abilities
    });
  }

  return { items, errors };
}

export function buildAdminQuestionGenerateRequest(aiForm: AiQuestionForm) {
  const count = aiForm.mode === "batch" ? Math.max(aiForm.count, 10) : aiForm.count;
  return aiForm.mode === "batch"
    ? {
        endpoint: "/api/admin/questions/generate-batch",
        payload: {
          subject: aiForm.subject,
          grade: aiForm.grade,
          count,
          chapter: aiForm.chapter || undefined,
          difficulty: aiForm.difficulty
        }
      }
    : {
        endpoint: "/api/admin/questions/generate",
        payload: {
          subject: aiForm.subject,
          grade: aiForm.grade,
          knowledgePointId: aiForm.knowledgePointId,
          count,
          difficulty: aiForm.difficulty
        }
      };
}

export function buildAdminQuestionCreateRequest(form: QuestionForm) {
  const options = form.options
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const tags = parseListText(form.tags);
  const abilities = parseListText(form.abilities);

  return {
    payload: {
      subject: form.subject,
      grade: form.grade,
      knowledgePointId: form.knowledgePointId,
      stem: form.stem,
      options,
      answer: form.answer,
      explanation: form.explanation,
      difficulty: form.difficulty,
      questionType: form.questionType,
      tags,
      abilities
    },
    nextForm: {
      subject: form.subject,
      grade: form.grade,
      knowledgePointId: form.knowledgePointId,
      stem: "",
      options: "",
      answer: "",
      explanation: "",
      difficulty: form.difficulty,
      questionType: form.questionType,
      tags: "",
      abilities: ""
    } satisfies QuestionForm
  };
}

export function buildAdminQuestionsRecheckPayload(query: QuestionQuery) {
  const payload: Record<string, unknown> = { limit: 1000 };
  if (query.subject !== "all") payload.subject = query.subject;
  if (query.grade !== "all") payload.grade = query.grade;
  if (query.pool === "active") payload.includeIsolated = false;
  return payload;
}

export function formatAdminQuestionsRecheckMessage(data?: {
  scope?: { processedCount?: number };
  summary?: {
    updated?: number;
    newlyTracked?: number;
    highRiskCount?: number;
    isolatedCount?: number;
  };
}) {
  const processedCount = Number(data?.scope?.processedCount ?? 0);
  const updated = Number(data?.summary?.updated ?? 0);
  const newlyTracked = Number(data?.summary?.newlyTracked ?? 0);
  const highRiskCount = Number(data?.summary?.highRiskCount ?? 0);
  const isolatedCount = Number(data?.summary?.isolatedCount ?? 0);
  return `已重算 ${processedCount} 题（新增质检 ${newlyTracked}，变更 ${updated}，高风险 ${highRiskCount}，隔离池 ${isolatedCount}）。`;
}

export function getAdminQuestionsMetaAfterRemoval(meta: QuestionListMeta) {
  const total = Math.max(0, meta.total - 1);
  const totalPages = Math.max(1, Math.ceil(total / Math.max(meta.pageSize, 1)));
  const page = Math.min(meta.page, totalPages);
  return { ...meta, total, totalPages, page };
}

export function getAdminQuestionsPageRange(meta: QuestionListMeta) {
  const start = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const end = meta.total === 0 ? 0 : Math.min(meta.total, meta.page * meta.pageSize);
  return { start, end };
}

export function downloadQuestionTemplate() {
  const header = [
    "subject",
    "grade",
    "knowledgePointId",
    "knowledgePointTitle",
    "stem",
    "options",
    "answer",
    "explanation",
    "difficulty",
    "questionType",
    "tags",
    "abilities"
  ];
  const sample = [
    "math",
    "4",
    "math-g4-fractions-meaning",
    "分数的意义",
    "把一个披萨平均分成 8 份，小明吃了 3 份，吃了几分之几？",
    "1/8|3/8|3/5|8/3",
    "3/8",
    "平均分成 8 份，每份是 1/8，吃了 3 份就是 3/8。",
    "medium",
    "choice",
    "分数|图形",
    "计算|理解"
  ];
  const csv = `${header.join(",")}\n${sample.map((item) => `\"${item}\"`).join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "questions-template.csv";
  link.click();
}
