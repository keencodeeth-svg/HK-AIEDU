export type CalendarItemType = "assignment" | "announcement" | "correction" | "lesson";

export type CalendarItem = {
  id: string;
  type: CalendarItemType;
  title: string;
  date: string;
  className?: string;
  status?: string;
  description?: string;
};

export type CalendarResponse = {
  data?: CalendarItem[];
};

export type CalendarRoleAction = {
  href: string;
  label: string;
};
