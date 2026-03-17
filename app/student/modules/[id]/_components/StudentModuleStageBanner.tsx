"use client";

import { getGradeLabel, SUBJECT_LABELS } from "@/lib/constants";
import type { StudentModuleClassSummary, StudentModuleStageCopy } from "../types";

type Props = {
  classroom: StudentModuleClassSummary;
  resourceCount: number;
  assignmentCount: number;
  completedCount: number;
  stageCopy: StudentModuleStageCopy;
};

export default function StudentModuleStageBanner({
  classroom,
  resourceCount,
  assignmentCount,
  completedCount,
  stageCopy
}: Props) {
  return (
    <div className="student-module-stage-banner">
      <div className="student-module-stage-kicker">当前阶段</div>
      <div className="student-module-stage-title">{stageCopy.title}</div>
      <p className="student-module-stage-description">{stageCopy.description}</p>
      <div className="pill-list">
        <span className="pill">{SUBJECT_LABELS[classroom.subject] ?? classroom.subject}</span>
        <span className="pill">{getGradeLabel(classroom.grade)}</span>
        <span className="pill">资料 {resourceCount}</span>
        <span className="pill">任务 {assignmentCount}</span>
        <span className="pill">已完成 {completedCount}</span>
      </div>
    </div>
  );
}
