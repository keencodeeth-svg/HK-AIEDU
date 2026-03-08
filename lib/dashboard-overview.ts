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

async function getCommonOverview(userId: string): Promise<CommonOverviewData> {
  const [threads, notifications] = await Promise.all([getThreadsForUser(userId), getNotificationsByUser(userId)]);
  const recentUnreadThreads = threads.filter((item) => (item.unreadCount ?? 0) > 0).slice(0, 3);
  const recentNotifications = notifications.slice(0, 3);
  return {
    unreadThreads: threads.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0),
    unreadNotifications: notifications.filter((item) => !item.readAt).length,
    recentUnreadThreads,
    recentNotifications
  };
}

async function getStudentTaskRows(studentId: string) {
  const classes = await getClassesByStudent(studentId);
  const classMap = new Map(classes.map((item) => [item.id, item]));
  const [assignments, progressList] = await Promise.all([
    getAssignmentsByClassIds(classes.map((item) => item.id)),
    getAssignmentProgressByStudent(studentId)
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
        title: assignment.title,
        className: classMap.get(assignment.classId)?.name ?? "未分班级",
        subject: classMap.get(assignment.classId)?.subject,
        grade: classMap.get(assignment.classId)?.grade,
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
  const [tasks, reviewQueue] = await Promise.all([getStudentTaskRows(user.id), getUnifiedReviewQueue({ userId: user.id })]);
  const pendingTasks = tasks.filter((item) => item.pending);
  const overdueTasks = pendingTasks.filter((item) => item.overdue);
  const dueSoonTasks = pendingTasks.filter((item) => item.dueSoon);

  const alerts: DashboardAlert[] = [];
  if (overdueTasks.length) {
    alerts.push({
      id: "student-overdue",
      level: "high",
      title: `有 ${overdueTasks.length} 项作业已逾期`,
      detail: `建议先处理“${overdueTasks[0].title}”等紧急任务，避免堆积。`,
      href: "/student/assignments",
      actionLabel: "去完成"
    });
  }
  if (reviewQueue.summary.dueToday > 0) {
    alerts.push({
      id: "student-review",
      level: overdueTasks.length ? "medium" : "high",
      title: `今日有 ${reviewQueue.summary.dueToday} 项复练待完成`,
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
      title: item.title,
      detail: `${item.className} · ${item.subject ?? "学习任务"}`,
      meta: getDeadlineText(item.dueDate),
      href: item.href,
      status: (item.overdue ? "high" : item.dueSoon ? "medium" : "info") as DashboardTimelineItem["status"]
    })),
    ...common.recentUnreadThreads.map((thread) => ({
      id: `thread-${thread.id}`,
      type: "thread" as const,
      title: thread.subject,
      detail: thread.lastMessage?.content ?? "你有新的未读消息。",
      meta: `${thread.unreadCount ?? 0} 条未读`,
      href: `/inbox?threadId=${thread.id}`,
      status: "info" as const
    })),
    ...common.recentNotifications.map((notice) => ({
      id: `notice-${notice.id}`,
      type: "notification" as const,
      title: notice.title,
      detail: notice.content,
      meta: notice.readAt ? `已读 · ${formatDateLabel(notice.createdAt)}` : `未读 · ${formatDateLabel(notice.createdAt)}`,
      href: "/notifications",
      status: (notice.readAt ? "info" : "medium") as DashboardTimelineItem["status"]
    }))
  ].slice(0, 6);

  return {
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    title: `${user.name}，今天先处理最有价值的学习动作`,
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
        value: String(reviewQueue.summary.dueToday),
        helper: reviewQueue.summary.overdue ? `${reviewQueue.summary.overdue} 道已过复习时间` : "建议优先完成"
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
          ? `优先处理 ${overdueTasks[0].title}`
          : pendingTasks.length
            ? `还有 ${pendingTasks.length} 项待完成任务`
            : "查看新的学习任务",
        href: "/student/assignments",
        tone: "primary"
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
        description: reviewQueue.summary.dueToday ? `今日有 ${reviewQueue.summary.dueToday} 道待复习` : "复盘最近易错题",
        href: "/wrong-book",
        tone: "secondary"
      },
      {
        id: "student-plan",
        label: "学习计划",
        description: "查看今天最值得先做的计划项",
        href: "/plan",
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
      title: `${user.name}，还没有绑定学生账号`,
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
    ...common.recentUnreadThreads.map((thread) => ({
      id: `thread-${thread.id}`,
      type: "thread" as const,
      title: thread.subject,
      detail: thread.lastMessage?.content ?? "有新的家校沟通消息。",
      meta: `${thread.unreadCount ?? 0} 条未读`,
      href: `/inbox?threadId=${thread.id}`,
      status: "info" as const
    })),
    ...common.recentNotifications.map((notice) => ({
      id: `notice-${notice.id}`,
      type: "notification" as const,
      title: notice.title,
      detail: notice.content,
      meta: notice.readAt ? `已读 · ${formatDateLabel(notice.createdAt)}` : `未读 · ${formatDateLabel(notice.createdAt)}`,
      href: "/notifications",
      status: (notice.readAt ? "info" : "medium") as DashboardTimelineItem["status"]
    }))
  ].slice(0, 6);

  return {
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    title: `${user.name}，先看孩子今天最需要你跟进的事项`,
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
        id: "parent-report",
        label: "学习周报",
        description: "掌握本周进步、薄弱点和建议动作",
        href: "/report",
        tone: "secondary"
      },
      {
        id: "parent-calendar",
        label: "查看日程",
        description: "确认考试、作业和家校活动安排",
        href: "/calendar",
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
        title: assignment.title,
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
      detail: `建议先查看“${overdueTasks[0].title}”的完成情况并决定是否催交。`,
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
    ...common.recentUnreadThreads.map((thread) => ({
      id: `thread-${thread.id}`,
      type: "thread" as const,
      title: thread.subject,
      detail: thread.lastMessage?.content ?? "有新的未读沟通消息。",
      meta: `${thread.unreadCount ?? 0} 条未读`,
      href: `/inbox?threadId=${thread.id}`,
      status: "info" as const
    })),
    ...common.recentNotifications.map((notice) => ({
      id: `notice-${notice.id}`,
      type: "notification" as const,
      title: notice.title,
      detail: notice.content,
      meta: notice.readAt ? `已读 · ${formatDateLabel(notice.createdAt)}` : `未读 · ${formatDateLabel(notice.createdAt)}`,
      href: "/notifications",
      status: (notice.readAt ? "info" : "medium") as DashboardTimelineItem["status"]
    }))
  ].slice(0, 6);

  return {
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    title: `${user.name}，先处理最影响教学执行的事项`,
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
        id: "teacher-assignments",
        label: "作业管理",
        description: "继续发布、调整或查看班级作业",
        href: "/teacher",
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
        { id: "school-classes", label: "班级管理", description: "查看班级、学生与教师状态", href: "/school/classes", tone: "secondary" },
        { id: "school-students", label: "学生管理", description: "检查学生账户与班级绑定", href: "/school/students", tone: "secondary" },
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
    ...common.recentUnreadThreads.map((thread) => ({
      id: `thread-${thread.id}`,
      type: "thread" as const,
      title: thread.subject,
      detail: thread.lastMessage?.content ?? "有新的未读消息。",
      meta: `${thread.unreadCount ?? 0} 条未读`,
      href: `/inbox?threadId=${thread.id}`,
      status: "info" as const
    })),
    ...common.recentNotifications.map((notice) => ({
      id: `notice-${notice.id}`,
      type: "notification" as const,
      title: notice.title,
      detail: notice.content,
      meta: notice.readAt ? `已读 · ${formatDateLabel(notice.createdAt)}` : `未读 · ${formatDateLabel(notice.createdAt)}`,
      href: "/notifications",
      status: (notice.readAt ? "info" : "medium") as DashboardTimelineItem["status"]
    }))
  ].slice(0, 6);

  return {
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    title: `${user.name}，先看平台当前最需要你处理的入口`,
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

export async function getDashboardOverview(user: SafeUser): Promise<DashboardOverview> {
  const common = await getCommonOverview(user.id);
  if (user.role === "student") {
    return buildStudentOverview(user, common);
  }
  if (user.role === "teacher") {
    return buildTeacherOverview(user, common);
  }
  if (user.role === "parent") {
    return buildParentOverview(user, common);
  }
  return buildAdminOverview(user, common);
}
