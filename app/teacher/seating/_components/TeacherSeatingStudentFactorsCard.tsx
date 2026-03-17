"use client";

import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import type { TeacherSeatingStudent } from "../types";
import { getPerformanceTone, getStudentDisplayName, isFocusPriorityStudent, isFrontPriorityStudent } from "../utils";

type TeacherSeatingStudentFactorsCardProps = {
  roster: TeacherSeatingStudent[];
};

export function TeacherSeatingStudentFactorsCard({ roster }: TeacherSeatingStudentFactorsCardProps) {
  return (
    <Card title="学生画像与排座因子" tag="画像">
      <div className="feature-card">
        <EduIcon name="chart" />
        <p>这里能看到学期排座配置用到的关键信息；资料缺口越少，预览结果通常越稳定。</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
        {roster.map((student) => (
          <div key={student.id} className="card">
            <div className="section-title" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{getStudentDisplayName(student)}</span>
              <span style={{ color: getPerformanceTone(student.performanceBand) }}>{student.placementScore} 分</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-1)" }}>{student.email}</p>
            <p style={{ fontSize: 12, color: "var(--ink-1)" }}>
              完整度 {student.profileCompleteness}% · {student.scoreSource === "quiz" ? "测验成绩" : "完成度推断"}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {student.tags.map((tag) => (
                <span key={`${student.id}-${tag}`} className="badge">
                  {tag}
                </span>
              ))}
              {isFrontPriorityStudent(student) ? <span className="badge">前排关注</span> : null}
              {isFocusPriorityStudent(student) ? <span className="badge">低干扰优先</span> : null}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 8 }}>
              完成 {student.completed} · 待完成 {student.pending} · 逾期 {student.overdue} · 迟交 {student.late}
            </div>
            {student.strengths ? <div style={{ marginTop: 8, fontSize: 12 }}>优势：{student.strengths}</div> : null}
            {student.supportNotes ? <div style={{ marginTop: 6, fontSize: 12 }}>关注：{student.supportNotes}</div> : null}
            {student.missingProfileFields.length ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#b54708" }}>
                待补字段：{student.missingProfileFields.join("、")}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
