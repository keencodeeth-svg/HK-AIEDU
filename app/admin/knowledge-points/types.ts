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
  meta?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
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
