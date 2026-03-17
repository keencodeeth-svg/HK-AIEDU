"use client";

import Link from "next/link";
import type { AssignmentLessonLink } from "../types";

type Props = {
  lessonLink: AssignmentLessonLink;
  lessonSchedule: string;
};

export default function AssignmentLessonContextCard({ lessonLink, lessonSchedule }: Props) {
  return (
    <div className="card">
      <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div className="section-title">这是一份课前预习任务</div>
          <div className="section-sub" style={{ marginTop: 4 }}>
            {lessonSchedule}
          </div>
        </div>
        <Link className="button ghost" href="/calendar">
          回到课程表
        </Link>
      </div>
      {lessonLink.focusSummary ? (
        <div className="meta-text" style={{ marginTop: 8 }}>
          课堂焦点：{lessonLink.focusSummary}
        </div>
      ) : null}
      {lessonLink.note ? (
        <div className="meta-text" style={{ marginTop: 6 }}>
          老师提醒：{lessonLink.note}
        </div>
      ) : null}
    </div>
  );
}
