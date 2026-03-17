"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { ASSIGNMENT_TYPE_LABELS } from "@/lib/constants";
import type { StudentModuleAssignment } from "../types";
import { getStudentModuleAssignmentStatusMeta } from "../utils";

type Props = {
  assignments: StudentModuleAssignment[];
};

export default function StudentModuleAssignmentsCard({ assignments }: Props) {
  return (
    <Card title="模块作业" tag="作业">
      <div id="student-module-assignments" className="feature-card">
        <EduIcon name="book" />
        <p>模块作业会沿着当前单元的学习内容组织，建议按资料 → 作业 → 回顾的顺序推进。</p>
      </div>

      {assignments.length ? (
        <div className="grid" style={{ gap: 10, marginTop: 12 }}>
          {assignments.map((assignment) => {
            const statusMeta = getStudentModuleAssignmentStatusMeta(assignment);
            return (
              <div className="card student-module-assignment-card" key={assignment.id}>
                <div className="section-title">{assignment.title}</div>
                <div className="workflow-card-meta">
                  <span className={`gradebook-pill ${statusMeta.tone}`}>{statusMeta.label}</span>
                  <span className="pill">截止 {new Date(assignment.dueDate).toLocaleDateString("zh-CN")}</span>
                  <span className="pill">{ASSIGNMENT_TYPE_LABELS[assignment.submissionType ?? "quiz"]}</span>
                  {assignment.gradingFocus ? <span className="pill">关注：{assignment.gradingFocus}</span> : null}
                </div>
                <div className="student-module-resource-meta">
                  {assignment.description?.trim() || "进入作业后可查看完整题目、提交要求和当前完成情况。"}
                </div>
                <div className="cta-row student-module-next-actions">
                  <Link className="button secondary" href={`/student/assignments/${assignment.id}`}>
                    {assignment.status === "completed" ? "查看作业结果" : "进入作业"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <StatePanel
            compact
            tone="empty"
            title="当前模块还没有作业任务"
            description="可以先看资料和课件，等老师布置模块作业后，这里会自动同步。"
            action={
              <Link className="button secondary" href="/student/modules">
                返回模块列表
              </Link>
            }
          />
        </div>
      )}
    </Card>
  );
}
