export type KnowledgePoint = {
  id: string;
  subject: string;
  grade: string;
  title: string;
  chapter: string;
  unit?: string;
};

export type FacetItem = { value: string; count: number };

export type KnowledgePointTreeNode = {
  subject: string;
  count: number;
  grades: Array<{
    grade: string;
    count: number;
    units: Array<{ unit: string; count: number }>;
  }>;
};

export type KnowledgePointListPayload = {
  data?: KnowledgePoint[];
  meta?: KnowledgePointListMeta;
  facets?: {
    subjects?: FacetItem[];
    grades?: FacetItem[];
    units?: FacetItem[];
    chapters?: FacetItem[];
  };
  tree?: KnowledgePointTreeNode[];
};

export type KnowledgePointQuery = {
  subject: string;
  grade: string;
  unit: string;
  chapter: string;
  search: string;
};

export type KnowledgePointListMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type KnowledgePointForm = {
  subject: string;
  grade: string;
  unit: string;
  title: string;
  chapter: string;
};

export type AiKnowledgePointForm = {
  subject: string;
  grade: string;
  chapter: string;
  count: number;
};

export type TreeForm = {
  subject: string;
  grade: string;
  edition: string;
  volume: string;
  unitCount: number;
};

export type BatchForm = {
  subjects: string[];
  grades: string[];
  edition: string;
  volume: string;
  unitCount: number;
  chaptersPerUnit: number;
  pointsPerChapter: number;
};

export type KnowledgePointFacets = {
  subjects: FacetItem[];
  grades: FacetItem[];
  units: FacetItem[];
  chapters: FacetItem[];
};


export type KnowledgePointProcessFailedItem = {
  index: number;
  reason: string;
};

export type KnowledgePointBatchPreviewFailedItem = {
  subject: string;
  grade: string;
  reason: string;
};

export type KnowledgePointTreePreviewPoint = {
  title: string;
};

export type KnowledgePointTreePreviewChapter = {
  title: string;
  points: KnowledgePointTreePreviewPoint[];
};

export type KnowledgePointTreePreviewUnit = {
  title: string;
  chapters: KnowledgePointTreePreviewChapter[];
};

export type KnowledgePointBatchPreviewItem = {
  subject: string;
  grade: string;
  units: KnowledgePointTreePreviewUnit[];
};

export type KnowledgePointMutationResponse = {
  created?: Array<{ id: string }>;
  skipped?: KnowledgePointProcessFailedItem[];
  error?: string;
};

export type KnowledgePointBatchPreviewResponse = {
  items?: KnowledgePointBatchPreviewItem[];
  failed?: KnowledgePointBatchPreviewFailedItem[];
  summary?: {
    requested: number;
    generated: number;
    failed: number;
  };
  error?: string;
};
