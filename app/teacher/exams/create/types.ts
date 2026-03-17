export type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

export type ClassStudent = {
  id: string;
  name: string;
  email: string;
  grade?: string;
};

export type KnowledgePoint = {
  id: string;
  subject: string;
  grade: string;
  title: string;
  chapter: string;
  unit?: string;
};

export type StageTrailItem = {
  stage: string;
  label: string;
  totalPoolCount: number;
  activePoolCount: number;
  isolatedExcludedCount: number;
};

export type PublishMode = "teacher_assigned" | "targeted";
export type AntiCheatLevel = "off" | "basic";
export type Difficulty = "easy" | "medium" | "hard";
export type StatusTone = "error" | "info" | "success";

export type FormState = {
  classId: string;
  title: string;
  description: string;
  publishMode: PublishMode;
  antiCheatLevel: AntiCheatLevel;
  studentIds: string[];
  startAt: string;
  endAt: string;
  durationMinutes: number;
  questionCount: number;
  knowledgePointId: string;
  difficulty: Difficulty;
  questionType: string;
  includeIsolated: boolean;
};

export type ScheduleStatus = {
  tone: StatusTone;
  title: string;
  description: string;
  summary: string;
  meta: string;
  canSubmit: boolean;
};

export type PoolRisk = {
  tone: StatusTone;
  label: string;
  title: string;
  description: string;
  meta: string;
};
