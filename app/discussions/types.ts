export type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

export type Topic = {
  id: string;
  classId: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
};

export type Reply = {
  id: string;
  content: string;
  createdAt: string;
  authorId?: string;
  authorName?: string;
};

export type CurrentUser = {
  id: string;
  role: string;
  name?: string;
};

export type AuthMeResponse = {
  user?: CurrentUser;
  data?: {
    user?: CurrentUser;
  };
};

export type ClassesResponse = {
  data?: ClassItem[];
};

export type TopicsResponse = {
  data?: Topic[];
};

export type TopicDetailResponse = {
  topic?: Topic;
  replies?: Reply[];
};

export type DiscussionStageCopy = {
  title: string;
  description: string;
};

export type DiscussionsDerivedState = {
  teacherMode: boolean;
  currentClass: ClassItem | null;
  pinnedTopicCount: number;
  filteredTopics: Topic[];
  hasTopicFilters: boolean;
  stageCopy: DiscussionStageCopy;
  hasDiscussionData: boolean;
};

export type DiscussionLoadStatus = "loaded" | "auth" | "error" | "stale" | "empty";
