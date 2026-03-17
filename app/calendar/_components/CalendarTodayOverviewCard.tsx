"use client";

import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { ScheduleApiPayload, ScheduleLessonOccurrence } from "@/lib/class-schedules";
import { buildPrestudySummary, formatOccurrenceRange } from "../utils";

type Props = {
  summary: ScheduleApiPayload["summary"] | null;
  todayLessons: ScheduleLessonOccurrence[];
  isTeacher: boolean;
};

export default function CalendarTodayOverviewCard({ summary, todayLessons, isTeacher }: Props) {
  return (
    <Card title="今日课表概览" tag="Today">
      <div className="grid grid-2">
        <div className="kpi">
          <div className="section-title kpi-title">今日课程</div>
          <div className="kpi-value">{summary?.totalLessonsToday ?? 0}</div>
        </div>
        <div className="kpi">
          <div className="section-title kpi-title">剩余节次</div>
          <div className="kpi-value">{summary?.remainingLessonsToday ?? 0}</div>
        </div>
        <div className="kpi">
          <div className="section-title kpi-title">已排课班级</div>
          <div className="kpi-value">{summary?.scheduledClassCount ?? 0}</div>
        </div>
        <div className="kpi">
          <div className="section-title kpi-title">本周总节次</div>
          <div className="kpi-value">{summary?.totalLessonsThisWeek ?? 0}</div>
        </div>
      </div>
      <div className="grid" style={{ gap: 8, marginTop: 12 }}>
        {todayLessons.length ? (
          todayLessons.map((lesson) => {
            const prestudySummary = buildPrestudySummary(lesson, isTeacher);
            return (
              <div className="card" key={`${lesson.id}-${lesson.date}`}>
                <div
                  className="cta-row"
                  style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}
                >
                  <div>
                    <div className="section-title">{lesson.className}</div>
                    <div className="section-sub">
                      {lesson.subjectLabel} · {formatOccurrenceRange(lesson)}
                      {lesson.room ? ` · ${lesson.room}` : ""}
                    </div>
                  </div>
                  <div className="badge-row" style={{ marginTop: 0 }}>
                    <span className="pill">
                      {lesson.status === "in_progress"
                        ? "进行中"
                        : lesson.status === "upcoming"
                          ? "待上课"
                          : "已结束"}
                    </span>
                    {lesson.prestudyAssignmentTitle ? <span className="pill">预习已联动</span> : null}
                  </div>
                </div>
                {lesson.focusSummary ? (
                  <div className="meta-text" style={{ marginTop: 6 }}>
                    课堂焦点：{lesson.focusSummary}
                  </div>
                ) : null}
                {prestudySummary ? (
                  <div className="meta-text" style={{ marginTop: 6 }}>
                    {prestudySummary}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <StatePanel
            compact
            tone="empty"
            title="今天没有课程"
            description="可以把重点放在作业、复练或专项训练上。"
          />
        )}
      </div>
    </Card>
  );
}
