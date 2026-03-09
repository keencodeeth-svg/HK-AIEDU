import type { UserRole } from "./auth";
import { getClassesByStudent, getClassesByTeacher, getClassStudentIds } from "./classes";
import { getAssignmentProgress, getAssignmentProgressByStudent, getAssignmentsByClassIds } from "./assignments";
import { getNotificationsByUser } from "./notifications";
import { getThreadsForUser } from "./inbox";
import { getStudentContext } from "./user-context";
import { getUnifiedReviewQueue } from "./review-scheduler";
import { buildTutorLaunchHref } from "./tutor-launch";

export type DashboardMetric = {
  id: string;
  label: string;
  value: string;
  helper?: string;
};

export type DashboardAlert = {
  id: string;
  level: "high" | "medium" | "info";
  title: string;
  detail: string;
  href?: string;
  actionLabel?: string;
};

export type DashboardQuickAction = {
  id: string;
  label: string;
  description: string;
  href: string;
  tone: "primary" | "secondary" | "ghost";
};

export type DashboardTimelineItem = {
  id: string;
  type: "assignment" | "notification" | "thread" | "review";
  title: string;
  detail: string;
  meta: string;
  href: string;
  status?: "high" | "medium" | "info";
};

export type DashboardOverview = {
  role: UserRole;
  roleLabel: string;
  title: string;
  subtitle: string;
  metrics: DashboardMetric[];
  alerts: DashboardAlert[];
  quickActions: DashboardQuickAction[];
  timeline: DashboardTimelineItem[];
};

type SafeUser = {
  id: string;
  name: string;
  role: UserRole;
  grade?: string;
  studentId?: string;
};

type CommonOverviewData = {
  unreadThreads: number;
  unreadNotifications: number;
  recentUnreadThreads: Awaited<ReturnType<typeof getThreadsForUser>>;
  recentNotifications: Awaited<ReturnType<typeof getNotificationsByUser>>;
};

type StudentTaskRow = {
  id: string;
  title: string;
  className: string;
  subject?: string;
  grade?: string;
  dueDate: string;
  pending: boolean;
  overdue: boolean;
  dueSoon: boolean;
  completed: boolean;
  href: string;
};

const ROLE_LABELS: Record<UserRole, string> = {
  student: "学生",
  teacher: "教师",
  parent: "家长",
  admin: "管理员",
  school_admin: "校管理员"
};

function formatDateLabel(value?: string | null) {
  if (!value) return "待定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "待定";
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getDeadlineText(value: string) {
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return "时间待定";
  const diff = target - Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  if (diff < 0) {
    const overdueDays = Math.max(1, Math.ceil(Math.abs(diff) / oneDay));
    return `已逾期 ${overdueDays} 天`;
  }
  if (diff <= oneDay) {
    return "今天截止";
  }
  if (diff <= 2 * oneDay) {
    return "2 天内截止";
  }
  return `截止 ${formatDateLabel(value)}`;
}

function limitItems<T>(items: T[], count: number) {
  return items.slice(0, count);
}

function toDisplayText(value: unknown, fallback: string) {
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function createEmptyCommonOverview(): CommonOverviewData {
  return {
    unreadThreads: 0,
    unreadNotifications: 0,
    recentUnreadThreads: [],
    recentNotifications: []
  };
}

function createEmptyReviewQueue(): Awaited<ReturnType<typeof getUnifiedReviewQueue>> {
  return {
    summary: {
      totalActive: 0,
      dueToday: 0,
      overdue: 0,
      upcoming: 0
    },
    dueToday: [],
    upcoming: [],
    questions: new Map()
  };
}

function logOverviewIssue(scope: string, error: unknown, context?: Record<string, unknown>) {
  const meta = error instanceof Error
    ? { message: error.message, stack: error.stack }
    : { message: String(error) };
  console.error("[dashboard-overview]", scope, {
    ...meta,
    ...(context ? { context } : {})
  });
}

async function safeLoad<T>(scope: string, loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    logOverviewIssue(scope, error);
    return fallback;
  }
}

function buildThreadTimelineItems(
  threads: CommonOverviewData["recentUnreadThreads"],
  fallbackDetail: string
): DashboardTimelineItem[] {
  return threads.map((thread) => ({
    id: `thread-${thread.id}`,
    type: "thread" as const,
    title: toDisplayText(thread.subject, "新消息"),
    detail: toDisplayText(thread.lastMessage?.content, fallbackDetail),
    meta: `${Math.max(0, Number(thread.unreadCount ?? 0))} 条未读`,
    href: thread.id ? `/inbox?threadId=${thread.id}` : "/inbox",
    status: "info" as const
  }));
}

function buildNotificationTimelineItems(
  notifications: CommonOverviewData["recentNotifications"]
): DashboardTimelineItem[] {
  return notifications.map((notice) => ({
    id: `notice-${notice.id}`,
    type: "notification" as const,
    title: toDisplayText(notice.title, "新通知"),
    detail: toDisplayText(notice.content, "你有一条新的通知待查看。"),
    meta: notice.readAt ? `已读 · ${formatDateLabel(notice.createdAt)}` : `未读 · ${formatDateLabel(notice.createdAt)}`,
    href: "/notifications",
    status: (notice.readAt ? "info" : "medium") as DashboardTimelineItem["status"]
  }));
}

async function getCommonOverview(userId: string): Promise<CommonOverviewData> {
  const [threads, notifications] = await Promise.all([
    safeLoad(
      `common:threads:${userId}`,
      () => getThreadsForUser(userId),
      [] as Awaited<ReturnType<typeof getThreadsForUser>>
    ),
    safeLoad(
      `common:notifications:${userId}`,
      () => getNotificationsByUser(userId),
      [] as Awaited<ReturnType<typeof getNotificationsByUser>>
    )
  ]);

  const recentUnreadThreads = threads.filter((item) => Number(item?.unreadCount ?? 0) > 0).slice(0, 3);
  const recentNotifications = notifications.slice(0, 3);

  return {
    unreadThreads: threads.reduce((sum, item) => sum + Math.max(0, Number(item?.unreadCount ?? 0)), 0),
    unreadNotifications: notifications.filter((item) => !item.readAt).length,
    recentUnreadThreads,
    recentNotifications
  };
}


async function getStudentTaskRows(studentId: string) {
  const classes = await safeLoad(
    `student:classes:${studentId}`,
    () => getClassesByStudent(studentId),
    [] as Awaited<ReturnType<typeof getClassesByStudent>>
  );
  if (!classes.length) {
    return [];
  }

  const classMap = new Map(classes.map((item) => [item.id, item]));
  const classIds = classes.map((item) => item.id);
  const [assignments, progressList] = await Promise.all([
    safeLoad(
      `student:assignments:${studentId}`,
      () => getAssignmentsByClassIds(classIds),
      [] as Awaited<ReturnType<typeof getAssignmentsByClassIds>>
    ),
    safeLoad(
      `student:assignment-progress:${studentId}`,
      () => getAssignmentProgressByStudent(studentId),
      [] as Awaited<ReturnType<typeof getAssignmentProgressByStudent>>
    )
  ]);

  const progressMap = new Map(progressList.map((item) => [item.assignmentId, item]));
  const now = Date.now();
  const twoDaysLater = now + 2 * 24 * 60 * 60 * 1000;

  return assignments
    .map<StudentTaskRow>((assignment) => {
      const progress = progressMap.get(assignment.id);
      const dueTs = new Date(assignment.dueDate).getTime();
      const completed = Boolean(progress?.completedAt) || progress?.status === "completed";
      const pending = !completed;
      return {
        id: assignment.id,
        title: toDisplayText(assignment.title, "未命名作业"),
        className: toDisplayText(classMap.get(assignment.classId)?.name, "未分班级"),
        subject: toDisplayText(classMap.get(assignment.classId)?.subject, "学习任务"),
        grade: toDisplayText(classMap.get(assignment.classId)?.grade, ""),
        dueDate: assignment.dueDate,
        pending,
        overdue: pending && !Number.isNaN(dueTs) && dueTs < now,
        dueSoon: pending && !Number.isNaN(dueTs) && dueTs >= now && dueTs <= twoDaysLater,
        completed,
        href: "/student/assignments"
      };
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}


async function buildStudentOverview(user: SafeUser, common: CommonOverviewData): Promise<DashboardOverview> {
  const [tasks, reviewQueue] = await Promise.all([
    safeLoad(`student:tasks:${user.id}`, () => getStudentTaskRows(user.id), [] as Awaited<ReturnType<typeof getStudentTaskRows>>),
    safeLoad(`student:review:${user.id}`, () => getUnifiedReviewQueue({ userId: user.id }), createEmptyReviewQueue())
  ]);
  const pendingTasks = tasks.filter((item) => item.pending);
  const overdueTasks = pendingTasks.filter((item) => item.overdue);
  const dueSoonTasks = pendingTasks.filter((item) => item.dueSoon);
  const reviewSummary = reviewQueue.summary;
  const firstOverdueTaskTitle = toDisplayText(overdueTasks[0]?.title, "当前逾期任务");

  const alerts: DashboardAlert[] = [];
  if (overdueTasks.length) {
    alerts.push({
      id: "student-overdue",
      level: "high",
      title: `有 ${overdueTasks.length} 项作业已逾期`,
      detail: `建议先处理“${firstOverdueTaskTitle}”等紧急任务，避免堆积。`,
      href: "/student/assignments",
      actionLabel: "去完成"
    });
  }
  if (reviewSummary.dueToday > 0) {
    alerts.push({
      id: "student-review",
      level: overdueTasks.length ? "medium" : "high",
      title: `今日有 ${reviewSummary.dueToday} 项复练待完成`,
      detail: "先做今日复练，通常是提升掌握度与记忆保持最快的动作。",
      href: "/wrong-book",
      actionLabel: "去复习"
    });
  }
  if (common.unreadThreads > 0 || common.unreadNotifications > 0) {
    alerts.push({
      id: "student-messages",
      level: "info",
      title: `还有 ${common.unreadThreads + common.unreadNotifications} 条未读提醒`,
      detail: "先读消息和通知，避免漏掉老师新安排。",
      href: common.unreadThreads > 0 ? "/inbox" : "/notifications",
      actionLabel: common.unreadThreads > 0 ? "看消息" : "看通知"
    });
  }

  const timeline: DashboardTimelineItem[] = [
    ...limitItems(pendingTasks, 3).map((item) => ({
      id: `assignment-${item.id}`,
      type: "assignment" as const,
      title: toDisplayText(item.title, "未命名作业"),
      detail: `${toDisplayText(item.className, "未分班级")} · ${toDisplayText(item.subject, "学习任务")}`,
      meta: getDeadlineText(item.dueDate),
      href: item.href || "/student/assignments",
      status: (item.overdue ? "high" : item.dueSoon ? "medium" : "info") as DashboardTimelineItem["status"]
    })),
    ...buildThreadTimelineItems(common.recentUnreadThreads, "你有新的未读消息。"),
    ...buildNotificationTimelineItems(common.recentNotifications)
  ].slice(0, 6);

  return {
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    title: `${toDisplayText(user.name, "同学")}，今天先处理最有价值的学习动作`,
    subtitle: "把紧急事项、错题复习、未读提醒放在同一屏，减少切换和遗漏。",
    metrics: [
      {
        id: "pending",
        label: "待完成作业",
        value: String(pendingTasks.length),
        helper: overdueTasks.length ? `${overdueTasks.length} 项已逾期` : dueSoonTasks.length ? `${dueSoonTasks.length} 项即将截止` : "当前节奏正常"
      },
      {
        id: "review",
        label: "今日错题复习",
        value: String(reviewSummary.dueToday),
        helper: reviewSummary.overdue ? `${reviewSummary.overdue} 道已过复习时间` : "建议优先完成"
      },
      {
        id: "threads",
        label: "未读消息",
        value: String(common.unreadThreads),
        helper: common.unreadThreads ? "老师或同学有新反馈" : "消息已读完"
      },
      {
        id: "notifications",
        label: "未读通知",
        value: String(common.unreadNotifications),
        helper: common.unreadNotifications ? "建议先确认班级通知" : "通知已同步"
      }
    ],
    alerts,
    quickActions: [
      {
        id: "student-assignments",
        label: overdueTasks.length ? "先完成逾期作业" : "进入作业中心",
        description: overdueTasks.length
          ? `优先处理 ${firstOverdueTaskTitle}`
          : pendingTasks.length
            ? `还有 ${pendingTasks.length} 项待完成任务`
            : "查看新的学习任务",
        href: "/student/assignments",
        tone: "primary"
      },
      {
        id: "student-calendar",
        label: "课程表",
        description: "先看下一节课、今日节次和学习日程",
        href: "/calendar",
        tone: "secondary"
      },
      {
        id: "student-tutor",
        label: "拍题即问",
        description: "拍照识题、分步讲解、编辑重算",
        href: buildTutorLaunchHref({ intent: "image", source: "dashboard-overview" }),
        tone: "secondary"
      },
      {
        id: "student-review",
        label: "错题复习",
        description: reviewSummary.dueToday ? `今日有 ${reviewSummary.dueToday} 道待复习` : "复盘最近易错题",
        href: "/wrong-book",
        tone: "ghost"
      }
    ],
    timeline
  };
}


async function buildParentOverview(user: SafeUser, common: CommonOverviewData): Promise<DashboardOverview> {
  const student = await getStudentContext();
  if (!student) {
    return {
      role: user.role,
      roleLabel: ROLE_LABELS[user.role],
      title: `${toDisplayText(user.name, ROLE_LABELS[user.role])}，还没有绑定学生账号`,
      subtitle: "绑定后即可查看孩子的学习进度、提醒和周报。",
      metrics: [
        { id: "threads", label: "未读消息", value: String(common.unreadThreads), helper: "可先查看家校沟通" },
        { id: "notifications", label: "未读通知", value: String(common.unreadNotifications), helper: "及时确认学校通知" }
      ],
      alerts: [],
      quickActions: [
        {
          id: "parent-home",
          label: "进入家长端",
          description: "查看家校协同与提醒入口",
          href: "/parent",
          tone: "primary"
        },
        {
          id: "parent-inbox",
          label: "查看消息",
          description: "确认老师和学校的最新沟通",
          href: "/inbox",
          tone: "secondary"
        }
      ],
      timeline: []
    };
  }

  const [tasks, reviewQueue] = await Promise.all([getStudentTaskRows(student.id), getUnifiedReviewQueue({ userId: student.id })]);
  const pendingTasks = tasks.filter((item) => item.pending);
  const overdueTasks = pendingTasks.filter((item) => item.overdue);
  const dueSoonTasks = pendingTasks.filter((item) => item.dueSoon);

  const alerts: DashboardAlert[] = [];
  if (overdueTasks.length) {
    alerts.push({
      id: "parent-overdue",
      level: "high",
      title: `孩子有 ${overdueTasks.length} 项作业已逾期`,
      detail: "建议今晚先协助确认作业进度，再决定是否需要提醒老师。",
      href: "/parent",
      actionLabel: "去跟进"
    });
  }
  if (reviewQueue.summary.dueToday > 0) {
    alerts.push({
      id: "parent-review",
      level: overdueTasks.length ? "medium" : "high",
      title: `今日错题复习 ${reviewQueue.summary.dueToday} 道`,
      detail: "先完成复习任务，再看是否需要 AI 讲解辅助。",
      href: "/wrong-book",
      actionLabel: "看错题"
    });
  }
  if (common.unreadNotifications > 0) {
    alerts.push({
      id: "parent-notice",
      level: "info",
      title: `还有 ${common.unreadNotifications} 条未读通知`,
      detail: "避免错过班级安排、考试信息和提交提醒。",
      href: "/notifications",
      actionLabel: "去查看"
    });
  }

  const timeline: DashboardTimelineItem[] = [
    ...limitItems(pendingTasks, 3).map((item) => ({
      id: `assignment-${item.id}`,
      type: "assignment" as const,
      title: item.title,
      detail: `${student.name} · ${item.className}`,
      meta: getDeadlineText(item.dueDate),
      href: "/parent",
      status: (item.overdue ? "high" : item.dueSoon ? "medium" : "info") as DashboardTimelineItem["status"]
    })),
    ...buildThreadTimelineItems(common.recentUnreadThreads, "有新的家校沟通消息。"),
    ...buildNotificationTimelineItems(common.recentNotifications)
  ].slice(0, 6);

  return {
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    title: `${toDisplayText(user.name, ROLE_LABELS[user.role])}，先看孩子今天最需要你跟进的事项`,
    subtitle: "把到期任务、错题复习和家校通知汇总到一页，方便快速决策。",
    metrics: [
      {
        id: "pending",
        label: "待跟进作业",
        value: String(pendingTasks.length),
        helper: overdueTasks.length ? `${overdueTasks.length} 项已逾期` : dueSoonTasks.length ? `${dueSoonTasks.length} 项两天内截止` : "当前无紧急任务"
      },
      {
        id: "review",
        label: "今日错题复习",
        value: String(reviewQueue.summary.dueToday),
        helper: reviewQueue.summary.overdue ? `${reviewQueue.summary.overdue} 道已过复习时间` : "建议亲子共读错因"
      },
      {
        id: "threads",
        label: "未读消息",
        value: String(common.unreadThreads),
        helper: common.unreadThreads ? "有新的家校沟通" : "沟通已同步"
      },
      {
        id: "notifications",
        label: "未读通知",
        value: String(common.unreadNotifications),
        helper: common.unreadNotifications ? "建议及时确认" : "通知已读完"
      }
    ],
    alerts,
    quickActions: [
      {
        id: "parent-space",
        label: "进入家长端",
        description: "查看周报、行动项和作业跟进建议",
        href: "/parent",
        tone: "primary"
      },
      {
        id: "parent-calendar",
        label: "孩子课程表",
        description: "先确认下一节课、今日课程和放学后衔接安排",
        href: "/calendar",
        tone: "secondary"
      },
      {
        id: "parent-report",
        label: "学习周报",
        description: "掌握本周进步、薄弱点和建议动作",
        href: "/report",
        tone: "secondary"
      },
      {
        id: "parent-inbox",
        label: "收件箱",
        description: "快速回复老师或查看沟通记录",
        href: "/inbox",
        tone: "ghost"
      }
    ],
    timeline
  };
}

async function buildTeacherOverview(user: SafeUser, common: CommonOverviewData): Promise<DashboardOverview> {
  const classes = await getClassesByTeacher(user.id);
  const classStudentCounts = new Map(
    await Promise.all(classes.map(async (klass) => [klass.id, (await getClassStudentIds(klass.id)).length] as const))
  );
  const assignments = await getAssignmentsByClassIds(classes.map((item) => item.id));
  const progressEntries = await Promise.all(assignments.map(async (assignment) => [assignment.id, await getAssignmentProgress(assignment.id)] as const));
  const progressMap = new Map(progressEntries);
  const now = Date.now();
  const twoDaysLater = now + 2 * 24 * 60 * 60 * 1000;

  const teacherTasks = assignments
    .map((assignment) => {
      const progress = progressMap.get(assignment.id) ?? [];
      const total = classStudentCounts.get(assignment.classId) ?? 0;
      const completed = progress.filter((item) => item.status === "completed").length;
      const pending = Math.max(0, total - completed);
      const dueTs = new Date(assignment.dueDate).getTime();
      return {
        id: assignment.id,
        title: toDisplayText(assignment.title, "未命名作业"),
        dueDate: assignment.dueDate,
        pending,
        completed,
        total,
        overdue: pending > 0 && !Number.isNaN(dueTs) && dueTs < now,
        dueSoon: pending > 0 && !Number.isNaN(dueTs) && dueTs >= now && dueTs <= twoDaysLater,
        href: "/teacher/submissions"
      };
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const overdueTasks = teacherTasks.filter((item) => item.overdue);
  const dueSoonTasks = teacherTasks.filter((item) => item.dueSoon);
  const pendingSubmissionCount = teacherTasks.reduce((sum, item) => sum + item.pending, 0);

  const alerts: DashboardAlert[] = [];
  if (overdueTasks.length) {
    alerts.push({
      id: "teacher-overdue",
      level: "high",
      title: `${overdueTasks.length} 个作业已到期仍有学生未完成`,
      detail: `建议先查看“${toDisplayText(overdueTasks[0]?.title, "当前待跟进作业")}”的完成情况并决定是否催交。`,
      href: "/teacher/submissions",
      actionLabel: "打开提交箱"
    });
  }
  if (dueSoonTasks.length) {
    alerts.push({
      id: "teacher-due-soon",
      level: overdueTasks.length ? "medium" : "high",
      title: `${dueSoonTasks.length} 个作业将在 2 天内截止`,
      detail: "可提前发送提醒，减少临近截止的集中提交。",
      href: "/teacher/notifications",
      actionLabel: "发提醒"
    });
  }
  if (common.unreadThreads > 0 || common.unreadNotifications > 0) {
    alerts.push({
      id: "teacher-message",
      level: "info",
      title: `还有 ${common.unreadThreads + common.unreadNotifications} 条未处理沟通`,
      detail: "建议先同步家长/学生消息，再安排教学动作。",
      href: common.unreadThreads > 0 ? "/inbox" : "/notifications",
      actionLabel: common.unreadThreads > 0 ? "看消息" : "看通知"
    });
  }

  const timeline: DashboardTimelineItem[] = [
    ...limitItems(teacherTasks.filter((item) => item.pending > 0), 3).map((item) => ({
      id: `assignment-${item.id}`,
      type: "assignment" as const,
      title: item.title,
      detail: `待完成 ${item.pending}/${item.total} 人`,
      meta: getDeadlineText(item.dueDate),
      href: item.href,
      status: (item.overdue ? "high" : item.dueSoon ? "medium" : "info") as DashboardTimelineItem["status"]
    })),
    ...buildThreadTimelineItems(common.recentUnreadThreads, "有新的未读沟通消息。"),
    ...buildNotificationTimelineItems(common.recentNotifications)
  ].slice(0, 6);

  return {
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    title: `${toDisplayText(user.name, ROLE_LABELS[user.role])}，先处理最影响教学执行的事项`,
    subtitle: "把催交、消息、通知和近期教学动作收拢到一个首页，减少碎片切换。",
    metrics: [
      {
        id: "assignments",
        label: "待跟进作业",
        value: String(teacherTasks.filter((item) => item.pending > 0).length),
        helper: overdueTasks.length ? `${overdueTasks.length} 个已到期` : dueSoonTasks.length ? `${dueSoonTasks.length} 个即将截止` : "当前节奏稳定"
      },
      {
        id: "pending-submissions",
        label: "待完成提交",
        value: String(pendingSubmissionCount),
        helper: pendingSubmissionCount ? "可提前发送提醒" : "当前班级已完成"
      },
      {
        id: "threads",
        label: "未读消息",
        value: String(common.unreadThreads),
        helper: common.unreadThreads ? "建议优先回复" : "消息已处理"
      },
      {
        id: "notifications",
        label: "未读通知",
        value: String(common.unreadNotifications),
        helper: common.unreadNotifications ? "有待确认系统提醒" : "通知已同步"
      }
    ],
    alerts,
    quickActions: [
      {
        id: "teacher-submissions",
        label: "提交箱",
        description: "查看待完成、待跟进与最新提交情况",
        href: "/teacher/submissions",
        tone: "primary"
      },
      {
        id: "teacher-calendar",
        label: "教学课表",
        description: "先看今天节次、下一节课与课堂安排",
        href: "/calendar",
        tone: "secondary"
      },
      {
        id: "teacher-seating",
        label: "AI排座位",
        description: "预览排座方案并微调班级座位分布",
        href: "/teacher/seating",
        tone: "secondary"
      },
      {
        id: "teacher-analysis",
        label: "学情分析",
        description: "查看风险学生和班级薄弱点",
        href: "/teacher/analysis",
        tone: "secondary"
      },
      {
        id: "teacher-exams",
        label: "在线考试",
        description: "继续创建、发布或复盘考试",
        href: "/teacher/exams",
        tone: "ghost"
      }
    ],
    timeline
  };
}

function buildAdminOverview(user: SafeUser, common: CommonOverviewData): DashboardOverview {
  const quickActions: DashboardQuickAction[] = user.role === "admin"
    ? [
        { id: "admin-home", label: "管理端", description: "进入平台运营与 AI 配置中心", href: "/admin", tone: "primary" },
        { id: "admin-questions", label: "题库管理", description: "查看题库质量与抽样结果", href: "/admin/questions", tone: "secondary" },
        { id: "admin-kp", label: "知识点管理", description: "维护知识点与知识树结构", href: "/admin/knowledge-points", tone: "secondary" },
        { id: "admin-library", label: "教材课件", description: "查看资源库与导入情况", href: "/library", tone: "ghost" }
      ]
    : [
        { id: "school-home", label: "学校管理", description: "查看学校维度的运营入口", href: "/school", tone: "primary" },
        { id: "school-schedules", label: "课程表管理", description: "优先补齐排课覆盖、节次和班级课表", href: "/school/schedules", tone: "secondary" },
        { id: "school-classes", label: "班级管理", description: "查看班级、学生与教师状态", href: "/school/classes", tone: "secondary" },
        { id: "school-teachers", label: "教师管理", description: "查看教师名单与权限配置", href: "/school/teachers", tone: "ghost" }
      ];

  const alerts: DashboardAlert[] = [];
  if (common.unreadNotifications > 0) {
    alerts.push({
      id: "admin-notice",
      level: "info",
      title: `还有 ${common.unreadNotifications} 条未读通知`,
      detail: "建议先确认平台提醒与异常反馈。",
      href: "/notifications",
      actionLabel: "查看通知"
    });
  }

  const timeline: DashboardTimelineItem[] = [
    ...buildThreadTimelineItems(common.recentUnreadThreads, "有新的未读消息。"),
    ...buildNotificationTimelineItems(common.recentNotifications)
  ].slice(0, 6);

  return {
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    title: `${toDisplayText(user.name, ROLE_LABELS[user.role])}，先看平台当前最需要你处理的入口`,
    subtitle: "把运营入口、消息和系统提醒归拢到首页，提升处理效率。",
    metrics: [
      { id: "threads", label: "未读消息", value: String(common.unreadThreads), helper: common.unreadThreads ? "有协同消息待处理" : "消息已同步" },
      { id: "notifications", label: "未读通知", value: String(common.unreadNotifications), helper: common.unreadNotifications ? "建议先查看系统提醒" : "通知已读完" }
    ],
    alerts,
    quickActions,
    timeline
  };
}

function buildFallbackOverview(user: SafeUser, common: CommonOverviewData): DashboardOverview {
  const roleLabel = ROLE_LABELS[user.role];
  const displayName = toDisplayText(user.name, roleLabel);
  const timeline = [
    ...buildThreadTimelineItems(common.recentUnreadThreads, "有新的消息待处理。"),
    ...buildNotificationTimelineItems(common.recentNotifications)
  ].slice(0, 4);

  const quickActionsByRole: Record<UserRole, DashboardQuickAction[]> = {
    student: [
      { id: "student-home", label: "学生端", description: "返回学生主页继续学习", href: "/student", tone: "primary" },
      { id: "student-calendar", label: "课程表", description: "先看下一节课和今天安排", href: "/calendar", tone: "secondary" },
      { id: "student-assignments", label: "作业中心", description: "继续查看待完成作业", href: "/student/assignments", tone: "secondary" },
      { id: "student-tutor", label: "拍题即问", description: "直接进入图片识题模式", href: buildTutorLaunchHref({ intent: "image", source: "dashboard-fallback" }), tone: "ghost" }
    ],
    parent: [
      { id: "parent-home", label: "家长端", description: "查看家校协同与提醒", href: "/parent", tone: "primary" },
      { id: "parent-calendar", label: "孩子课程表", description: "先确认孩子下一节课和今日课程", href: "/calendar", tone: "secondary" },
      { id: "parent-report", label: "学习周报", description: "继续查看孩子本周学习变化", href: "/report", tone: "secondary" },
      { id: "parent-inbox", label: "收件箱", description: "继续处理家校沟通消息", href: "/inbox", tone: "ghost" }
    ],
    teacher: [
      { id: "teacher-home", label: "教师端", description: "返回教学主控台", href: "/teacher", tone: "primary" },
      { id: "teacher-calendar", label: "教学课表", description: "先确认今天节次与下一节课安排", href: "/calendar", tone: "secondary" },
      { id: "teacher-seating", label: "AI排座位", description: "快速生成班级排座方案并继续微调", href: "/teacher/seating", tone: "secondary" },
      { id: "teacher-submissions", label: "提交箱", description: "继续查看待跟进提交", href: "/teacher/submissions", tone: "secondary" },
      { id: "teacher-analysis", label: "学情分析", description: "查看班级薄弱点与风险学生", href: "/teacher/analysis", tone: "ghost" }
    ],
    admin: [
      { id: "admin-home", label: "管理端", description: "返回平台管理首页", href: "/admin", tone: "primary" },
      { id: "admin-questions", label: "题库管理", description: "继续处理题库与质量工作", href: "/admin/questions", tone: "secondary" },
      { id: "admin-library", label: "教材课件", description: "继续查看资源库", href: "/library", tone: "secondary" },
      { id: "admin-notifications", label: "通知中心", description: "先处理系统提醒", href: "/notifications", tone: "ghost" }
    ],
    school_admin: [
      { id: "school-home", label: "学校管理", description: "返回学校管理首页", href: "/school", tone: "primary" },
      { id: "school-schedules", label: "课程表管理", description: "优先检查排课覆盖和节次完整度", href: "/school/schedules", tone: "secondary" },
      { id: "school-classes", label: "班级管理", description: "查看班级与教师状态", href: "/school/classes", tone: "secondary" },
      { id: "school-notifications", label: "通知中心", description: "处理学校侧通知提醒", href: "/notifications", tone: "ghost" }
    ]
  };

  return {
    role: user.role,
    roleLabel,
    title: `${displayName}，核心入口已恢复，可继续操作`,
    subtitle: "看板部分数据暂时不可用，系统已自动降级到稳定模式，避免影响你继续使用核心功能。",
    metrics: [
      {
        id: "threads",
        label: "未读消息",
        value: String(common.unreadThreads),
        helper: common.unreadThreads ? "建议优先查看未读沟通" : "当前没有未读消息"
      },
      {
        id: "notifications",
        label: "未读通知",
        value: String(common.unreadNotifications),
        helper: common.unreadNotifications ? "建议及时确认系统通知" : "当前没有未读通知"
      }
    ],
    alerts: [
      {
        id: `${user.role}-dashboard-fallback`,
        level: "info",
        title: "看板部分数据暂时不可用",
        detail: "你仍可通过下方入口继续操作；系统已记录异常并保护当前登录态，避免白屏影响使用。"
      }
    ],
    quickActions: quickActionsByRole[user.role],
    timeline
  };
}

export async function getDashboardOverview(user: SafeUser): Promise<DashboardOverview> {
  const common = await safeLoad(`overview:common:${user.role}:${user.id}`, () => getCommonOverview(user.id), createEmptyCommonOverview());

  try {
    if (user.role === "student") {
      return await buildStudentOverview(user, common);
    }
    if (user.role === "teacher") {
      return await buildTeacherOverview(user, common);
    }
    if (user.role === "parent") {
      return await buildParentOverview(user, common);
    }
    return buildAdminOverview(user, common);
  } catch (error) {
    logOverviewIssue(`overview:role:${user.role}:${user.id}`, error, {
      userId: user.id,
      role: user.role
    });
    return buildFallbackOverview(user, common);
  }
}
