export type AnalysisAlertKind = "student-risk" | "knowledge-risk";
export type TeacherAlertActionType = "assign_review" | "notify_student" | "auto_chain";
export type AnalysisActionType = TeacherAlertActionType | "mark_done";

export type AnalysisClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

export type AnalysisHeatItem = {
  id: string;
  title: string;
  chapter: string;
  unit?: string;
  subject: string;
  grade: string;
  ratio: number;
  total: number;
};

export type AnalysisStudentItem = {
  id: string;
  name: string;
  email: string;
  grade?: string;
};

export type AnalysisFavoriteItem = {
  id: string;
  tags: string[];
  question?: {
    stem: string;
    knowledgePointTitle: string;
    grade: string;
  } | null;
};

export type AnalysisAlertItem = {
  id: string;
  type: AnalysisAlertKind;
  classId: string;
  className: string;
  subject: string;
  grade: string;
  riskScore: number;
  riskReason: string;
  recommendedAction: string;
  status: "active" | "acknowledged";
  lastActionType?: AnalysisActionType | null;
  lastActionAt?: string | null;
  lastActionDetail?: string | null;
};

export type AnalysisAlertSummary = {
  classRiskScore: number;
  totalAlerts: number;
  activeAlerts: number;
  acknowledgedAlerts: number;
  highRiskAlerts: number;
};

export type AnalysisParentCollaborationSummary = {
  totalParentCount: number;
  activeParentCount7d: number;
  coveredStudentCount: number;
  receiptCount: number;
  doneMinutes: number;
  doneRate: number;
  last7dDoneRate: number;
  avgEffectScore: number;
  sourceDoneRate: {
    weeklyReport: number;
    assignmentPlan: number;
  };
};

export type AnalysisAlertImpactWindow = {
  hours: number;
  ready: boolean;
  dueAt: string | null;
  remainingHours: number;
  riskDelta: number | null;
  riskDeltaRate: number | null;
  improved: boolean | null;
};

export type AnalysisAlertImpactData = {
  alertId: string;
  impact: {
    tracked: boolean;
    actionId: string | null;
    trackedAt: string | null;
    elapsedHours: number;
    deltas: {
      riskScore: number | null;
      metricDeltas: Record<string, number>;
    };
    windows: {
      h24: AnalysisAlertImpactWindow;
      h72: AnalysisAlertImpactWindow;
    };
  };
};

export type AnalysisInterventionCausalityItem = {
  actionId: string;
  alertId: string;
  actionType: AnalysisActionType;
  classId: string;
  className: string;
  subject: string;
  grade: string;
  alertType: AnalysisAlertKind;
  riskScore: number | null;
  riskReason: string;
  recommendedAction: string;
  createdAt: string;
  targetStudents: number;
  executedStudents: number;
  executionRate: number;
  assignmentExecutionCount: number;
  reviewExecutionCount: number;
  parentLinkedStudents: number;
  parentExecutedStudents: number;
  parentExecutionRate: number;
  parentReceiptDoneCount: number;
  parentReceiptSkippedCount: number;
  parentEffectScore: number;
  preAccuracy: number | null;
  postAccuracy: number | null;
  scoreDelta: number | null;
  preAttemptCount: number;
  postAttemptCount: number;
};

export type AnalysisInterventionCausalityByActionTypeItem = {
  actionType: AnalysisActionType;
  actionCount: number;
  avgExecutionRate: number;
  avgScoreDelta: number;
  improvedActionCount: number;
  avgParentExecutionRate: number;
  parentInvolvedActionCount: number;
  avgParentEffectScore: number;
};

export type AnalysisInterventionCausalitySummary = {
  actionCount: number;
  classCount: number;
  avgExecutionRate: number;
  avgScoreDelta: number;
  improvedActionCount: number;
  evidenceReadyCount: number;
  evidenceReadyRate: number;
  parentInvolvedActionCount: number;
  avgParentExecutionRate: number;
  avgParentEffectScore: number;
  withParentAvgScoreDelta: number | null;
  withoutParentAvgScoreDelta: number | null;
  parentDeltaGap: number | null;
  byAlertType: {
    studentRiskActionCount: number;
    knowledgeRiskActionCount: number;
  };
  byActionType: AnalysisInterventionCausalityByActionTypeItem[];
};

export type AnalysisReportData = {
  classId: string;
  summary: {
    classes: number;
    students: number;
    assignments: number;
    completionRate: number;
    accuracy: number;
  };
  weakPoints: Array<{
    id: string;
    title: string;
    ratio: number;
    total: number;
  }>;
  report: {
    report: string;
    highlights: string[];
    reminders: string[];
  } | null;
};
