"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime, getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import type { ScheduleLessonBase, ScheduleLessonOccurrence, ScheduleResponse } from "@/lib/class-schedules";
import TeacherPrestudyComposer from "./_components/TeacherPrestudyComposer";
import type { CalendarItem, CalendarItemType, CalendarResponse } from "./types";

const TYPE_LABELS: Record<CalendarItemType, string> = {
  lesson: "课程",
  assignment: "作业",
  announcement: "公告",
  correction: "订正"
};

const WEEKDAY_SHORT = ["一", "二", "三", "四", "五", "六", "日"];

function getTimelineStatusLabel(item: CalendarItem) {
  if (item.type === "lesson") {
    if (item.status === "in_progress") return "进行中";
    if (item.status === "upcoming") return "待上课";
    if (item.status === "finished") return "已结束";
  }
  if (item.status === "completed") return "已完成";
  if (item.status === "pending") return "待完成";
  return item.status || "待处理";
}

function formatLessonRange(lesson: Pick<ScheduleLessonBase, "startTime" | "endTime">) {
  return `${lesson.startTime}-${lesson.endTime}`;
}

function formatOccurrenceRange(lesson: Pick<ScheduleLessonOccurrence, "startAt" | "endAt">) {
  return `${new Date(lesson.startAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}-${new Date(lesson.endAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function getTeacherComposerKey(sessionId: string, lessonDate: string) {
  return `${sessionId}:${lessonDate}`;
}

export default function CalendarPage() {
  const [schedule, setSchedule] = useState<ScheduleResponse["data"] | null>(null);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [activeComposerKey, setActiveComposerKey] = useState<string | null>(null);

  const loadPage = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);

    try {
      const [schedulePayload, calendarPayload] = await Promise.all([
        requestJson<ScheduleResponse>("/api/schedule"),
        requestJson<CalendarResponse>("/api/calendar")
      ]);
      setSchedule(schedulePayload.data ?? null);
      setItems(calendarPayload.data ?? []);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      if (isAuthError(error)) {
        setAuthRequired(true);
        setSchedule(null);
        setItems([]);
      } else {
        setPageError(getRequestErrorMessage(error, "加载课程表失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPage("initial");
  }, [loadPage]);

  const isTeacher = schedule?.role === "teacher";
  const emptyStateAction =
    schedule?.role === "teacher"
      ? { href: "/teacher", label: "查看教学执行" }
      : schedule?.role === "parent"
        ? { href: "/parent", label: "查看家长看板" }
        : { href: "/student/assignments", label: "先看今日任务" };

  const supplementalAction =
    schedule?.role === "teacher"
      ? { href: "/teacher/modules", label: "查看课程模块" }
      : schedule?.role === "parent"
        ? { href: "/course", label: "查看课程主页" }
        : { href: "/student/assignments", label: "查看作业中心" };

  if (loading && !schedule && !items.length && !authRequired) {
    return <StatePanel title="课程表加载中" description="正在汇总本周课程、今日节次与学习时间线。" tone="loading" />;
  }

  if (authRequired) {
    return (
      <StatePanel
        title="需要登录后查看课程表"
        description="请使用学生、教师或家长账号登录后查看课程表和学习日程。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (pageError && !schedule && !items.length) {
    return (
      <StatePanel
        title="课程表加载失败"
        description={pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void loadPage("initial")}>重试</button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>课程表与学习日程</h2>
          <div className="section-sub">
            {isTeacher
              ? "先看下一节课，再直接从课表布置预习任务，学生首页会自动联动。"
              : "把固定课程、今日节次和学习任务放到同一视图里，减少来回切页找信息。"}
          </div>
        </div>
        <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <span className="chip">课表中心</span>
          <button className="button secondary" type="button" onClick={() => void loadPage("refresh")} disabled={loading || refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {pageError ? <StatePanel title="本次刷新存在异常" description={pageError} tone="error" compact /> : null}

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card title="下一节课" tag="优先">
          {!schedule?.nextLesson ? (
            <StatePanel
              compact
              tone="empty"
              title="近期没有排课"
              description="当前范围内还没有课程节次，学校配置课程表后这里会自动出现。"
              action={
                <Link className="button secondary" href={emptyStateAction.href}>
                  {emptyStateAction.label}
                </Link>
              }
            />
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              <div className="feature-card">
                <div>
                  <div className="section-title">{schedule.nextLesson.className}</div>
                  <div className="section-sub">
                    {schedule.nextLesson.subjectLabel} · {schedule.nextLesson.weekdayLabel} · {new Date(schedule.nextLesson.startAt).toLocaleDateString("zh-CN")} · {formatOccurrenceRange(schedule.nextLesson)}
                  </div>
                </div>
                <div className="badge-row" style={{ marginTop: 8 }}>
                  {schedule.nextLesson.slotLabel ? <span className="badge">{schedule.nextLesson.slotLabel}</span> : null}
                  <span className="badge">{schedule.nextLesson.status === "in_progress" ? "进行中" : "待上课"}</span>
                  {schedule.nextLesson.room ? <span className="badge">{schedule.nextLesson.room}</span> : null}
                  {schedule.nextLesson.prestudyAssignmentCount ? <span className="badge">预习已布置</span> : null}
                  {schedule.nextLesson.pendingAssignmentCount ? <span className="badge">待完成 {schedule.nextLesson.pendingAssignmentCount} 项</span> : null}
                </div>
              </div>
              {schedule.nextLesson.focusSummary ? <div className="meta-text">课堂焦点：{schedule.nextLesson.focusSummary}</div> : null}
              {schedule.nextLesson.prestudyAssignmentTitle ? (
                <div className="meta-text">
                  课前预习：{schedule.nextLesson.prestudyAssignmentTitle}
                  {schedule.nextLesson.prestudyAssignmentDueAt ? ` · 截止 ${formatLoadedTime(schedule.nextLesson.prestudyAssignmentDueAt)}` : ""}
                  {isTeacher && typeof schedule.nextLesson.prestudyTotalCount === "number" ? ` · 已完成 ${schedule.nextLesson.prestudyCompletedCount ?? 0}/${schedule.nextLesson.prestudyTotalCount}` : ""}
                  {!isTeacher && schedule.nextLesson.prestudyAssignmentStatus ? ` · 当前 ${schedule.nextLesson.prestudyAssignmentStatus === "completed" ? "已完成" : "待完成"}` : ""}
                </div>
              ) : schedule.nextLesson.nextAssignmentTitle ? (
                <div className="meta-text">课前联动：{schedule.nextLesson.nextAssignmentTitle} · {schedule.nextLesson.nextAssignmentDueAt ? `截止 ${formatLoadedTime(schedule.nextLesson.nextAssignmentDueAt)}` : "待完成"}</div>
              ) : isTeacher ? (
                <div className="meta-text">建议现在补 1 个预习任务，学生首页会把它放到“下一步该做什么”里。</div>
              ) : null}
              <div className="cta-row">
                {isTeacher ? (
                  schedule.nextLesson.prestudyAssignmentId ? (
                    <Link className="button secondary" href={`/teacher/assignments/${schedule.nextLesson.prestudyAssignmentId}`}>
                      查看预习任务
                    </Link>
                  ) : (
                    <button
                      className="button primary"
                      type="button"
                      onClick={() => setActiveComposerKey(getTeacherComposerKey(schedule.nextLesson!.id, schedule.nextLesson!.date))}
                    >
                      布置预习任务
                    </button>
                  )
                ) : schedule.nextLesson.actionHref ? (
                  <Link className="button secondary" href={schedule.nextLesson.actionHref}>
                    {schedule.nextLesson.actionLabel ?? "去查看"}
                  </Link>
                ) : null}
                <Link className="button ghost" href={supplementalAction.href}>
                  {supplementalAction.label}
                </Link>
              </div>
              {isTeacher && activeComposerKey === getTeacherComposerKey(schedule.nextLesson.id, schedule.nextLesson.date) ? (
                <TeacherPrestudyComposer
                  lesson={schedule.nextLesson}
                  lessonDate={schedule.nextLesson.date}
                  lessonStartAt={schedule.nextLesson.startAt}
                  onCreated={() => loadPage("refresh")}
                  onClose={() => setActiveComposerKey(null)}
                />
              ) : null}
            </div>
          )}
        </Card>

        <Card title="今日课表概览" tag="Today">
          <div className="grid grid-2">
            <div className="kpi">
              <div className="section-title kpi-title">今日课程</div>
              <div className="kpi-value">{schedule?.summary.totalLessonsToday ?? 0}</div>
            </div>
            <div className="kpi">
              <div className="section-title kpi-title">剩余节次</div>
              <div className="kpi-value">{schedule?.summary.remainingLessonsToday ?? 0}</div>
            </div>
            <div className="kpi">
              <div className="section-title kpi-title">已排课班级</div>
              <div className="kpi-value">{schedule?.summary.scheduledClassCount ?? 0}</div>
            </div>
            <div className="kpi">
              <div className="section-title kpi-title">本周总节次</div>
              <div className="kpi-value">{schedule?.summary.totalLessonsThisWeek ?? 0}</div>
            </div>
          </div>
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            {schedule?.todayLessons?.length ? (
              schedule.todayLessons.map((lesson) => (
                <div className="card" key={`${lesson.id}-${lesson.date}`}>
                  <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div className="section-title">{lesson.className}</div>
                      <div className="section-sub">{lesson.subjectLabel} · {formatOccurrenceRange(lesson)}{lesson.room ? ` · ${lesson.room}` : ""}</div>
                    </div>
                    <div className="badge-row" style={{ marginTop: 0 }}>
                      <span className="pill">{lesson.status === "in_progress" ? "进行中" : lesson.status === "upcoming" ? "待上课" : "已结束"}</span>
                      {lesson.prestudyAssignmentTitle ? <span className="pill">预习已联动</span> : null}
                    </div>
                  </div>
                  {lesson.focusSummary ? <div className="meta-text" style={{ marginTop: 6 }}>课堂焦点：{lesson.focusSummary}</div> : null}
                  {lesson.prestudyAssignmentTitle ? (
                    <div className="meta-text" style={{ marginTop: 6 }}>
                      课前预习：{lesson.prestudyAssignmentTitle}
                      {lesson.prestudyAssignmentDueAt ? ` · 截止 ${formatLoadedTime(lesson.prestudyAssignmentDueAt)}` : ""}
                      {isTeacher && typeof lesson.prestudyTotalCount === "number" ? ` · 已完成 ${lesson.prestudyCompletedCount ?? 0}/${lesson.prestudyTotalCount}` : ""}
                      {!isTeacher && lesson.prestudyAssignmentStatus ? ` · 当前 ${lesson.prestudyAssignmentStatus === "completed" ? "已完成" : "待完成"}` : ""}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <StatePanel compact tone="empty" title="今天没有课程" description="可以把重点放在作业、复练或专项训练上。" />
            )}
          </div>
        </Card>
      </div>

      <Card title="本周课程表" tag="周视图">
        {!schedule?.weekly?.some((day) => day.lessons.length > 0) ? (
          <StatePanel compact tone="empty" title="当前还没有周课表" description="学校配置课程表后，这里会自动按周展示固定节次。" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.max(schedule?.weekly?.length ?? 0, 1)}, minmax(180px, 1fr))`,
                gap: 12,
                minWidth: 1280
              }}
            >
              {(schedule?.weekly ?? []).map((day, index) => (
                <div className="card" key={`${day.weekday}-${day.date}`} style={{ minHeight: 220 }}>
                  <div className="section-title">周{WEEKDAY_SHORT[index]}</div>
                  <div className="section-sub">{formatDateLabel(day.date)}</div>
                  <div className="grid" style={{ gap: 8, marginTop: 10 }}>
                    {day.lessons.length ? (
                      day.lessons.map((lesson) => {
                        const lessonDate = lesson.nextOccurrenceDate ?? day.date;
                        const lessonStartAt = lesson.nextOccurrenceStartAt ?? `${lessonDate}T${lesson.startTime}:00`;
                        const composerKey = getTeacherComposerKey(lesson.id, lessonDate);
                        return (
                          <div
                            key={lesson.id}
                            style={{
                              border: "1px solid var(--stroke)",
                              borderRadius: 14,
                              padding: 10,
                              background: "rgba(255,255,255,0.7)"
                            }}
                          >
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{lesson.className}</div>
                            <div className="section-sub" style={{ marginTop: 4 }}>{formatLessonRange(lesson)} · {lesson.subjectLabel}</div>
                            <div className="badge-row" style={{ marginTop: 6 }}>
                              {lesson.slotLabel ? <span className="badge">{lesson.slotLabel}</span> : null}
                              {lesson.room ? <span className="badge">{lesson.room}</span> : null}
                              {lesson.prestudyAssignmentTitle ? <span className="badge">预习已布置</span> : null}
                            </div>
                            {lesson.focusSummary ? <div className="meta-text" style={{ marginTop: 6 }}>课堂焦点：{lesson.focusSummary}</div> : null}
                            {lesson.nextOccurrenceDate && lesson.nextOccurrenceDate !== day.date ? (
                              <div className="meta-text" style={{ marginTop: 6 }}>下次课次：{formatDateLabel(lesson.nextOccurrenceDate)}</div>
                            ) : null}
                            {lesson.prestudyAssignmentTitle ? (
                              <div className="meta-text" style={{ marginTop: 6 }}>
                                课前预习：{lesson.prestudyAssignmentTitle}
                                {lesson.prestudyAssignmentDueAt ? ` · 截止 ${formatLoadedTime(lesson.prestudyAssignmentDueAt)}` : ""}
                                {isTeacher && typeof lesson.prestudyTotalCount === "number" ? ` · 已完成 ${lesson.prestudyCompletedCount ?? 0}/${lesson.prestudyTotalCount}` : ""}
                                {!isTeacher && lesson.prestudyAssignmentStatus ? ` · 当前 ${lesson.prestudyAssignmentStatus === "completed" ? "已完成" : "待完成"}` : ""}
                              </div>
                            ) : null}
                            {isTeacher ? (
                              <div className="cta-row" style={{ marginTop: 10 }}>
                                {lesson.prestudyAssignmentId ? (
                                  <Link className="button secondary" href={`/teacher/assignments/${lesson.prestudyAssignmentId}`}>
                                    查看预习
                                  </Link>
                                ) : (
                                  <button className="button primary" type="button" onClick={() => setActiveComposerKey(composerKey)}>
                                    布置预习
                                  </button>
                                )}
                              </div>
                            ) : null}
                            {isTeacher && activeComposerKey === composerKey ? (
                              <TeacherPrestudyComposer
                                lesson={lesson}
                                lessonDate={lessonDate}
                                lessonStartAt={lessonStartAt}
                                onCreated={() => loadPage("refresh")}
                                onClose={() => setActiveComposerKey(null)}
                              />
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <div className="section-sub">暂无课程</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="学习时间线" tag={`${items.length} 项`}>
        {!items.length ? (
          <StatePanel compact tone="empty" title="当前没有时间线事件" description="后续课程、作业、公告和订正提醒会集中出现在这里。" />
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {items.map((item) => (
              <div className="card" key={`${item.type}-${item.id}-${item.date}`}>
                <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div className="section-title">{item.title}</div>
                    <div className="section-sub" style={{ marginTop: 4 }}>
                      {new Date(item.date).toLocaleString("zh-CN")} {item.className ? `· ${item.className}` : ""}
                    </div>
                  </div>
                  <div className="badge-row" style={{ marginTop: 0 }}>
                    <span className="pill">{TYPE_LABELS[item.type]}</span>
                    {item.status ? <span className="pill">{getTimelineStatusLabel(item)}</span> : null}
                  </div>
                </div>
                {item.description ? <div className="meta-text" style={{ marginTop: 8 }}>{item.description}</div> : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
