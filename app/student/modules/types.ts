export type StudentModule = {
  id: string;
  title: string;
  description?: string;
  assignmentCount: number;
  completedCount: number;
};

export type StudentClassModules = {
  classId: string;
  className: string;
  subject: string;
  grade: string;
  modules: StudentModule[];
};

export type StudentModulesResponse = {
  data?: StudentClassModules[];
};
