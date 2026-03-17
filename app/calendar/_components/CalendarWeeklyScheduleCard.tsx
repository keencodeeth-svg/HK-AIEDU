"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { ScheduleApiPayload } from "@/lib/class-schedules";
import TeacherPrestudyComposer from "./TeacherPrestudyComposer";
import {
  buildPrestudySummary,
  formatCalendarDateLabel,
  formatLessonRange,
  getTeacherComposerKey
} from "../utils";

type Props = {
  weekly: ScheduleApiPayload["weekly"];
  isTeacher: boolean;
  activeComposerKey: string | null;
  onOpenComposer: (composerKey: string) => void;
  onCloseComposer: () => void;
  onCreated: () => void;
};

export default function CalendarWeeklyScheduleCard({
  weekly,
  isTeacher,
  activeComposerKey,
  onOpenComposer,
  onCloseComposer,
  onCreated
}: Props) {
  const hasLessons = weekly.some((day) => day.lessons.length > 0);

  return (
    <Card title="本周课程表" tag="周视图">
      {!hasLessons ? (
        <StatePanel
          compact
          tone="empty"
          title="当前还没有周课表"
          description="学校配置课程表后，这里会自动按周展示固定节次。"
        />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.max(weekly.length, 1)}, minmax(180px, 1fr))`,
              gap: 12,
              minWidth: 1280
            }}
          >
            {weekly.map((day) => (
              <div className="card" key={`${day.weekday}-${day.date}`} style={{ minHeight: 220 }}>
                <div className="section-title">周{day.shortLabel}</div>
                <div className="section-sub">{formatCalendarDateLabel(day.date)}</div>
                <div className="grid" style={{ gap: 8, marginTop: 10 }}>
                  {day.lessons.length ? (
                    day.lessons.map((lesson) => {
                      const lessonDate = lesson.nextOccurrenceDate ?? day.date;
                      const lessonStartAt =
                        lesson.nextOccurrenceStartAt ?? `${lessonDate}T${lesson.startTime}:00`;
                      const composerKey = getTeacherComposerKey(lesson.id, lessonDate);
                      const prestudySummary = buildPrestudySummary(lesson, isTeacher);

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
                          <div className="section-sub" style={{ marginTop: 4 }}>
                            {formatLessonRange(lesson)} · {lesson.subjectLabel}
                          </div>
                          <div className="badge-row" style={{ marginTop: 6 }}>
                            {lesson.slotLabel ? <span className="badge">{lesson.slotLabel}</span> : null}
                            {lesson.room ? <span className="badge">{lesson.room}</span> : null}
                            {lesson.prestudyAssignmentTitle ? <span className="badge">预习已布置</span> : null}
                          </div>
                          {lesson.focusSummary ? (
                            <div className="meta-text" style={{ marginTop: 6 }}>
                              课堂焦点：{lesson.focusSummary}
                            </div>
                          ) : null}
                          {lesson.nextOccurrenceDate && lesson.nextOccurrenceDate !== day.date ? (
                            <div className="meta-text" style={{ marginTop: 6 }}>
                              下次课次：{formatCalendarDateLabel(lesson.nextOccurrenceDate)}
                            </div>
                          ) : null}
                          {prestudySummary ? (
                            <div className="meta-text" style={{ marginTop: 6 }}>
                              {prestudySummary}
                            </div>
                          ) : null}
                          {isTeacher ? (
                            <div className="cta-row" style={{ marginTop: 10 }}>
                              {lesson.prestudyAssignmentId ? (
                                <Link
                                  className="button secondary"
                                  href={`/teacher/assignments/${lesson.prestudyAssignmentId}`}
                                >
                                  查看预习
                                </Link>
                              ) : (
                                <button
                                  className="button primary"
                                  type="button"
                                  onClick={() => onOpenComposer(composerKey)}
                                >
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
                              onCreated={onCreated}
                              onClose={onCloseComposer}
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
  );
}
