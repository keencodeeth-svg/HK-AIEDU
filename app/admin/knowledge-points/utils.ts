import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import { GRADE_OPTIONS, SUBJECT_LABELS, SUBJECT_OPTIONS } from "@/lib/constants";
import type {
  AiKnowledgePointForm,
  BatchForm,
  KnowledgePoint,
  KnowledgePointBatchPreviewFailedItem,
  KnowledgePointBatchPreviewItem,
  KnowledgePointFacets,
  KnowledgePointListMeta,
  KnowledgePointQuery,
  KnowledgePointForm,
  TreeForm
} from "./types";

export const PREVIEW_COMBO_CHUNK_SIZE = 4;
export const IMPORT_ITEMS_CHUNK_SIZE = 4;

export function createInitialKnowledgePointQuery(): KnowledgePointQuery {
  return {
    subject: "all",
    grade: "all",
    unit: "all",
    chapter: "all",
    search: ""
  };
}

export function createInitialKnowledgePointMeta(): KnowledgePointListMeta {
  return {
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1
  };
}

export function createInitialKnowledgePointFacets(): KnowledgePointFacets {
  return {
    subjects: [],
    grades: [],
    units: [],
    chapters: []
  };
}

export function createInitialKnowledgePointForm(): KnowledgePointForm {
  return {
    subject: "math",
    grade: "4",
    unit: "",
    title: "",
    chapter: ""
  };
}

export function createInitialAiKnowledgePointForm(): AiKnowledgePointForm {
  return {
    subject: "math",
    grade: "4",
    chapter: "",
    count: 5
  };
}

export function createInitialTreeForm(): TreeForm {
  return {
    subject: "math",
    grade: "4",
    edition: "人教版",
    volume: "上册",
    unitCount: 6
  };
}

export function createInitialBatchForm(): BatchForm {
  return {
    subjects: SUBJECT_OPTIONS.map((item) => item.value),
    grades: GRADE_OPTIONS.map((item) => item.value),
    edition: "人教版",
    volume: "上册",
    unitCount: 6,
    chaptersPerUnit: 2,
    pointsPerChapter: 4
  };
}

export function chunkArray<T>(items: T[], size: number) {
  const safeSize = Math.max(1, Math.floor(size));
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += safeSize) {
    chunks.push(items.slice(index, index + safeSize));
  }
  return chunks;
}

export function buildBatchCombos(subjects: string[], grades: string[]) {
  const normalizedSubjects = subjects.map((item) => item.trim()).filter(Boolean);
  const normalizedGrades = grades.map((item) => item.trim()).filter(Boolean);
  const combos: Array<{ subject: string; grade: string }> = [];

  normalizedSubjects.forEach((subject) => {
    normalizedGrades.forEach((grade) => {
      combos.push({ subject, grade });
    });
  });

  return combos;
}

function getNormalizedKnowledgePointsMessage(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase();
}

export function isKnowledgePointMissingError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getNormalizedKnowledgePointsMessage(error);
  return status === 404 && requestMessage === "not found";
}

export function getAdminKnowledgePointsErrorMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getNormalizedKnowledgePointsMessage(error);

  if (status === 401 || status === 403) {
    return "管理员会话已失效，请重新登录后继续操作。";
  }
  if (requestMessage === "missing fields") {
    return "请填写完整的知识点信息后再提交。";
  }
  if (requestMessage === "invalid subject") {
    return "学科参数无效，请刷新页面后重试。";
  }
  if (requestMessage === "subjects and grades required") {
    return "请至少选择 1 个学科和 1 个年级。";
  }
  if (requestMessage === "invalid subjects") {
    return "所选学科无效，请调整批量组合后重试。";
  }
  if (requestMessage === "items required") {
    return "没有可导入的知识树内容，请先生成预览后再入库。";
  }
  if (isKnowledgePointMissingError(error)) {
    return "知识点不存在，可能已被其他管理员删除。";
  }
  return getRequestErrorMessage(error, fallback);
}

export function buildAdminKnowledgePointsSearchParams(query: KnowledgePointQuery, page: number, pageSize: number) {
  const searchParams = new URLSearchParams();
  if (query.subject !== "all") searchParams.set("subject", query.subject);
  if (query.grade !== "all") searchParams.set("grade", query.grade);
  if (query.unit !== "all") searchParams.set("unit", query.unit);
  if (query.chapter !== "all") searchParams.set("chapter", query.chapter);
  if (query.search.trim()) searchParams.set("search", query.search.trim());
  searchParams.set("page", String(page));
  searchParams.set("pageSize", String(pageSize));
  return searchParams;
}

export function resolveKnowledgePointChapterOptions(
  knowledgePoints: KnowledgePoint[],
  subject: string,
  grade: string
) {
  const chapters = knowledgePoints
    .filter((knowledgePoint) => knowledgePoint.subject === subject && knowledgePoint.grade === grade)
    .map((knowledgePoint) => knowledgePoint.chapter)
    .filter((chapter): chapter is string => Boolean(chapter));
  return Array.from(new Set(chapters));
}

export function resolveKnowledgePointChapter(chapterOptions: string[], chapter: string) {
  if (!chapterOptions.length) {
    return "";
  }
  return chapterOptions.includes(chapter) ? chapter : chapterOptions[0];
}

export function getAdminKnowledgePointsDerivedState({
  allKnowledgePoints,
  aiForm,
  meta,
  allKnowledgePointsLoadError,
  knowledgePointListLoadError
}: {
  allKnowledgePoints: KnowledgePoint[];
  aiForm: AiKnowledgePointForm;
  meta: KnowledgePointListMeta;
  allKnowledgePointsLoadError: string | null;
  knowledgePointListLoadError: string | null;
}) {
  const chapterOptions = resolveKnowledgePointChapterOptions(
    allKnowledgePoints,
    aiForm.subject,
    aiForm.grade
  );

  return {
    chapterOptions,
    resolvedAiChapter: resolveKnowledgePointChapter(chapterOptions, aiForm.chapter),
    loadError: knowledgePointListLoadError ?? allKnowledgePointsLoadError,
    pageStart: meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1,
    pageEnd: meta.total === 0 ? 0 : Math.min(meta.total, meta.page * meta.pageSize)
  };
}

export function mergeKnowledgePointBatchPreviewItems(items: KnowledgePointBatchPreviewItem[]) {
  const itemMap = new Map<string, KnowledgePointBatchPreviewItem>();
  items.forEach((item) => {
    itemMap.set(`${item.subject}|${item.grade}`, item);
  });
  return Array.from(itemMap.values());
}

export function formatKnowledgePointBatchPreviewError(failed: KnowledgePointBatchPreviewFailedItem[]) {
  if (!failed.length) {
    return null;
  }

  return failed
    .slice(0, 16)
    .map((item) => `${SUBJECT_LABELS[item.subject] ?? item.subject}${item.grade}年级：${item.reason}`)
    .join("；");
}

export function removeKnowledgePointSnapshot(
  list: KnowledgePoint[],
  allKnowledgePoints: KnowledgePoint[],
  meta: KnowledgePointListMeta,
  knowledgePointId: string
) {
  const nextList = list.filter((item) => item.id !== knowledgePointId);
  const nextAllKnowledgePoints = allKnowledgePoints.filter((item) => item.id !== knowledgePointId);
  if (nextList.length === list.length) {
    return {
      list,
      allKnowledgePoints: nextAllKnowledgePoints,
      meta
    };
  }

  const total = Math.max(0, meta.total - 1);
  const totalPages = Math.max(1, Math.ceil(total / Math.max(meta.pageSize, 1)));
  const page = Math.min(meta.page, totalPages);

  return {
    list: nextList,
    allKnowledgePoints: nextAllKnowledgePoints,
    meta: { ...meta, total, totalPages, page }
  };
}
