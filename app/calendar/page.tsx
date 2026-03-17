"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import CalendarNextLessonCard from "./_components/CalendarNextLessonCard";
import CalendarTimelineCard from "./_components/CalendarTimelineCard";
import CalendarTodayOverviewCard from "./_components/CalendarTodayOverviewCard";
import CalendarWeeklyScheduleCard from "./_components/CalendarWeeklyScheduleCard";
import { useCalendarPageView } from "./useCalendarPageView";

export default function CalendarPage() {
  const calendarPage = useCalendarPageView();

  if (calendarPage.loading && !calendarPage.hasSchedule && !calendarPage.hasTimelineItems && !calendarPage.authRequired) {
    return <StatePanel title="课程表加载中" description="正在汇总本周课程、今日节次与学习时间线。" tone="loading" />;
  }

  if (calendarPage.authRequired) {
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

  if (calendarPage.pageError && !calendarPage.hasSchedule && !calendarPage.hasTimelineItems) {
    return (
      <StatePanel
        title="课程表加载失败"
        description={calendarPage.pageError ?? undefined}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={calendarPage.loadInitial}>重试</button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>课程表与学习日程</h2>
          <div className="section-sub">{calendarPage.headerDescription}</div>
        </div>
        <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {calendarPage.lastLoadedAtLabel ? <span className="chip">更新于 {calendarPage.lastLoadedAtLabel}</span> : null}
          <span className="chip">课表中心</span>
          <button className="button secondary" type="button" onClick={calendarPage.reload} disabled={calendarPage.loading || calendarPage.refreshing}>
            {calendarPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {calendarPage.pageError ? (
        <StatePanel title="本次刷新存在异常" description={calendarPage.pageError} tone="error" compact />
      ) : null}

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <CalendarNextLessonCard {...calendarPage.nextLessonCardProps} />
        <CalendarTodayOverviewCard {...calendarPage.todayOverviewCardProps} />
      </div>

      <CalendarWeeklyScheduleCard {...calendarPage.weeklyScheduleCardProps} />
      <CalendarTimelineCard {...calendarPage.timelineCardProps} />
    </div>
  );
}
