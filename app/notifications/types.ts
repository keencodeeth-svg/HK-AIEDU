export type NotificationItem = {
  id: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
  readAt?: string;
};

export type ReadFilter = "all" | "unread" | "read";
export type NotificationLoadMode = "initial" | "refresh";
export type NotificationLoadStatus = "ok" | "auth" | "error" | "stale";

export type NotificationsResponse = {
  data?: NotificationItem[];
};

export type NotificationMutationResponse = {
  data?: NotificationItem;
};
