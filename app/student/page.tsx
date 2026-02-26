"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";

type PlanItem = {
  knowledgePointId: string;
  targetCount: number;
  dueDate: string;
  subject?: string;
  masteryScore?: number;
  masteryLevel?: "weak" | "developing" | "strong";
};

type TodayTaskStatus = "overdue" | "due_today" | "in_progress" | "pending" | "upcoming" | "optional";

type TodayTask = {
  id: string;
  source: "assignment" | "exam" | "wrong_review" | "plan" | "challenge";
  sourceId: string;
  title: string;
  description: string;
  href: string;
  status: TodayTaskStatus;
  priority: number;
  dueAt: string | null;
  group: "must_do" | "continue_learning" | "growth";
  tags: string[];
};

type TodayTaskPayload = {
  generatedAt: string;
  summary: {
    total: number;
    mustDo: number;
    continueLearning: number;
    growth: number;
    overdue: number;
    dueToday: number;
    inProgress: number;
    bySource: {
      assignment: number;
      exam: number;
      wrongReview: number;
      plan: number;
      challenge: number;
    };
  };
  groups: {
    mustDo: TodayTask[];
    continueLearning: TodayTask[];
    growth: TodayTask[];
  };
  tasks: TodayTask[];
};

type EntryCategory = "priority" | "practice" | "growth";
type IconName = "book" | "pencil" | "rocket" | "chart" | "brain" | "trophy" | "board" | "puzzle";

type EntryItem = {
  id: string;
  title: string;
  tag: string;
  description: string;
  href?: string;
  cta: string;
  icon: IconName;
  category: EntryCategory;
  order: number;
  kind?: "default" | "join";
};

const ENTRY_ITEMS: EntryItem[] = [
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
    id: "diagnostic",
    title: "诊断测评",
    tag: "起步",
    description: "定位薄弱点，生成学习计划。",
    href: "/diagnostic",
    cta: "开始诊断",
    icon: "book",
    category: "practice",
    order: 1
  },
  {
    id: "tutor",
    title: "AI 辅导",
    tag: "智能",
    description: "逐步提示和引导式讲解。",
    href: "/tutor",
    cta: "打开辅导",
    icon: "brain",
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

const CATEGORY_META: Record<EntryCategory, { label: string; description: string; defaultCount: number }> = {
  priority: { label: "今日必做", description: "先完成高优先级学习闭环", defaultCount: 4 },
  practice: { label: "学习工具", description: "按需使用的学习与训练入口", defaultCount: 4 },
  growth: { label: "成长与反馈", description: "报告、画像和长期成长沉淀", defaultCount: 4 }
};

const ENTRY_CATEGORIES: EntryCategory[] = ["priority", "practice", "growth"];

function getTodayTaskStatusLabel(status: TodayTaskStatus) {
  if (status === "overdue") return "逾期";
  if (status === "due_today") return "今日到期";
  if (status === "in_progress") return "进行中";
  if (status === "upcoming") return "待开始";
  if (status === "optional") return "可选";
  return "待完成";
}

export default function StudentPage() {
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [motivation, setMotivation] = useState<{ streak: number; badges: any[]; weekly: any } | null>(null);
  const [todayTasks, setTodayTasks] = useState<TodayTaskPayload | null>(null);
  const [todayTaskError, setTodayTaskError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<EntryCategory>("priority");
  const [showAllEntries, setShowAllEntries] = useState(false);

  const loadTodayTasks = useCallback(async () => {
    setTodayTaskError(null);
    const res = await fetch("/api/student/today-tasks");
    const payload = await res.json();
    if (!res.ok) {
      setTodayTaskError(payload?.error ?? "加载今日任务失败");
      return;
    }
    setTodayTasks(payload?.data ?? null);
  }, []);

  useEffect(() => {
    fetch("/api/plan")
      .then((res) => res.json())
      .then((data) => {
        const items = data.data?.items ?? [];
        setPlan(items);
      });
    fetch("/api/student/motivation")
      .then((res) => res.json())
      .then((data) => setMotivation(data?.data ?? data));
    fetch("/api/student/join-requests")
      .then((res) => res.json())
      .then((data) => setJoinRequests(data.data ?? []));
    loadTodayTasks();
  }, [loadTodayTasks]);

  useEffect(() => {
    setShowAllEntries(false);
  }, [activeCategory]);

  const pendingJoinCount = useMemo(
    () => joinRequests.filter((item) => item.status === "pending").length,
    [joinRequests]
  );

  const totalPlanCount = useMemo(
    () => plan.reduce((sum, item) => sum + (Number(item.targetCount) || 0), 0),
    [plan]
  );

  const weakPlanCount = useMemo(() => plan.filter((item) => item.masteryLevel === "weak").length, [plan]);
  const todayTaskPreview = useMemo(() => (todayTasks?.tasks ?? []).slice(0, 6), [todayTasks]);
  const hiddenTodayTaskCount = useMemo(
    () => Math.max(0, (todayTasks?.tasks?.length ?? 0) - todayTaskPreview.length),
    [todayTasks, todayTaskPreview.length]
  );

  const categoryCounts = useMemo(() => {
    return ENTRY_ITEMS.reduce<Record<EntryCategory, number>>(
      (acc, item) => {
        acc[item.category] += 1;
        return acc;
      },
      { priority: 0, practice: 0, growth: 0 }
    );
  }, []);

  const entriesByCategory = useMemo(() => {
    return ENTRY_ITEMS.filter((item) => item.category === activeCategory).sort((a, b) => a.order - b.order);
  }, [activeCategory]);

  const visibleEntries = useMemo(() => {
    if (showAllEntries) return entriesByCategory;
    return entriesByCategory.slice(0, CATEGORY_META[activeCategory].defaultCount);
  }, [entriesByCategory, showAllEntries, activeCategory]);

  async function handleJoinClass(event: React.FormEvent) {
    event.preventDefault();
    setJoinMessage(null);
    const res = await fetch("/api/student/join-class", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: joinCode })
    });
    const data = await res.json();
    setJoinMessage(data?.message ?? (res.ok ? "已提交" : "加入失败"));
    setJoinCode("");
    fetch("/api/student/join-requests")
      .then((resp) => resp.json())
      .then((payload) => setJoinRequests(payload.data ?? []));
  }

  async function refreshPlan() {
    setRefreshing(true);
    const res = await fetch("/api/plan/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "all" })
    });
    const data = await res.json();
    const items = data?.data?.items ?? data?.data?.plan?.items ?? [];
    if (Array.isArray(items)) {
      setPlan(items);
    }
    await loadTodayTasks();
    setRefreshing(false);
  }

  function renderEntryCard(item: EntryItem) {
    if (item.kind === "join") {
      return (
        <Card key={item.id} title={item.title} tag={item.tag}>
          <div className="feature-card">
            <EduIcon name={item.icon} />
            <p>{item.description}</p>
          </div>
          <form onSubmit={handleJoinClass} style={{ display: "grid", gap: 10 }}>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="输入老师提供的邀请码"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
            <button className="button primary" type="submit">
              {item.cta}
            </button>
          </form>
          {joinMessage ? <div style={{ marginTop: 8, fontSize: 12 }}>{joinMessage}</div> : null}
          {pendingJoinCount ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>已有 {pendingJoinCount} 条待审核申请。</div>
          ) : null}
        </Card>
      );
    }

    if (!item.href) return null;

    return (
      <Card key={item.id} title={item.title} tag={item.tag}>
        <div className="feature-card">
          <EduIcon name={item.icon} />
          <p>{item.description}</p>
        </div>
        <Link className="button secondary" href={item.href} style={{ marginTop: 12 }}>
          {item.cta}
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>学习控制台</h2>
          <div className="section-sub">今日任务、成长激励与学习入口。</div>
        </div>
        <span className="chip">学期进行中</span>
      </div>

      <div className="grid grid-2">
        <Card title="今日任务" tag="队列">
          {todayTaskError ? <p>{todayTaskError}</p> : null}
          {todayTaskPreview.length === 0 ? (
            <p>当前暂无待处理任务，保持节奏即可。</p>
          ) : (
            <div className="grid" style={{ gap: 8 }}>
              {todayTaskPreview.map((task) => (
                <div className="card" key={task.id}>
                  <div className="card-header">
                    <div className="section-title" style={{ fontSize: 14 }}>
                      {task.title}
                    </div>
                    <span className="card-tag">{getTodayTaskStatusLabel(task.status)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>{task.description}</div>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {task.tags.slice(0, 2).map((tag) => (
                      <span className="badge" key={`${task.id}-${tag}`}>
                        {tag}
                      </span>
                    ))}
                    {task.dueAt ? (
                      <span style={{ fontSize: 12, color: "var(--ink-1)" }}>
                        截止 {new Date(task.dueAt).toLocaleString("zh-CN")}
                      </span>
                    ) : null}
                  </div>
                  <div className="cta-row" style={{ marginTop: 8 }}>
                    <Link className="button ghost" href={task.href}>
                      去完成
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
            <span className="badge">必做 {todayTasks?.summary?.mustDo ?? 0}</span>
            <span className="badge">逾期 {todayTasks?.summary?.overdue ?? 0}</span>
            <span className="badge">今日到期 {todayTasks?.summary?.dueToday ?? 0}</span>
            <span className="badge">计划题量 {totalPlanCount}</span>
            <span className="badge">薄弱知识点 {weakPlanCount}</span>
            <span className="badge">复练任务 {todayTasks?.summary?.bySource?.wrongReview ?? 0}</span>
          </div>
          {hiddenTodayTaskCount > 0 ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>还有 {hiddenTodayTaskCount} 项任务待处理。</div>
          ) : null}
          <div className="cta-row" style={{ marginTop: 12 }}>
            <button className="button secondary" type="button" onClick={refreshPlan}>
              {refreshing ? "刷新中..." : "刷新学习计划"}
            </button>
          </div>
        </Card>

        <Card title="学习激励" tag="成长">
          <div className="grid grid-2">
            <div className="card">
              <div className="section-title">连续学习</div>
              <p>{motivation?.streak ?? 0} 天</p>
            </div>
            <div className="card">
              <div className="section-title">本周正确率</div>
              <p>{motivation?.weekly?.accuracy ?? 0}%</p>
            </div>
          </div>
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            <div className="badge">徽章</div>
            {motivation?.badges?.length ? (
              motivation.badges.map((badge: any) => (
                <div key={badge.id}>
                  {badge.title} - {badge.description}
                </div>
              ))
            ) : (
              <p>完成一次练习即可获得首枚徽章。</p>
            )}
          </div>
        </Card>
      </div>

      <div className="section-head">
        <div>
          <h2>学习入口</h2>
          <div className="section-sub">{CATEGORY_META[activeCategory].description}</div>
        </div>
        <span className="chip">{CATEGORY_META[activeCategory].label}</span>
      </div>

      <div className="cta-row" style={{ marginTop: 0 }}>
        {ENTRY_CATEGORIES.map((category) => (
          <button
            key={category}
            className={activeCategory === category ? "button secondary" : "button ghost"}
            type="button"
            onClick={() => setActiveCategory(category)}
          >
            {CATEGORY_META[category].label} ({categoryCounts[category]})
          </button>
        ))}
        <button className="button ghost" type="button" onClick={() => setShowAllEntries((prev) => !prev)}>
          {showAllEntries ? "收起入口" : `展开全部（${entriesByCategory.length}）`}
        </button>
      </div>

      <div className="grid grid-3">{visibleEntries.map((item) => renderEntryCard(item))}</div>
    </div>
  );
}
