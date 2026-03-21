export type FilesClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

export type CourseFile = {
  id: string;
  classId: string;
  folder?: string;
  title: string;
  resourceType: "file" | "link";
  fileName?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
  linkUrl?: string;
  createdAt: string;
};

export type AuthMeResponse = {
  user?: {
    role?: string | null;
  } | null;
};

export type ClassListResponse = {
  data?: FilesClassItem[];
};

export type FilesListResponse = {
  data?: CourseFile[];
};

export type FileMutationResponse = {
  data?: CourseFile | CourseFile[];
};

export type FilesLoadResult = {
  errorMessage: string | null;
  hasSuccess: boolean;
  status: "auth" | "empty" | "error" | "loaded" | "stale";
};
