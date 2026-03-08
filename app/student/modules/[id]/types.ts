export type StudentModuleDetailRecord = {
  id: string;
  classId: string;
  parentId?: string;
  title: string;
  description?: string;
  orderIndex: number;
  createdAt: string;
};

export type StudentModuleClassSummary = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

export type StudentModuleResource = {
  id: string;
  moduleId: string;
  title: string;
  resourceType: "file" | "link";
  fileName?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
  linkUrl?: string;
  createdAt: string;
};

export type StudentModuleAssignment = {
  id: string;
  classId: string;
  moduleId?: string;
  title: string;
  description?: string;
  dueDate: string;
  createdAt: string;
  submissionType?: "quiz" | "upload" | "essay";
  maxUploads?: number;
  gradingFocus?: string;
  status: string;
};

export type StudentModuleDetailData = {
  module: StudentModuleDetailRecord;
  classroom: StudentModuleClassSummary;
  resources: StudentModuleResource[];
  assignments: StudentModuleAssignment[];
};

export type StudentModuleDetailResponse = {
  data?: StudentModuleDetailData;
  error?: string;
};
