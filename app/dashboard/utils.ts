export const DASHBOARD_ALERT_TONE: Record<
  "high" | "medium" | "info",
  { bg: string; border: string; text: string; label: string }
> = {
  high: {
    bg: "rgba(220, 38, 38, 0.08)",
    border: "rgba(220, 38, 38, 0.24)",
    text: "#b42318",
    label: "高优先级"
  },
  medium: {
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(245, 158, 11, 0.22)",
    text: "#b45309",
    label: "建议尽快处理"
  },
  info: {
    bg: "rgba(59, 130, 246, 0.08)",
    border: "rgba(59, 130, 246, 0.2)",
    text: "#1d4ed8",
    label: "提醒"
  }
};

export const DASHBOARD_TIMELINE_ICON = {
  assignment: "board",
  notification: "rocket",
  thread: "puzzle",
  review: "brain"
} as const;
