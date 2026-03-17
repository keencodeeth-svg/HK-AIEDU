"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { ScheduleLessonOccurrence } from "@/lib/class-schedules";
import type { CalendarRoleAction } from "../types";
import TeacherPrestudyComposer from "./TeacherPrestudyComposer";
import {
  buildPrestudySummary,
  formatOccurrenceRange,
  getTeacherComposerKey
} from "../utils";

type Props = {
  nextLesson: ScheduleLessonOccurrence | null;
  isTeacher: boolean;
  activeComposerKey: string | null;
  emptyStateAction: CalendarRoleAction;
  supplementalAction: CalendarRoleAction;
  onOpenComposer: (composerKey: string) => void;
  onCloseComposer: () => void;
  onCreated: () => void;
};

export default function CalendarNextLessonCard({
  nextLesson,
  isTeacher,
  activeComposerKey,
  emptyStateAction,
  supplementalAction,
  onOpenComposer,
  onCloseComposer,
  onCreated
}: Props) {
  if (!nextLesson) {
    return (
      <Card title="下一节课" tag="优先">
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
      </Card>
    );
  }

  const composerKey = getTeacherComposerKey(nextLesson.id, nextLesson.date);
  const prestudySummary = buildPrestudySummary(nextLesson, isTeacher);

  return (
    <Card title="下一节课" tag="优先">
      <div className="grid" style={{ gap: 10 }}>
        <div className="feature-card">
          <div>
            <div className="section-title">{nextLesson.className}</div>
            <div className="section-sub">
              {nextLesson.subjectLabel} · {nextLesson.weekdayLabel} ·{" "}
              {new Date(nextLesson.startAt).toLocaleDateString("zh-CN")} · {formatOccurrenceRange(nextLesson)}
            </div>
          </div>
          <div className="badge-row" style={{ marginTop: 8 }}>
            {nextLesson.slotLabel ? <span className="badge">{nextLesson.slotLabel}</span> : null}
            <span className="badge">{nextLesson.status === "in_progress" ? "进行中" : "待上课"}</span>
            {nextLesson.room ? <span className="badge">{nextLesson.room}</span> : null}
            {nextLesson.prestudyAssignmentCount ? <span className="badge">预习已布置</span> : null}
            {nextLesson.pendingAssignmentCount ? (
              <span className="badge">待完成 {nextLesson.pendingAssignmentCount} 项</span>
            ) : null}
          </div>
        </div>
        {nextLesson.focusSummary ? <div className="meta-text">课堂焦点：{nextLesson.focusSummary}</div> : null}
        {prestudySummary ? <div className="meta-text">{prestudySummary}</div> : null}
        <div className="cta-row">
          {isTeacher ? (
            nextLesson.prestudyAssignmentId ? (
              <Link className="button secondary" href={`/teacher/assignments/${nextLesson.prestudyAssignmentId}`}>
                查看预习任务
              </Link>
            ) : (
              <button className="button primary" type="button" onClick={() => onOpenComposer(composerKey)}>
                布置预习任务
              </button>
            )
          ) : nextLesson.actionHref ? (
            <Link className="button secondary" href={nextLesson.actionHref}>
              {nextLesson.actionLabel ?? "去查看"}
            </Link>
          ) : null}
          <Link className="button ghost" href={supplementalAction.href}>
            {supplementalAction.label}
          </Link>
        </div>
        {isTeacher && activeComposerKey === composerKey ? (
          <TeacherPrestudyComposer
            lesson={nextLesson}
            lessonDate={nextLesson.date}
            lessonStartAt={nextLesson.startAt}
            onCreated={onCreated}
            onClose={onCloseComposer}
          />
        ) : null}
      </div>
    </Card>
  );
}
