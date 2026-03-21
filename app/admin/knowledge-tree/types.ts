export type KnowledgePoint = {
  id: string;
  subject: string;
  grade: string;
  title: string;
  chapter: string;
  unit?: string;
};

export type KnowledgePointListPayload = {
  data?: KnowledgePoint[];
  meta?: {
    totalPages?: number;
  };
};

export type KnowledgeTree = Record<
  string,
  Record<string, Record<string, Record<string, KnowledgePoint[]>>>
>;
