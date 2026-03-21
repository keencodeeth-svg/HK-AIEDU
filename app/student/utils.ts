import type { ScheduleResponse } from "@/lib/class-schedules";
import { buildTutorLaunchHref } from "@/lib/tutor-launch";
import type {
  EntryCategory,
  EntryCategoryMeta,
  EntryItem,
  JoinRequest,
  MotivationPayload,
  PlanItem,
  StudentRadarSnapshot,
  StudentWeakKnowledgePointSnapshot,
  TodayTask,
  TodayTaskPayload,
  TodayTaskStatus
} from "./types";

export const STUDENT_DASHBOARD_GUIDE_KEY = "guide:student-dashboard:v1";

export const ENTRY_ITEMS: EntryItem[] = [
  {
    id: "calendar",
    title: "课程表",
    tag: "上课",
    description: "查看今天课程、下一节提醒和学习日程。",
    href: "/calendar",
    cta: "打开课程表",
    icon: "board",
    category: "priority",
    order: 1
  },
  {
    id: "assignments",
    title: "作业中心",
    tag: "作业",
    description: "查看老师布置的作业进度。",
    href: "/student/assignments",
    cta: "进入作业",
    icon: "pencil",
    category: "priority",
    order: 2
  },
  {
    id: "exams",
    title: "在线考试",
    tag: "考试",
    description: "参加老师发布的独立考试，自动保存并提交评分。",
    href: "/student/exams",
    cta: "进入考试",
    icon: "chart",
    category: "priority",
    order: 3
  },
  {
    id: "wrong-book",
    title: "错题本",
    tag: "提升",
    description: "查看错因与复习节奏。",
    href: "/wrong-book",
    cta: "进入错题本",
    icon: "puzzle",
    category: "priority",
    order: 4
  },
  {
    id: "review",
    title: "记忆曲线复习",
    tag: "复习",
    description: "按遗忘曲线自动安排复习。",
    href: "/practice?mode=review",
    cta: "开始复习",
    icon: "chart",
    category: "priority",
    order: 5
  },
  {
    id: "notifications",
    title: "通知中心",
    tag: "提醒",
    description: "查看最新作业与班级通知。",
    href: "/notifications",
    cta: "查看通知",
    icon: "rocket",
    category: "priority",
    order: 6
  },
  {
    id: "join-class",
    title: "加入班级",
    tag: "班级",
    description: "输入老师提供的邀请码加入班级。",
    cta: "提交申请",
    icon: "board",
    category: "priority",
    order: 7,
    kind: "join"
  },
  {
    id: "tutor",
    title: "拍题即问",
    tag: "AI",
    description: "拍照识题、分步讲解、编辑重算。",
    href: buildTutorLaunchHref({ intent: "image", source: "student-entry" }),
    cta: "立即提问",
    icon: "brain",
    category: "practice",
    order: 1
  },
  {
    id: "diagnostic",
    title: "诊断测评",
    tag: "起步",
    description: "定位薄弱点，生成学习计划。",
    href: "/diagnostic",
    cta: "开始诊断",
    icon: "book",
    category: "practice",
    order: 2
  },
  {
    id: "coach",
    title: "学习陪练",
    tag: "陪伴",
    description: "分步提示 + 卡点追问。",
    href: "/coach",
    cta: "进入陪练",
    icon: "board",
    category: "practice",
    order: 3
  },
  {
    id: "modules",
    title: "课程模块",
    tag: "路径",
    description: "按单元查看学习内容与作业。",
    href: "/student/modules",
    cta: "查看模块",
    icon: "book",
    category: "practice",
    order: 4
  },
  {
    id: "reading",
    title: "朗读评分",
    tag: "语感",
    description: "语文/英语朗读跟读评分。",
    href: "/reading",
    cta: "开始朗读",
    icon: "rocket",
    category: "practice",
    order: 5
  },
  {
    id: "focus",
    title: "专注计时",
    tag: "专注",
    description: "番茄钟专注训练 + 休息建议。",
    href: "/focus",
    cta: "开启专注",
    icon: "board",
    category: "practice",
    order: 6
  },
  {
    id: "challenge",
    title: "挑战任务",
    tag: "成长",
    description: "闯关挑战，解锁奖励。",
    href: "/challenge",
    cta: "进入挑战",
    icon: "trophy",
    category: "growth",
    order: 1
  },
  {
    id: "portrait",
    title: "学习画像",
    tag: "数据",
    description: "查看能力雷达与掌握度。",
    href: "/student/portrait",
    cta: "查看画像",
    icon: "chart",
    category: "growth",
    order: 2
  },
  {
    id: "report",
    title: "学习报告",
    tag: "分析",
    description: "查看本周学习进度与薄弱点。",
    href: "/report",
    cta: "查看报告",
    icon: "chart",
    category: "growth",
    order: 3
  },
  {
    id: "growth",
    title: "成长档案",
    tag: "成长",
    description: "沉淀学习路径与掌握度变化。",
    href: "/student/growth",
    cta: "查看档案",
    icon: "trophy",
    category: "growth",
    order: 4
  },
  {
    id: "favorites",
    title: "题目收藏夹",
    tag: "收藏",
    description: "收藏题目并添加标签，便于复习。",
    href: "/student/favorites",
    cta: "查看收藏",
    icon: "book",
    category: "growth",
    order: 5
  },
  {
    id: "profile",
    title: "学生资料",
    tag: "设置",
    description: "设置年级、学科与学习目标。",
    href: "/student/profile",
    cta: "进入设置",
    icon: "pencil",
    category: "growth",
    order: 6
  }
];

export const CATEGORY_META: Record<EntryCategory, EntryCategoryMeta> = {
  priority: { label: "今日必做", description: "先完成高优先级学习闭环", defaultCount: 4 },
  practice: { label: "学习工具", description: "按需使用的学习与训练入口", defaultCount: 4 },
  growth: { label: "成长与反馈", description: "报告、画像和长期成长沉淀", defaultCount: 4 }
};

export const ENTRY_CATEGORIES: EntryCategory[] = ["priority", "practice", "growth"];

type StudentDashboardDerivedStateInput = {
  plan: PlanItem[];
  motivation: MotivationPayload | null;
  todayTasks: TodayTaskPayload | null;
  schedule: ScheduleResponse["data"] | null;
  joinRequests: JoinRequest[];
  activeCategory: EntryCategory;
  showAllEntries: boolean;
};

export type StudentDashboardTaskExposureProps = {
  generatedAt: string;
  taskId: string;
  source: TodayTask["source"];
  rank: number;
  priority: number;
  impactScore: number;
  urgencyScore: number;
  effortMinutes: number;
};

export function extractStudentDashboardPlanItems(payload: {
  data?: {
    items?: PlanItem[];
    plan?: {
      items?: PlanItem[];
    };
  } | null;
  items?: PlanItem[];
} | null | undefined): PlanItem[] {
  if (Array.isArray(payload?.data?.items)) {
    return payload.data.items;
  }
  if (Array.isArray(payload?.data?.plan?.items)) {
    return payload.data.plan.items;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  return [];
}

export function extractStudentDashboardMotivation(
  payload: MotivationPayload | { data?: MotivationPayload | null } | null | undefined
): MotivationPayload | null {
  if (!payload) {
    return null;
  }
  if ("data" in payload) {
    return payload.data ?? null;
  }
  if ("streak" in payload && "badges" in payload) {
    return payload;
  }
  return null;
}

export function extractStudentDashboardRadarSnapshot(payload: {
  data?: {
    mastery?: {
      weakKnowledgePoints?: StudentWeakKnowledgePointSnapshot[];
    } | null;
  };
} | null | undefined): StudentRadarSnapshot | null {
  return {
    weakKnowledgePoint: payload?.data?.mastery?.weakKnowledgePoints?.[0] ?? null
  };
}

export function getTodayTaskStatusLabel(status: TodayTaskStatus) {
  if (status === "overdue") return "逾期";
  if (status === "due_today") return "今日到期";
  if (status === "in_progress") return "进行中";
  if (status === "upcoming") return "待开始";
  if (status === "optional") return "可选";
  return "待完成";
}

export function getTodayTaskSourceLabel(source: "assignment" | "exam" | "wrong_review" | "plan" | "challenge" | "lesson") {
  if (source === "assignment") return "作业";
  if (source === "exam") return "考试";
  if (source === "wrong_review") return "复练";
  if (source === "plan") return "计划";
  if (source === "lesson") return "课程提醒";
  return "挑战";
}

export function countStudentDashboardPendingJoinRequests(joinRequests: JoinRequest[]) {
  return joinRequests.filter((item) => item.status === "pending").length;
}

export function getStudentDashboardTotalPlanCount(plan: PlanItem[]) {
  return plan.reduce((sum, item) => sum + (Number(item.targetCount) || 0), 0);
}

export function getStudentDashboardWeakPlanCount(plan: PlanItem[]) {
  return plan.filter((item) => item.masteryLevel === "weak").length;
}

export function buildStudentDashboardTopTodayTasks(todayTasks: TodayTaskPayload | null) {
  if (!todayTasks) {
    return [];
  }
  if (todayTasks.topTasks?.length) {
    return todayTasks.topTasks.slice(0, 3);
  }
  return todayTasks.tasks.slice(0, 3);
}

export function buildStudentDashboardVisiblePriorityTasks(
  todayTasks: TodayTaskPayload | null,
  topTodayTasks: TodayTask[]
) {
  if (!todayTasks) {
    return topTodayTasks;
  }
  if (todayTasks.groups?.mustDo?.length) {
    return todayTasks.groups.mustDo.slice(0, 5);
  }
  return todayTasks.tasks.slice(0, 5);
}

export function getStudentDashboardHiddenTodayTaskCount(
  todayTasks: TodayTaskPayload | null,
  visiblePriorityTaskCount: number
) {
  return Math.max(0, (todayTasks?.tasks?.length ?? 0) - visiblePriorityTaskCount);
}

export function getStudentDashboardCategoryCounts(entryItems: EntryItem[] = ENTRY_ITEMS) {
  return entryItems.reduce<Record<EntryCategory, number>>(
    (acc, item) => {
      acc[item.category] += 1;
      return acc;
    },
    { priority: 0, practice: 0, growth: 0 }
  );
}

export function getStudentDashboardEntriesByCategory(
  activeCategory: EntryCategory,
  entryItems: EntryItem[] = ENTRY_ITEMS
) {
  return entryItems
    .filter((item) => item.category === activeCategory)
    .sort((left, right) => left.order - right.order);
}

export function getStudentDashboardVisibleEntries(
  entriesByCategory: EntryItem[],
  activeCategory: EntryCategory,
  showAllEntries: boolean
) {
  if (showAllEntries) {
    return entriesByCategory;
  }
  return entriesByCategory.slice(0, CATEGORY_META[activeCategory].defaultCount);
}

export function getStudentDashboardRecommendedTask(
  todayTasks: TodayTaskPayload | null,
  visiblePriorityTasks: TodayTask[]
) {
  return todayTasks?.topTasks?.[0] ?? visiblePriorityTasks[0] ?? null;
}

export function buildStudentDashboardTaskExposureProps(
  todayTasks: TodayTaskPayload | null,
  topTodayTasks: TodayTask[]
) {
  if (!todayTasks?.generatedAt || topTodayTasks.length === 0) {
    return [];
  }

  return topTodayTasks.map<StudentDashboardTaskExposureProps>((task, index) => ({
    generatedAt: todayTasks.generatedAt,
    taskId: task.id,
    source: task.source,
    rank: index + 1,
    priority: task.priority,
    impactScore: task.impactScore,
    urgencyScore: task.urgencyScore,
    effortMinutes: task.effortMinutes
  }));
}

export function hasStudentDashboardData(options: {
  plan: PlanItem[];
  motivation: MotivationPayload | null;
  todayTasks: TodayTaskPayload | null;
  schedule: ScheduleResponse["data"] | null;
  joinRequests: JoinRequest[];
}) {
  return (
    options.plan.length > 0 ||
    options.motivation !== null ||
    options.todayTasks !== null ||
    options.schedule !== null ||
    options.joinRequests.length > 0
  );
}

export function getStudentDashboardDerivedState({
  plan,
  motivation,
  todayTasks,
  schedule,
  joinRequests,
  activeCategory,
  showAllEntries
}: StudentDashboardDerivedStateInput) {
  const pendingJoinCount = countStudentDashboardPendingJoinRequests(joinRequests);
  const totalPlanCount = getStudentDashboardTotalPlanCount(plan);
  const weakPlanCount = getStudentDashboardWeakPlanCount(plan);
  const topTodayTasks = buildStudentDashboardTopTodayTasks(todayTasks);
  const visiblePriorityTasks = buildStudentDashboardVisiblePriorityTasks(todayTasks, topTodayTasks);
  const hiddenTodayTaskCount = getStudentDashboardHiddenTodayTaskCount(
    todayTasks,
    visiblePriorityTasks.length
  );
  const categoryCounts = getStudentDashboardCategoryCounts();
  const entriesByCategory = getStudentDashboardEntriesByCategory(activeCategory);
  const visibleEntries = getStudentDashboardVisibleEntries(
    entriesByCategory,
    activeCategory,
    showAllEntries
  );
  const recommendedTask = getStudentDashboardRecommendedTask(
    todayTasks,
    visiblePriorityTasks
  );

  return {
    pendingJoinCount,
    totalPlanCount,
    weakPlanCount,
    topTodayTasks,
    visiblePriorityTasks,
    hiddenTodayTaskCount,
    categoryCounts,
    entriesByCategory,
    visibleEntries,
    recommendedTask,
    hasDashboardData: hasStudentDashboardData({
      plan,
      motivation,
      todayTasks,
      schedule,
      joinRequests
    }),
    taskExposureProps: buildStudentDashboardTaskExposureProps(todayTasks, topTodayTasks)
  };
}

export function getStudentDashboardJoinSuccessMessage(
  message: string | undefined,
  nestedMessage: string | undefined
) {
  return message?.trim() || nestedMessage?.trim() || "已提交";
}


type StudentScheduleData = ScheduleResponse["data"] | null;
type StudentNextLesson = NonNullable<NonNullable<ScheduleResponse["data"]>["nextLesson"]>;

export type StudentLessonWindow = {
  nextLesson: StudentNextLesson | null;
  minutesUntilNextLesson: number | null;
  lessonInProgress: boolean;
  lessonStartsSoon: boolean;
  lessonWindowActive: boolean;
  safeTaskMinutes: number | null;
};

export type StudentTaskTimingAdvice = StudentLessonWindow & {
  canStartNow: boolean;
  timingLabel: string;
  deferReason: string | null;
};

export function getMinutesUntil(startAt: string | undefined) {
  if (!startAt) return null;
  const diff = new Date(startAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 60000));
}

export function getStudentLessonWindow(schedule: StudentScheduleData): StudentLessonWindow {
  const nextLesson = schedule?.nextLesson ?? null;
  const minutesUntilNextLesson = getMinutesUntil(nextLesson?.startAt);
  const lessonInProgress = nextLesson?.status === "in_progress";
  const lessonStartsSoon = !lessonInProgress && minutesUntilNextLesson !== null && minutesUntilNextLesson <= 30;
  const lessonWindowActive = Boolean(nextLesson && (lessonInProgress || lessonStartsSoon));
  const safeTaskMinutes = lessonStartsSoon && minutesUntilNextLesson !== null ? Math.max(5, minutesUntilNextLesson - 10) : null;

  return {
    nextLesson,
    minutesUntilNextLesson,
    lessonInProgress,
    lessonStartsSoon,
    lessonWindowActive,
    safeTaskMinutes
  };
}

export function getStudentTaskTimingAdvice(task: TodayTask, schedule: StudentScheduleData): StudentTaskTimingAdvice {
  const lessonWindow = getStudentLessonWindow(schedule);

  if (!lessonWindow.nextLesson) {
    return {
      ...lessonWindow,
      canStartNow: true,
      timingLabel: task.source === "lesson" ? "按课表做" : "可现在做",
      deferReason: null
    };
  }

  if (!lessonWindow.lessonWindowActive) {
    return {
      ...lessonWindow,
      canStartNow: true,
      timingLabel: task.source === "lesson" ? "按课表做" : "可现在做",
      deferReason: null
    };
  }

  if (task.source === "lesson") {
    return {
      ...lessonWindow,
      canStartNow: true,
      timingLabel: lessonWindow.lessonInProgress ? "课堂优先" : "课前优先",
      deferReason: null
    };
  }

  if (lessonWindow.lessonInProgress) {
    return {
      ...lessonWindow,
      canStartNow: false,
      timingLabel: "建议课后",
      deferReason: "当前已进入上课时段，先处理课堂任务，其他任务课后再开。"
    };
  }

  const safeTaskMinutes = lessonWindow.safeTaskMinutes ?? 5;
  const canStartNow = task.effortMinutes <= safeTaskMinutes;

  return {
    ...lessonWindow,
    canStartNow,
    timingLabel: canStartNow ? "可课前完成" : "建议课后",
    deferReason: canStartNow
      ? null
      : `距离上课还有 ${lessonWindow.minutesUntilNextLesson ?? 0} 分钟，当前任务预计 ${task.effortMinutes} 分钟，更适合课后开始。`
  };
}
