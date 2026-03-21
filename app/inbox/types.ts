export type UserSession = {
  id: string;
  role: string;
  name: string;
};

export type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

export type ThreadSummary = {
  id: string;
  subject: string;
  updatedAt: string;
  participants: Array<{ id: string; name: string; role: string }>;
  lastMessage?: { content: string; createdAt: string } | null;
  unreadCount: number;
};

export type ThreadDetail = {
  thread: { id: string; subject: string };
  participants: Array<{ id: string; name: string; role: string }>;
  messages: Array<{ id: string; senderId?: string; content: string; createdAt: string }>;
};

export type InboxDerivedState = {
  activeThread: ThreadSummary | null;
  currentClass: ClassItem | null;
  unreadCount: number;
  filteredThreads: ThreadSummary[];
  hasInboxData: boolean;
  requestedThreadMatched: boolean;
};

export type InboxLoadStatus = "loaded" | "auth" | "error" | "stale" | "empty";
