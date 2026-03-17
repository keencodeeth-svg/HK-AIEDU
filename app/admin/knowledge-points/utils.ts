import { GRADE_OPTIONS, SUBJECT_OPTIONS } from "@/lib/constants";
import type {
  AiKnowledgePointForm,
  BatchForm,
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
