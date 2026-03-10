"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime } from "@/lib/client-request";
import type { ScheduleResponse } from "@/lib/class-schedules";

type StudentScheduleCardProps = {
  schedule: ScheduleResponse["data"] | null;
  loading: boolean;
  refreshing: boolean;
  authRequired: boolean;
  error: string | null;
  lastLoadedAt: string | null;
  onRefresh: () => void;
};

function formatLessonRange(startAt: string, endAt: string) {
  return `${new Date(startAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}-${new Date(endAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function StudentScheduleCard({
  schedule,
  loading,
  refreshing,
  authRequired,
  error,
  lastLoadedAt,
  onRefresh
}: StudentScheduleCardProps) {
  return (
    <Card title="课程表优先区" tag="课表">
      {loading && !schedule && !error && !authRequired ? (
        <StatePanel compact tone="loading" title="课程表加载中" description="正在汇总今天课程与下一节提醒。" />
      ) : authRequired ? (
        <StatePanel
          compact
          tone="info"
          title="需要登录后查看课程表"
          description="请重新登录学生账号后查看今日课程。"
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
          title="课程表加载失败"
          description={error}
          action={
            <button className="button secondary" type="button" onClick={onRefresh}>
              重试
            </button>
          }
        />
      ) : !schedule?.nextLesson && !schedule?.todayLessons?.length ? (
        <StatePanel
          compact
          tone="empty"
          title="学校还没有给你排课程表"
          description="课程表配置完成后，这里会优先显示下一节课、今日节次和课前准备联动。"
          action={
            <div className="cta-row no-margin">
              <Link className="button secondary" href="/student/assignments">
                去作业中心
              </Link>
              <Link className="button ghost" href="/calendar">
                打开日程页
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginTop: 0 }}>
            <div>
              <div className="section-title" style={{ margin: 0 }}>先看下一节课，再决定当前学习动作</div>
              <div className="section-sub" style={{ marginTop: 4 }}>
                {schedule?.nextLesson
                  ? `${schedule.nextLesson.weekdayLabel} · ${new Date(schedule.nextLesson.startAt).toLocaleDateString("zh-CN")} · ${formatLessonRange(schedule.nextLesson.startAt, schedule.nextLesson.endAt)}`
                  : "今天没有下一节课，按当前任务队列安排学习。"}
              </div>
            </div>
            <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
              {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
              <button className="button ghost" type="button" onClick={onRefresh} disabled={loading || refreshing}>
                {refreshing ? "刷新中..." : "刷新课表"}
              </button>
            </div>
          </div>

          {error && schedule ? (
            <StatePanel compact tone="error" title="课表刷新未完成" description={error} />
          ) : null}

          {schedule?.nextLesson ? (
            <div className="card">
              <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div>
                  <div className="section-title">{schedule.nextLesson.className}</div>
                  <div className="section-sub" style={{ marginTop: 4 }}>
                    {schedule.nextLesson.subjectLabel} · {formatLessonRange(schedule.nextLesson.startAt, schedule.nextLesson.endAt)}
                    {schedule.nextLesson.room ? ` · ${schedule.nextLesson.room}` : ""}
                  </div>
                </div>
                <div className="badge-row" style={{ marginTop: 0 }}>
                  <span className="badge">{schedule.nextLesson.status === "in_progress" ? "进行中" : "待上课"}</span>
                  {schedule.nextLesson.slotLabel ? <span className="badge">{schedule.nextLesson.slotLabel}</span> : null}
                  {schedule.nextLesson.prestudyAssignmentTitle ? <span className="badge">预习已布置</span> : null}
                  {schedule.nextLesson.pendingAssignmentCount ? <span className="badge">待完成 {schedule.nextLesson.pendingAssignmentCount} 项</span> : null}
                </div>
              </div>
              {schedule.nextLesson.focusSummary ? <div className="meta-text" style={{ marginTop: 8 }}>课堂焦点：{schedule.nextLesson.focusSummary}</div> : null}
              {schedule.nextLesson.prestudyAssignmentTitle ? (
                <div className="meta-text" style={{ marginTop: 6 }}>
                  课前预习：{schedule.nextLesson.prestudyAssignmentTitle}
                  {schedule.nextLesson.prestudyAssignmentDueAt ? ` · 截止 ${formatLoadedTime(schedule.nextLesson.prestudyAssignmentDueAt)}` : ""}
                  {schedule.nextLesson.prestudyAssignmentStatus ? ` · 当前 ${schedule.nextLesson.prestudyAssignmentStatus === "completed" ? "已完成" : "待完成"}` : ""}
                </div>
              ) : schedule.nextLesson.nextAssignmentTitle ? (
                <div className="meta-text" style={{ marginTop: 6 }}>
                  课前联动：{schedule.nextLesson.nextAssignmentTitle}
                  {schedule.nextLesson.nextAssignmentDueAt ? ` · 截止 ${formatLoadedTime(schedule.nextLesson.nextAssignmentDueAt)}` : ""}
                </div>
              ) : null}
              <div className="cta-row" style={{ marginTop: 10 }}>
                {schedule.nextLesson.actionHref ? (
                  <Link className="button secondary" href={schedule.nextLesson.actionHref}>
                    {schedule.nextLesson.actionLabel ?? "去准备"}
                  </Link>
                ) : null}
                <Link className="button ghost" href="/calendar">
                  查看完整课程表
                </Link>
              </div>
            </div>
          ) : null}

          <div className="grid grid-2">
            <div className="kpi">
              <div className="section-title kpi-title">今日课程</div>
              <div className="kpi-value">{schedule?.summary.totalLessonsToday ?? 0}</div>
            </div>
            <div className="kpi">
              <div className="section-title kpi-title">剩余节次</div>
              <div className="kpi-value">{schedule?.summary.remainingLessonsToday ?? 0}</div>
            </div>
          </div>

          <div className="grid" style={{ gap: 8 }}>
            {(schedule?.todayLessons ?? []).slice(0, 3).map((lesson) => (
              <div className="card" key={`${lesson.id}-${lesson.date}`}>
                <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div className="section-title">{lesson.className}</div>
                    <div className="section-sub" style={{ marginTop: 4 }}>
                      {formatLessonRange(lesson.startAt, lesson.endAt)} · {lesson.subjectLabel}
                      {lesson.room ? ` · ${lesson.room}` : ""}
                    </div>
                  </div>
                  <span className="pill">{lesson.status === "in_progress" ? "进行中" : lesson.status === "upcoming" ? "待上课" : "已结束"}</span>
                </div>
                {lesson.focusSummary ? <div className="meta-text" style={{ marginTop: 6 }}>{lesson.focusSummary}</div> : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
