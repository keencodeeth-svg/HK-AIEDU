export type NotificationItem = {
  id: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
  readAt?: string;
};

export type ReadFilter = "all" | "unread" | "read";

export type NotificationsResponse = {
  data?: NotificationItem[];
};

export type NotificationMutationResponse = {
  data?: NotificationItem;
};
