import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { SchoolClassRecord } from "@/lib/school-admin-types";

export function SchoolClassSnapshotCard({ classPreview }: { classPreview: SchoolClassRecord[] }) {
  return (
    <Card title="班级快照" tag="组织">
      <div className="section-sub">优先展示最近的班级结构与执行负载，便于快速进入治理页。</div>
      <div className="grid" style={{ gap: 8, marginTop: 12 }}>
        {classPreview.map((item) => (
          <div className="card" key={item.id}>
            <div className="section-title">{item.name}</div>
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
              {item.subject} · {item.grade} 年级 · {item.studentCount} 人 · {item.assignmentCount} 份作业
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
              班主任/任课：{item.teacherName ?? item.teacherId ?? "未绑定"}
            </div>
          </div>
        ))}
        {!classPreview.length ? <StatePanel title="暂无班级数据" description="当前学校还没有班级记录。" tone="empty" compact /> : null}
      </div>
      <div className="cta-row" style={{ marginTop: 12 }}>
        <Link className="button secondary" href="/school/classes">
          查看全部班级
        </Link>
        <Link className="button ghost" href="/school/schedules">
          进入课程表管理
        </Link>
      </div>
    </Card>
  );
}
