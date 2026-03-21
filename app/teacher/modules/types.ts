export type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

export type ModuleItem = {
  id: string;
  title: string;
  description?: string;
  orderIndex: number;
  parentId?: string | null;
};

export type ModuleResourceType = "file" | "link";

export type ModuleResourceFileLike = {
  name: string;
  type?: string;
  size: number;
};

export type ModuleResourceItem = {
  id: string;
  title: string;
  resourceType: ModuleResourceType;
  linkUrl?: string;
  fileName?: string;
};

export type ModuleResourcePayload = {
  title: string;
  resourceType: ModuleResourceType;
  linkUrl?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
};
