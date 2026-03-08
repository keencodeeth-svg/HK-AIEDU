"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime, getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import type { ScheduleLessonOccurrence, ScheduleResponse } from "@/lib/class-schedules";

type RoleScheduleFocusCardProps = {
  variant: "teacher" | "parent";
};

const COPY = {
  teacher: {
    title: "教学课表优先区",
    lead: "先确认下一节课和今天课时，再安排备课、作业与提醒。",
    loadingTitle: "教学课表加载中",
    loadingDescription: "正在汇总今天教学节次与下一节安排。",
    authTitle: "需要教师身份后查看教学课表",
    authDescription: "请重新登录教师账号后查看今天的教学安排。",
    errorTitle: "教学课表加载失败",
    emptyTitle: "当前教授班级还没有排课",
    emptyDescription: "学校完成排课后，这里会自动显示下一节课、课堂焦点和今日节次。",
    noNextTitle: "当前没有下一节课",
    noNextDescription: "今天课程可能已结束，建议转去处理作业跟进或课程模块。",
    noTodayTitle: "今天没有排课",
    noTodayDescription: "可以优先做备课、查看提交箱或更新课程模块。",
    openLabel: "打开教学课表",
    fallbackHref: "/teacher/modules",
    fallbackLabel: "查看课程模块",
    metricThreeLabel: "已排课班级",
    metricThreeValue: (schedule: NonNullable<ScheduleResponse["data"]>) => String(schedule.summary.scheduledClassCount)
  },
  parent: {
    title: "孩子课表优先区",
    lead: "先看孩子下一节课和今天课表，再安排放学后的作业跟进。",
    loadingTitle: "孩子课表加载中",
    loadingDescription: "正在汇总今天课程、下一节提醒与课后衔接信息。",
    authTitle: "需要家长身份后查看课表",
    authDescription: "请重新登录家长账号后查看孩子今天的课程安排。",
    errorTitle: "孩子课表加载失败",
    emptyTitle: "孩子当前还没有课程表",
    emptyDescription: "学校完成排课后，这里会自动显示今日课程和课后衔接建议。",
    noNextTitle: "今天的课程已结束",
    noNextDescription: "可以转去家长端查看待跟进作业、错题复习和老师提醒。",
    noTodayTitle: "今天没有课程安排",
    noTodayDescription: "可把重点放在作业跟进、错题复盘和周报建议上。",
    openLabel: "打开孩子课表",
    fallbackHref: "/parent",
    fallbackLabel: "查看家长端",
    metricThreeLabel: "剩余节次",
    metricThreeValue: (schedule: NonNullable<ScheduleResponse["data"]>) => String(schedule.summary.remainingLessonsToday)
  }
} satisfies Record<RoleScheduleFocusCardProps["variant"], {
  title: string;
  lead: string;
  loadingTitle: string;
  loadingDescription: string;
  authTitle: string;
  authDescription: string;
  errorTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  noNextTitle: string;
  noNextDescription: string;
  noTodayTitle: string;
  noTodayDescription: string;
  openLabel: string;
  fallbackHref: string;
  fallbackLabel: string;
  metricThreeLabel: string;
  metricThreeValue: (schedule: NonNullable<ScheduleResponse["data"]>) => string;
}>;

function formatLessonRange(lesson: Pick<ScheduleLessonOccurrence, "startAt" | "endAt">) {
  return `${new Date(lesson.startAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}-${new Date(lesson.endAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

function getStatusLabel(status: ScheduleLessonOccurrence["status"]) {
  if (status === "in_progress") return "进行中";
  if (status === "upcoming") return "待上课";
  return "已结束";
}

export default function RoleScheduleFocusCard({ variant }: RoleScheduleFocusCardProps) {
  const copy = COPY[variant];
  const [schedule, setSchedule] = useState<ScheduleResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const loadSchedule = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const payload = await requestJson<ScheduleResponse>("/api/schedule");
      setSchedule(payload.data ?? null);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        setSchedule(null);
      } else {
        setError(getRequestErrorMessage(nextError, copy.errorTitle));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [copy.errorTitle]);

  useEffect(() => {
    void loadSchedule("initial");
  }, [loadSchedule]);

  const nextLesson = schedule?.nextLesson ?? null;
  const todayLessons = (schedule?.todayLessons ?? []).slice(0, 3);
  const actionHref = nextLesson?.actionHref ?? copy.fallbackHref;
  const actionLabel = nextLesson?.actionLabel ?? copy.fallbackLabel;

  return (
    <Card title={copy.title} tag="课表">
      {loading && !schedule && !error && !authRequired ? (
        <StatePanel compact tone="loading" title={copy.loadingTitle} description={copy.loadingDescription} />
      ) : authRequired ? (
        <StatePanel
          compact
          tone="info"
          title={copy.authTitle}
          description={copy.authDescription}
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      ) : error && !schedule ? (
        <StatePanel
          compact
          tone="error"
          title={copy.errorTitle}
          description={error}
          action={
            <button className="button secondary" type="button" onClick={() => void loadSchedule("initial")}>
              重试
            </button>
          }
        />
      ) : !nextLesson && !todayLessons.length ? (
        <StatePanel
          compact
          tone="empty"
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          action={
            <Link className="button secondary" href="/calendar">
              {copy.openLabel}
            </Link>
          }
        />
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginTop: 0 }}>
            <div>
              <div className="section-title" style={{ margin: 0 }}>{copy.lead}</div>
              <div className="section-sub" style={{ marginTop: 4 }}>
                {nextLesson
                  ? `${nextLesson.weekdayLabel} · ${new Date(nextLesson.startAt).toLocaleDateString("zh-CN")} · ${formatLessonRange(nextLesson)}`
                  : copy.noNextDescription}
              </div>
            </div>
            <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
              {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
              <button className="button ghost" type="button" onClick={() => void loadSchedule("refresh")} disabled={loading || refreshing}>
                {refreshing ? "刷新中..." : "刷新课表"}
              </button>
            </div>
          </div>

          <div className="grid grid-3">
            <div className="kpi">
              <div className="section-title kpi-title">今日课程</div>
              <div className="kpi-value">{schedule?.summary.totalLessonsToday ?? 0}</div>
            </div>
            <div className="kpi">
              <div className="section-title kpi-title">本周课时</div>
              <div className="kpi-value">{schedule?.summary.totalLessonsThisWeek ?? 0}</div>
            </div>
            <div className="kpi">
              <div className="section-title kpi-title">{copy.metricThreeLabel}</div>
              <div className="kpi-value">{schedule ? copy.metricThreeValue(schedule) : 0}</div>
            </div>
          </div>

          {nextLesson ? (
            <div className="card">
              <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div>
                  <div className="section-title">{nextLesson.className}</div>
                  <div className="section-sub" style={{ marginTop: 4 }}>
                    {nextLesson.subjectLabel} · {formatLessonRange(nextLesson)}
                    {nextLesson.room ? ` · ${nextLesson.room}` : ""}
                  </div>
                </div>
                <div className="badge-row" style={{ marginTop: 0 }}>
                  <span className="badge">{getStatusLabel(nextLesson.status)}</span>
                  {nextLesson.slotLabel ? <span className="badge">{nextLesson.slotLabel}</span> : null}
                  {nextLesson.pendingAssignmentCount ? <span className="badge">待完成 {nextLesson.pendingAssignmentCount} 项</span> : null}
                </div>
              </div>
              {nextLesson.focusSummary ? <div className="meta-text" style={{ marginTop: 8 }}>课堂焦点：{nextLesson.focusSummary}</div> : null}
              {nextLesson.nextAssignmentTitle ? (
                <div className="meta-text" style={{ marginTop: 8 }}>
                  课后联动：{nextLesson.nextAssignmentTitle}
                  {nextLesson.nextAssignmentDueAt ? ` · 截止 ${formatLoadedTime(nextLesson.nextAssignmentDueAt)}` : ""}
                </div>
              ) : null}
            </div>
          ) : (
            <StatePanel compact tone="success" title={copy.noNextTitle} description={copy.noNextDescription} />
          )}

          <div className="grid" style={{ gap: 8 }}>
            {todayLessons.length ? (
              todayLessons.map((lesson) => (
                <div className="card" key={`${lesson.id}-${lesson.date}`}>
                  <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div className="section-title">{lesson.className}</div>
                      <div className="section-sub" style={{ marginTop: 4 }}>
                        {lesson.subjectLabel} · {formatLessonRange(lesson)}
                        {lesson.room ? ` · ${lesson.room}` : ""}
                      </div>
                    </div>
                    <span className="pill">{getStatusLabel(lesson.status)}</span>
                  </div>
                  {lesson.focusSummary ? <div className="meta-text" style={{ marginTop: 6 }}>课堂焦点：{lesson.focusSummary}</div> : null}
                </div>
              ))
            ) : (
              <StatePanel compact tone="empty" title={copy.noTodayTitle} description={copy.noTodayDescription} />
            )}
          </div>

          <div className="cta-row">
            <Link className="button secondary" href="/calendar">
              {copy.openLabel}
            </Link>
            <Link className="button ghost" href={actionHref}>
              {actionLabel}
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
