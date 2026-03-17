import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { SchoolAttentionClass } from "@/lib/school-admin-types";

export function SchoolAttentionClassesCard({ attentionClasses }: { attentionClasses: SchoolAttentionClass[] }) {
  return (
    <Card title="重点关注班级" tag="风险">
      {attentionClasses.length ? (
        <div className="grid" style={{ gap: 10 }}>
          {attentionClasses.map((item) => (
            <div className="card" key={item.id}>
              <div className="section-title">{item.name}</div>
              <div style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 4 }}>
                {item.subject} · {item.grade} 年级 · {item.studentCount} 人 · {item.assignmentCount} 份作业 · {item.scheduleCount} 节/周 · {item.scheduleCount} 节/周
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                教师：{item.teacherName ?? item.teacherId ?? "未绑定"}
              </div>
              <div className="cta-row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                {item.issueTags.map((tag) => (
                  <span className="pill" key={`${item.id}-${tag}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <StatePanel
          title="当前没有高风险班级"
          description="教师绑定、学生编班和作业覆盖状态都比较稳定。"
          tone="success"
          compact
        />
      )}
    </Card>
  );
}
