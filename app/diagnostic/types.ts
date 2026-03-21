export type DiagnosticQuestion = {
  id: string;
  stem: string;
  options: string[];
  knowledgePointId: string;
};

export type DiagnosticStartResponse = {
  subject?: string;
  grade?: string;
  questions?: DiagnosticQuestion[];
};

export type DiagnosticBreakdownItem = {
  knowledgePointId: string;
  title: string;
  total: number;
  correct: number;
  accuracy: number;
};

export type DiagnosticWrongReasonItem = {
  reason: string;
  count: number;
};

export type DiagnosticResult = {
  total: number;
  correct: number;
  accuracy: number;
  breakdown?: DiagnosticBreakdownItem[];
  wrongReasons?: DiagnosticWrongReasonItem[];
};
