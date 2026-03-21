import type {
  STUDENT_EYESIGHT_LEVEL_LABELS,
  STUDENT_FOCUS_SUPPORT_LABELS,
  STUDENT_GENDER_LABELS,
  STUDENT_PEER_SUPPORT_LABELS,
  STUDENT_PERSONALITY_LABELS,
  STUDENT_SEAT_PREFERENCE_LABELS
} from "@/lib/student-persona-options";
import type { SeatCell } from "@/lib/seat-plan-utils";

export type TeacherClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

export type TeacherSeatingStudent = {
  id: string;
  name: string;
  email: string;
  grade?: string;
  preferredName?: string;
  gender?: keyof typeof STUDENT_GENDER_LABELS;
  heightCm?: number;
  eyesightLevel?: keyof typeof STUDENT_EYESIGHT_LEVEL_LABELS;
  seatPreference?: keyof typeof STUDENT_SEAT_PREFERENCE_LABELS;
  personality?: keyof typeof STUDENT_PERSONALITY_LABELS;
  focusSupport?: keyof typeof STUDENT_FOCUS_SUPPORT_LABELS;
  peerSupport?: keyof typeof STUDENT_PEER_SUPPORT_LABELS;
  strengths?: string;
  supportNotes?: string;
  completed: number;
  pending: number;
  overdue: number;
  late: number;
  avgScore: number;
  placementScore: number;
  scoreSource: "quiz" | "completion";
  performanceBand: "high" | "medium" | "low";
  profileCompleteness: number;
  missingProfileFields: string[];
  tags: string[];
};

export type SeatPlan = {
  id: string;
  classId: string;
  teacherId: string;
  rows: number;
  columns: number;
  seats: SeatCell[];
  generatedBy: "manual" | "ai";
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlanSummary = {
  studentCount: number;
  seatCapacity: number;
  assignedCount: number;
  unassignedCount: number;
  occupancyRate: number;
  frontPriorityStudentCount: number;
  frontPrioritySatisfiedCount: number;
  focusPriorityStudentCount: number;
  focusPrioritySatisfiedCount: number;
  scoreComplementPairCount: number;
  mixedGenderPairCount: number;
  lowCompletenessCount: number;
  inferredScoreCount: number;
  lockedSeatCount: number;
};

export type SeatingResponse = {
  data?: {
    classes?: TeacherClassItem[];
    class?: TeacherClassItem | null;
    students?: TeacherSeatingStudent[];
    savedPlan?: SeatPlan | null;
    plan?: SeatPlan | null;
    recommendedLayout?: { rows: number; columns: number } | null;
    summary?: PlanSummary | null;
  };
};

export type AiPreviewResponse = {
  data?: {
    class?: TeacherClassItem | null;
    students?: TeacherSeatingStudent[];
    plan?: SeatPlan;
    summary?: PlanSummary;
    warnings?: string[];
    insights?: string[];
  };
};

export type TeacherSeatingDerivedState = {
  lockedSeats: Array<SeatCell & { studentId: string }>;
  draftSummary: PlanSummary | null;
  previewPlan: SeatPlan | null;
  previewSummary: PlanSummary | null;
  previewWarnings: string[];
  previewInsights: string[];
  studentMap: Map<string, TeacherSeatingStudent>;
  unassignedStudents: TeacherSeatingStudent[];
  roster: TeacherSeatingStudent[];
  studentsNeedingProfileReminder: TeacherSeatingStudent[];
  watchStudents: TeacherSeatingStudent[];
  classLabel: string;
  followUpChecklist: string;
  semesterReplanReasons: string[];
  semesterStatus: "待初始化" | "建议重排" | "本学期稳定";
  semesterStatusTone: string;
  frontRowCount: number;
};

export type FollowUpActionResponse = {
  students?: number;
  parents?: number;
  recipients?: Array<{
    studentId: string;
    displayName: string;
    missingFields: string[];
  }>;
};

export type AiOptions = {
  balanceGender: boolean;
  pairByScoreComplement: boolean;
  respectHeightGradient: boolean;
};
