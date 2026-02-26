import { SUBJECT_OPTIONS } from "@/lib/constants";
import type { Difficulty, Subject } from "@/lib/types";
import { v } from "@/lib/api/validation";

const optionalRawString = v.optional(v.string({ allowEmpty: true, trim: false }));
const optionalRawStringArray = v.optional(v.array(v.string({ allowEmpty: true, trim: false })));

export const ALLOWED_SUBJECTS: Subject[] = SUBJECT_OPTIONS.map((item) => item.value as Subject);
export const ALLOWED_DIFFICULTY: Difficulty[] = ["easy", "medium", "hard"];

export function isAllowedSubject(value: string): value is Subject {
  return ALLOWED_SUBJECTS.includes(value as Subject);
}

export function normalizeDifficulty(value?: string): Difficulty {
  const normalized = value?.trim();
  if (normalized && ALLOWED_DIFFICULTY.includes(normalized as Difficulty)) {
    return normalized as Difficulty;
  }
  return "medium";
}

export function trimStringArray(values?: string[]) {
  return (values ?? []).map((item) => item.trim()).filter(Boolean);
}

export const adminIdParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const createKnowledgePointBodySchema = v.object<{
  subject?: string;
  grade?: string;
  title?: string;
  chapter?: string;
  unit?: string;
}>(
  {
    subject: optionalRawString,
    grade: optionalRawString,
    title: optionalRawString,
    chapter: optionalRawString,
    unit: optionalRawString
  },
  { allowUnknown: false }
);

export const updateKnowledgePointBodySchema = v.object<{
  subject?: string;
  grade?: string;
  title?: string;
  chapter?: string;
  unit?: string;
}>(
  {
    subject: optionalRawString,
    grade: optionalRawString,
    title: optionalRawString,
    chapter: optionalRawString,
    unit: optionalRawString
  },
  { allowUnknown: false }
);

export const generateKnowledgePointBodySchema = v.object<{
  subject?: string;
  grade?: string;
  chapter?: string;
  count?: number;
}>(
  {
    subject: optionalRawString,
    grade: optionalRawString,
    chapter: optionalRawString,
    count: v.optional(v.number({ integer: true, coerce: true }))
  },
  { allowUnknown: false }
);

export const generateKnowledgeTreeBodySchema = v.object<{
  subject?: string;
  grade?: string;
  edition?: string;
  volume?: string;
  unitCount?: number;
}>(
  {
    subject: optionalRawString,
    grade: optionalRawString,
    edition: optionalRawString,
    volume: optionalRawString,
    unitCount: v.optional(v.number({ integer: true, min: 1, max: 20, coerce: true }))
  },
  { allowUnknown: false }
);

export const previewTreeBatchBodySchema = v.object<{
  subjects?: string[];
  grades?: string[];
  edition?: string;
  volume?: string;
  unitCount?: number;
  chaptersPerUnit?: number;
  pointsPerChapter?: number;
}>(
  {
    subjects: optionalRawStringArray,
    grades: optionalRawStringArray,
    edition: optionalRawString,
    volume: optionalRawString,
    unitCount: v.optional(v.number({ integer: true, min: 1, max: 20, coerce: true })),
    chaptersPerUnit: v.optional(v.number({ integer: true, min: 1, max: 10, coerce: true })),
    pointsPerChapter: v.optional(v.number({ integer: true, min: 1, max: 20, coerce: true }))
  },
  { allowUnknown: false }
);

export type ImportTreePointInput = { title?: string };
export type ImportTreeChapterInput = { title?: string; points?: ImportTreePointInput[] };
export type ImportTreeUnitInput = { title?: string; chapters?: ImportTreeChapterInput[] };
export type ImportTreeItemInput = { subject?: string; grade?: string; units?: ImportTreeUnitInput[] };

const importTreePointSchema = v.object<ImportTreePointInput>(
  {
    title: optionalRawString
  },
  { allowUnknown: true }
);

const importTreeChapterSchema = v.object<ImportTreeChapterInput>(
  {
    title: optionalRawString,
    points: v.optional(v.array(importTreePointSchema))
  },
  { allowUnknown: true }
);

const importTreeUnitSchema = v.object<ImportTreeUnitInput>(
  {
    title: optionalRawString,
    chapters: v.optional(v.array(importTreeChapterSchema))
  },
  { allowUnknown: true }
);

const importTreeItemSchema = v.object<ImportTreeItemInput>(
  {
    subject: optionalRawString,
    grade: optionalRawString,
    units: v.optional(v.array(importTreeUnitSchema))
  },
  { allowUnknown: true }
);

export const importTreeBodySchema = v.object<{ items?: ImportTreeItemInput[] }>(
  {
    items: v.optional(v.array(importTreeItemSchema))
  },
  { allowUnknown: false }
);

export const createQuestionBodySchema = v.object<{
  subject?: string;
  grade?: string;
  knowledgePointId?: string;
  stem?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  difficulty?: string;
  questionType?: string;
  tags?: string[];
  abilities?: string[];
}>(
  {
    subject: optionalRawString,
    grade: optionalRawString,
    knowledgePointId: optionalRawString,
    stem: optionalRawString,
    options: optionalRawStringArray,
    answer: optionalRawString,
    explanation: optionalRawString,
    difficulty: optionalRawString,
    questionType: optionalRawString,
    tags: optionalRawStringArray,
    abilities: optionalRawStringArray
  },
  { allowUnknown: false }
);

export const updateQuestionBodySchema = v.object<{
  subject?: string;
  grade?: string;
  knowledgePointId?: string;
  stem?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  difficulty?: Difficulty;
  questionType?: string;
  tags?: string[];
  abilities?: string[];
}>(
  {
    subject: optionalRawString,
    grade: optionalRawString,
    knowledgePointId: optionalRawString,
    stem: optionalRawString,
    options: optionalRawStringArray,
    answer: optionalRawString,
    explanation: optionalRawString,
    difficulty: v.optional(v.enum(["easy", "medium", "hard"] as const)),
    questionType: optionalRawString,
    tags: optionalRawStringArray,
    abilities: optionalRawStringArray
  },
  { allowUnknown: false }
);

export const generateQuestionBodySchema = v.object<{
  subject?: string;
  grade?: string;
  knowledgePointId?: string;
  count?: number;
  difficulty?: string;
}>(
  {
    subject: optionalRawString,
    grade: optionalRawString,
    knowledgePointId: optionalRawString,
    count: v.optional(v.number({ integer: true, coerce: true })),
    difficulty: optionalRawString
  },
  { allowUnknown: false }
);

export const generateBatchBodySchema = v.object<{
  subject?: string;
  grade?: string;
  count?: number;
  chapter?: string;
  difficulty?: string;
}>(
  {
    subject: optionalRawString,
    grade: optionalRawString,
    count: v.optional(v.number({ integer: true, coerce: true })),
    chapter: optionalRawString,
    difficulty: optionalRawString
  },
  { allowUnknown: false }
);

export type QuestionImportItem = {
  subject?: string;
  grade?: string;
  knowledgePointId?: string;
  stem?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  difficulty?: string;
  questionType?: string;
  tags?: string[];
  abilities?: string[];
};

const importQuestionItemSchema = v.object<QuestionImportItem>(
  {
    subject: optionalRawString,
    grade: optionalRawString,
    knowledgePointId: optionalRawString,
    stem: optionalRawString,
    options: optionalRawStringArray,
    answer: optionalRawString,
    explanation: optionalRawString,
    difficulty: optionalRawString,
    questionType: optionalRawString,
    tags: optionalRawStringArray,
    abilities: optionalRawStringArray
  },
  { allowUnknown: true }
);

export const importQuestionBodySchema = v.object<{ items?: QuestionImportItem[] }>(
  {
    items: v.optional(v.array(importQuestionItemSchema))
  },
  { allowUnknown: false }
);

export const questionQualityCheckBodySchema = v.object<{
  questionId?: string;
  subject?: string;
  grade?: string;
  knowledgePointId?: string;
  stem?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
}>(
  {
    questionId: optionalRawString,
    subject: optionalRawString,
    grade: optionalRawString,
    knowledgePointId: optionalRawString,
    stem: optionalRawString,
    options: optionalRawStringArray,
    answer: optionalRawString,
    explanation: optionalRawString
  },
  { allowUnknown: false }
);

export const questionQualityQuerySchema = v.object<{
  questionId?: string;
  subject?: string;
  grade?: string;
  pool?: string;
  limit?: number;
}>(
  {
    questionId: optionalRawString,
    subject: optionalRawString,
    grade: optionalRawString,
    pool: optionalRawString,
    limit: v.optional(v.number({ integer: true, min: 1, max: 300, coerce: true }))
  },
  { allowUnknown: true }
);

export const questionIsolationBodySchema = v.object<{
  questionId?: string;
  isolated?: boolean;
  reason?: string[];
}>(
  {
    questionId: optionalRawString,
    isolated: v.optional(v.boolean()),
    reason: optionalRawStringArray
  },
  { allowUnknown: false }
);

export const adminLogsQuerySchema = v.object<{ limit?: string }>(
  {
    limit: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);
