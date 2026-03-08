"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import StatePanel from "@/components/StatePanel";
import { trackEvent } from "@/lib/analytics-client";
import { formatLoadedTime, getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import StudentDashboardGuideCard from "./_components/StudentDashboardGuideCard";
import StudentEntryCompactCard from "./_components/StudentEntryCompactCard";
import StudentEntryDetailCard from "./_components/StudentEntryDetailCard";
import StudentMotivationCard from "./_components/StudentMotivationCard";
import StudentNextActionCard from "./_components/StudentNextActionCard";
import StudentPriorityTasksCard from "./_components/StudentPriorityTasksCard";
import StudentQuickTutorCard from "./_components/StudentQuickTutorCard";
import StudentTaskOverviewCard from "./_components/StudentTaskOverviewCard";
import StudentUnifiedTaskQueueCard from "./_components/StudentUnifiedTaskQueueCard";
import type {
  EntryCategory,
  EntryViewMode,
  JoinMessage,
  JoinRequest,
  MotivationPayload,
  PlanItem,
  TodayTask,
  TodayTaskEventName,
  TodayTaskPayload
} from "./types";
import { CATEGORY_META, ENTRY_CATEGORIES, ENTRY_ITEMS, STUDENT_DASHBOARD_GUIDE_KEY } from "./utils";

type PlanResponse = {
  data?: {
    items?: PlanItem[];
    plan?: {
      items?: PlanItem[];
    };
  } | null;
  items?: PlanItem[];
};

type MotivationResponse = MotivationPayload | { data?: MotivationPayload | null };
type JoinRequestsResponse = { data?: JoinRequest[] };
type TodayTasksResponse = { data?: TodayTaskPayload | null };
type JoinClassResponse = { message?: string; data?: { message?: string } };

function extractPlanItems(payload: PlanResponse | null | undefined): PlanItem[] {
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.plan?.items)) return payload.data.plan.items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function extractMotivation(payload: MotivationResponse | null | undefined): MotivationPayload | null {
  if (!payload) return null;
  if ("data" in payload) {
    return payload.data ?? null;
  }
  if ("streak" in payload && "badges" in payload) {
    return payload;
  }
  return null;
}

export default function StudentPage() {
  const trackedTaskExposureRef = useRef<string | null>(null);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [motivation, setMotivation] = useState<MotivationPayload | null>(null);
  const [todayTasks, setTodayTasks] = useState<TodayTaskPayload | null>(null);
  const [todayTaskError, setTodayTaskError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinMessage, setJoinMessage] = useState<JoinMessage | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<EntryCategory>("priority");
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [entryViewMode, setEntryViewMode] = useState<EntryViewMode>("compact");
  const [showDashboardGuide, setShowDashboardGuide] = useState(true);

  const loadJoinRequests = useCallback(async () => {
    const payload = await requestJson<JoinRequestsResponse>("/api/student/join-requests");
    setJoinRequests(payload.data ?? []);
  }, []);

  const loadTodayTasks = useCallback(async () => {
    setTodayTaskError(null);
    try {
      const payload = await requestJson<TodayTasksResponse>("/api/student/today-tasks");
      setTodayTasks(payload.data ?? null);
      return true;
    } catch (nextError) {
      if (isAuthError(nextError)) {
        throw nextError;
      }
      setTodayTaskError(getRequestErrorMessage(nextError, "加载今日任务失败"));
      return false;
    }
  }, []);

  const loadDashboard = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setPageError(null);

      try {
        const [planPayload, motivationPayload] = await Promise.all([
          requestJson<PlanResponse>("/api/plan"),
          requestJson<MotivationResponse>("/api/student/motivation")
        ]);

        setPlan(extractPlanItems(planPayload));
        setMotivation(extractMotivation(motivationPayload));
        await Promise.all([loadJoinRequests(), loadTodayTasks()]);
        setAuthRequired(false);
        setLastLoadedAt(new Date().toISOString());
      } catch (nextError) {
        if (isAuthError(nextError)) {
          setAuthRequired(true);
          setPlan([]);
          setMotivation(null);
          setJoinRequests([]);
          setTodayTasks(null);
          setTodayTaskError(null);
        } else {
          setPageError(getRequestErrorMessage(nextError, "加载学习控制台失败"));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadJoinRequests, loadTodayTasks]
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    try {
      const hidden = window.localStorage.getItem(STUDENT_DASHBOARD_GUIDE_KEY) === "hidden";
      setShowDashboardGuide(!hidden);
    } catch {
      setShowDashboardGuide(true);
    }
  }, []);

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

  const topTodayTasks = useMemo(() => {
    if (!todayTasks) return [];
    if (todayTasks.topTasks?.length) return todayTasks.topTasks.slice(0, 3);
    return todayTasks.tasks.slice(0, 3);
  }, [todayTasks]);

  const visiblePriorityTasks = useMemo(() => {
    if (!todayTasks) return topTodayTasks;
    if (todayTasks.groups?.mustDo?.length) {
      return todayTasks.groups.mustDo.slice(0, 5);
    }
    return todayTasks.tasks.slice(0, 5);
  }, [todayTasks, topTodayTasks]);

  const hiddenTodayTaskCount = useMemo(
    () => Math.max(0, (todayTasks?.tasks?.length ?? 0) - visiblePriorityTasks.length),
    [todayTasks, visiblePriorityTasks.length]
  );

  useEffect(() => {
    if (!todayTasks?.generatedAt || topTodayTasks.length === 0) return;
    if (trackedTaskExposureRef.current === todayTasks.generatedAt) return;
    trackedTaskExposureRef.current = todayTasks.generatedAt;
    topTodayTasks.forEach((task, index) => {
      trackEvent({
        eventName: "task_exposed",
        page: "/student",
        props: {
          taskId: task.id,
          source: task.source,
          rank: index + 1,
          priority: task.priority,
          impactScore: task.impactScore,
          urgencyScore: task.urgencyScore,
          effortMinutes: task.effortMinutes
        }
      });
    });
  }, [todayTasks?.generatedAt, topTodayTasks]);

  const handleTaskEvent = useCallback((task: TodayTask, eventName: TodayTaskEventName) => {
    trackEvent({
      eventName,
      page: "/student",
      props: {
        taskId: task.id,
        source: task.source,
        status: task.status,
        priority: task.priority,
        impactScore: task.impactScore,
        urgencyScore: task.urgencyScore,
        effortMinutes: task.effortMinutes
      }
    });
  }, []);

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
  }, [activeCategory, entriesByCategory, showAllEntries]);

  const recommendedTask = useMemo(
    () => todayTasks?.topTasks?.[0] ?? visiblePriorityTasks[0] ?? null,
    [todayTasks, visiblePriorityTasks]
  );

  const hasDashboardData = plan.length > 0 || motivation !== null || todayTasks !== null || joinRequests.length > 0;

  async function handleJoinClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJoinMessage(null);
    if (!joinCode.trim()) {
      setJoinMessage({ text: "请输入邀请码后再提交。", tone: "error" });
      return;
    }

    try {
      const payload = await requestJson<JoinClassResponse>("/api/student/join-class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim() })
      });
      setJoinMessage({
        text: payload.message ?? payload.data?.message ?? "已提交",
        tone: "success"
      });
      setJoinCode("");
      await loadJoinRequests();
      setAuthRequired(false);
      setPageError(null);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        return;
      }
      setJoinMessage({ text: getRequestErrorMessage(nextError, "加入失败"), tone: "error" });
    }
  }

  async function refreshPlan() {
    setRefreshing(true);
    setPageError(null);
    try {
      const payload = await requestJson<PlanResponse>("/api/plan/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: "all" })
      });
      setPlan(extractPlanItems(payload));
      await loadTodayTasks();
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
      } else {
        setPageError(getRequestErrorMessage(nextError, "刷新学习计划失败"));
      }
    } finally {
      setRefreshing(false);
    }
  }

  function hideDashboardGuide() {
    setShowDashboardGuide(false);
    try {
      window.localStorage.setItem(STUDENT_DASHBOARD_GUIDE_KEY, "hidden");
    } catch {
      // ignore localStorage errors
    }
  }

  function showDashboardGuideAgain() {
    setShowDashboardGuide(true);
    try {
      window.localStorage.removeItem(STUDENT_DASHBOARD_GUIDE_KEY);
    } catch {
      // ignore localStorage errors
    }
  }

  if (loading && !hasDashboardData && !authRequired) {
    return (
      <StatePanel
        title="学习控制台加载中"
        description="正在汇总学习计划、今日任务和成长激励。"
        tone="loading"
      />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        title="需要学生账号登录"
        description="请先登录学生账号，再查看学习控制台和今日任务。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (pageError && !hasDashboardData) {
    return (
      <StatePanel
        title="学习控制台加载失败"
        description={pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void loadDashboard()}>
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className="grid dashboard-stack">
      <div className="section-head">
        <div>
          <h2>学习控制台</h2>
          <div className="section-sub">今日任务、成长激励与学习入口。</div>
        </div>
        <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <span className="chip">学期进行中</span>
          <button className="button secondary" type="button" onClick={() => void loadDashboard("refresh")} disabled={loading || refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {pageError ? <StatePanel title="本次刷新存在异常" description={pageError} tone="error" compact /> : null}

      <StudentDashboardGuideCard
        showDashboardGuide={showDashboardGuide}
        onHide={hideDashboardGuide}
        onShow={showDashboardGuideAgain}
      />

      <div className="student-focus-grid">
        <StudentNextActionCard
          recommendedTask={recommendedTask}
          mustDoCount={todayTasks?.summary?.mustDo ?? visiblePriorityTasks.length}
          totalTaskCount={todayTasks?.summary?.total ?? visiblePriorityTasks.length}
          weakPlanCount={weakPlanCount}
          onTaskEvent={handleTaskEvent}
        />

        <StudentQuickTutorCard
          mustDoCount={todayTasks?.summary?.mustDo ?? visiblePriorityTasks.length}
          weakPlanCount={weakPlanCount}
        />
      </div>

      <div className="student-overview-grid">
        <StudentPriorityTasksCard
          todayTaskError={todayTaskError}
          visiblePriorityTasks={visiblePriorityTasks}
          hiddenTodayTaskCount={hiddenTodayTaskCount}
          onTaskEvent={handleTaskEvent}
        />

        <div className="grid" style={{ gap: 10 }}>
          <StudentTaskOverviewCard
            todayTasks={todayTasks}
            totalPlanCount={totalPlanCount}
            weakPlanCount={weakPlanCount}
            refreshing={refreshing}
            onRefreshPlan={refreshPlan}
          />
          <StudentMotivationCard motivation={motivation} />
        </div>
      </div>

      <div id="student-task-queue">
        <StudentUnifiedTaskQueueCard
          todayTasks={todayTasks}
          todayTaskError={todayTaskError}
          onTaskEvent={handleTaskEvent}
        />
      </div>

      <div className="section-head">
        <div>
          <h2>学习入口</h2>
          <div className="section-sub">{CATEGORY_META[activeCategory].description}</div>
        </div>
        <span className="chip">{CATEGORY_META[activeCategory].label}</span>
      </div>

      <div className="student-entry-toolbar">
        <div className="student-entry-filter-group" role="toolbar" aria-label="切换学习入口分类">
          {ENTRY_CATEGORIES.map((category) => (
            <button
              key={category}
              className={activeCategory === category ? "button secondary" : "button ghost"}
              type="button"
              aria-pressed={activeCategory === category}
              onClick={() => setActiveCategory(category)}
            >
              {CATEGORY_META[category].label} ({categoryCounts[category]})
            </button>
          ))}
        </div>
        <div className="student-entry-view-group" role="toolbar" aria-label="切换学习入口显示方式">
          <button
            className={showAllEntries ? "button secondary" : "button ghost"}
            type="button"
            aria-pressed={showAllEntries}
            onClick={() => setShowAllEntries((prev) => !prev)}
          >
            {showAllEntries ? "收起入口" : `展开全部（${entriesByCategory.length}）`}
          </button>
          <button
            className={entryViewMode === "compact" ? "button secondary" : "button ghost"}
            type="button"
            aria-pressed={entryViewMode === "compact"}
            onClick={() => setEntryViewMode("compact")}
          >
            紧凑视图
          </button>
          <button
            className={entryViewMode === "detailed" ? "button secondary" : "button ghost"}
            type="button"
            aria-pressed={entryViewMode === "detailed"}
            onClick={() => setEntryViewMode("detailed")}
          >
            详细视图
          </button>
        </div>
      </div>

      {entryViewMode === "detailed" ? (
        <div className="grid grid-3">
          {visibleEntries.map((item) => (
            <StudentEntryDetailCard
              key={item.id}
              item={item}
              joinCode={joinCode}
              joinMessage={joinMessage}
              pendingJoinCount={pendingJoinCount}
              onJoinClass={handleJoinClass}
              onJoinCodeChange={setJoinCode}
            />
          ))}
        </div>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {visibleEntries.map((item) => (
            <StudentEntryCompactCard
              key={item.id}
              item={item}
              joinCode={joinCode}
              joinMessage={joinMessage}
              onJoinClass={handleJoinClass}
              onJoinCodeChange={setJoinCode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
