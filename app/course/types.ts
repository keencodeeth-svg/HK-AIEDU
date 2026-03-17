export type CourseClass = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

export type Syllabus = {
  summary: string;
  objectives: string;
  gradingPolicy: string;
  scheduleText: string;
  updatedAt?: string;
};

export type CourseSummary = {
  moduleCount: number;
  resourceCount: number;
  upcomingAssignments: Array<{
    id: string;
    title: string;
    dueDate: string;
    submissionType: string;
  }>;
};

export type CourseAuthResponse = {
  user?: {
    role?: string | null;
  } | null;
};

export type CourseClassesResponse = {
  data?: CourseClass[];
};

export type CourseSyllabusResponse = {
  data?: Syllabus | null;
};

export type CourseSummaryResponse = {
  summary?: CourseSummary | null;
};
