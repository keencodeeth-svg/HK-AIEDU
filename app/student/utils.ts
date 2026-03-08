import { buildTutorLaunchHref } from "@/lib/tutor-launch";
import type { EntryCategory, EntryCategoryMeta, EntryItem, TodayTaskStatus } from "./types";

export const STUDENT_DASHBOARD_GUIDE_KEY = "guide:student-dashboard:v1";

export const ENTRY_ITEMS: EntryItem[] = [
  {
    id: "assignments",
    title: "作业中心",
    tag: "作业",
    description: "查看老师布置的作业进度。",
    href: "/student/assignments",
    cta: "进入作业",
    icon: "pencil",
    category: "priority",
    order: 1
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
    order: 2
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
    order: 3
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
    order: 4
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
    order: 5
  },
  {
    id: "join-class",
    title: "加入班级",
    tag: "班级",
    description: "输入老师提供的邀请码加入班级。",
    cta: "提交申请",
    icon: "board",
    category: "priority",
    order: 6,
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

export function getTodayTaskStatusLabel(status: TodayTaskStatus) {
  if (status === "overdue") return "逾期";
  if (status === "due_today") return "今日到期";
  if (status === "in_progress") return "进行中";
  if (status === "upcoming") return "待开始";
  if (status === "optional") return "可选";
  return "待完成";
}

export function getTodayTaskSourceLabel(source: "assignment" | "exam" | "wrong_review" | "plan" | "challenge") {
  if (source === "assignment") return "作业";
  if (source === "exam") return "考试";
  if (source === "wrong_review") return "复练";
  if (source === "plan") return "计划";
  return "挑战";
}
