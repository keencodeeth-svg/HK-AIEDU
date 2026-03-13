import Card from "@/components/Card";
import type { ExamStudent } from "../types";
import { getRiskTone } from "../utils";

type ExamStudentsCardProps = {
  students: ExamStudent[];
};

export default function ExamStudentsCard({ students }: ExamStudentsCardProps) {
  const submittedCount = students.filter((student) => student.status === "submitted").length;
  const highRiskCount = students.filter((student) => student.riskLevel === "high").length;
  const mediumRiskCount = students.filter((student) => student.riskLevel === "medium").length;

  return (
    <Card title="学生风险跟进" tag="Student">
      <div id="exam-students">
        {students.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">暂无学生</p>
            <p>班级中还没有可分配考试的学生。</p>
          </div>
        ) : (
          <>
            <div className="workflow-card-meta">
              <span className="pill">已提交 {submittedCount} 人</span>
              <span className="pill">待提交 {students.length - submittedCount} 人</span>
              <span className="pill">高风险 {highRiskCount} 人</span>
              <span className="pill">中风险 {mediumRiskCount} 人</span>
            </div>

            <div className="meta-text" style={{ marginTop: 12 }}>
              学生已经按风险分值排序，最前面的就是最该先看的人。考试详情页不需要你自己再从头扫一遍名单。
            </div>

            <div className="grid" style={{ gap: 10, marginTop: 12 }}>
              {students.map((student) => {
                const tone = getRiskTone(student.riskLevel ?? "low");
                return (
                  <div className="card" key={student.id} style={{ borderColor: tone.bg }}>
                    <div className="card-header">
                      <div className="section-title">{student.name}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className="card-tag">{student.status === "submitted" ? "已提交" : "待提交"}</span>
                        <span
                          style={{
                            fontSize: 12,
                            borderRadius: 999,
                            padding: "3px 8px",
                            background: tone.bg,
                            color: tone.color
                          }}
                        >
                          {tone.label} · {student.riskScore}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-1)" }}>{student.email}</div>
                    <div className="pill-list" style={{ marginTop: 8 }}>
                      {student.status === "submitted" ? (
                        <>
                          <span className="pill">得分 {student.score ?? 0}/{student.total ?? 0}</span>
                          <span className="pill">
                            提交于 {student.submittedAt ? new Date(student.submittedAt).toLocaleString("zh-CN") : "-"}
                          </span>
                        </>
                      ) : (
                        <span className="pill">尚未提交</span>
                      )}
                      <span className="pill">离屏 {student.visibilityHiddenCount}</span>
                      <span className="pill">切屏 {student.blurCount}</span>
                      {student.lastExamEventAt ? (
                        <span className="pill">最近异常 {new Date(student.lastExamEventAt).toLocaleString("zh-CN")}</span>
                      ) : null}
                    </div>
                    {student.riskReasons?.length ? (
                      <div style={{ marginTop: 8, fontSize: 12, color: tone.color }}>
                        风险原因：{student.riskReasons.join("；")}
                      </div>
                    ) : (
                      <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>风险原因：暂无明显异常。</div>
                    )}
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                      建议动作：{student.recommendedAction || "建议常规复盘。"}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
