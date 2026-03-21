export type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

export type RuleItem = {
  id: string;
  classId: string;
  enabled: boolean;
  dueDays: number;
  overdueDays: number;
  includeParents: boolean;
};

export type PreviewAssignment = {
  assignmentId: string;
  title: string;
  dueDate: string;
  stage: "due_soon" | "overdue";
  studentTargets: number;
  parentTargets: number;
};

export type PreviewData = {
  generatedAt: string;
  class: ClassItem;
  rule: RuleItem;
  summary: {
    enabled: boolean;
    assignmentTargets: number;
    dueSoonAssignments: number;
    overdueAssignments: number;
    studentTargets: number;
    parentTargets: number;
    uniqueStudents: number;
  };
  sampleAssignments: PreviewAssignment[];
};

export type HistoryClassResult = {
  classId: string;
  className: string;
  subject: string;
  grade: string;
  rule: RuleItem;
  assignmentTargets: number;
  dueSoonAssignments: number;
  overdueAssignments: number;
  studentTargets: number;
  parentTargets: number;
  uniqueStudents: number;
  sampleAssignments: PreviewAssignment[];
};

export type HistoryItem = {
  id: string;
  executedAt: string;
  totals: {
    classes: number;
    assignmentTargets: number;
    dueSoonAssignments: number;
    overdueAssignments: number;
    studentTargets: number;
    parentTargets: number;
    uniqueStudents: number;
  };
  classResults: HistoryClassResult[];
};

export type HistoryResponse = {
  data?: HistoryItem[];
  summary?: {
    totalRuns?: number;
    lastRunAt?: string | null;
    studentTargets?: number;
    parentTargets?: number;
    assignmentTargets?: number;
  };
};

export type RuleResponse = {
  classes?: ClassItem[];
  rules?: RuleItem[];
};

export type TeacherNotificationLoadStatus = "auth" | "error" | "loaded" | "stale";
