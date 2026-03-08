export type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  studentCount: number;
  assignmentCount: number;
  joinCode?: string;
  joinMode?: "approval" | "auto";
};

export type AssignmentItem = {
  id: string;
  classId: string;
  className: string;
  classSubject: string;
  classGrade: string;
  moduleTitle?: string;
  title: string;
  dueDate: string;
  total: number;
  completed: number;
  submissionType?: "quiz" | "upload" | "essay";
};

export type KnowledgePoint = {
  id: string;
  subject: string;
  grade: string;
  title: string;
  chapter: string;
  unit?: string;
};

export type AlertImpactData = {
  alertId: string;
  impact: {
    tracked: boolean;
    trackedAt: string | null;
    elapsedHours: number;
    deltas: {
      riskScore: number | null;
    };
    windows: {
      h24: { ready: boolean; remainingHours: number; riskDelta: number | null };
      h72: { ready: boolean; remainingHours: number; riskDelta: number | null };
    };
  };
};

export type TeacherAlertActionType = "assign_review" | "notify_student" | "auto_chain";
export type TeacherAlertType = "student-risk" | "knowledge-risk";

export type TeacherAlertItem = {
  id: string;
  type: TeacherAlertType;
  classId: string;
  className: string;
  subject: string;
  grade: string;
  riskScore: number;
  riskReason: string;
  recommendedAction: string;
  status: "active" | "acknowledged";
  lastActionType?: TeacherAlertActionType | "mark_done" | null;
  lastActionAt?: string | null;
  lastActionDetail?: string | null;
};

export type TeacherWeakPoint = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  ratio: number;
  total: number;
};

export type TeacherRiskClass = {
  classId: string;
  className: string;
  subject: string;
  grade: string;
  riskScore: number;
  riskStudentCount: number;
  highRiskStudentCount: number;
  riskReason: string;
  recommendedAction: string;
};

export type TeacherRiskStudent = {
  id: string;
  name: string;
  email: string;
  classId: string;
  className: string;
  subject: string;
  grade: string;
  riskScore: number;
  riskReason: string;
  recommendedAction: string;
  recentAccuracy: number;
  recentAttempts: number;
  overdueAssignments: number;
  overdueReviews: number;
  dueTodayReviews: number;
};

export type TeacherRiskKnowledgePoint = {
  id: string;
  title: string;
  classId: string;
  className: string;
  subject: string;
  grade: string;
  ratio: number;
  total: number;
  riskScore: number;
  riskReason: string;
  recommendedAction: string;
};

export type TeacherParentCollaborationSummary = {
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

export type TeacherInsightsSummary = {
  classes: number;
  students: number;
  assignments: number;
  completionRate: number;
  accuracy: number;
  classRiskScore: number;
  activeAlerts: number;
  highRiskAlerts: number;
  parentCollaboration: TeacherParentCollaborationSummary;
};

export type TeacherInsightsData = {
  summary: TeacherInsightsSummary;
  weakPoints: TeacherWeakPoint[];
  riskClasses: TeacherRiskClass[];
  riskStudents: TeacherRiskStudent[];
  riskKnowledgePoints: TeacherRiskKnowledgePoint[];
  alerts: TeacherAlertItem[];
};

export type TeacherJoinRequest = {
  id: string;
  classId: string;
  studentId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string | null;
  className: string;
  subject: string;
  grade: string;
  studentName: string;
  studentEmail: string;
};

export type ClassFormState = {
  name: string;
  subject: string;
  grade: string;
};

export type StudentFormState = {
  classId: string;
  email: string;
};

export type AssignmentFormState = {
  classId: string;
  moduleId: string;
  title: string;
  description: string;
  dueDate: string;
  questionCount: number;
  knowledgePointId: string;
  mode: string;
  difficulty: string;
  questionType: string;
  submissionType: "quiz" | "upload" | "essay";
  maxUploads: number;
  gradingFocus: string;
};
