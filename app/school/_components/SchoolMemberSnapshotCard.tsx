import Link from "next/link";
import Card from "@/components/Card";
import type { SchoolUserRecord } from "@/lib/school-admin-types";

export function SchoolMemberSnapshotCard({
  teacherPreview,
  studentPreview
}: {
  teacherPreview: SchoolUserRecord[];
  studentPreview: SchoolUserRecord[];
}) {
  return (
    <Card title="成员快照" tag="成员">
      <div className="grid" style={{ gap: 10 }}>
        <div className="card">
          <div className="section-title">教师（前 6）</div>
          <div className="grid" style={{ gap: 6, marginTop: 8 }}>
            {teacherPreview.map((teacher) => (
              <div key={teacher.id} style={{ fontSize: 13, color: "var(--ink-1)" }}>
                {teacher.name} · {teacher.email}
              </div>
            ))}
            {!teacherPreview.length ? <div className="section-sub">暂无教师账号。</div> : null}
          </div>
        </div>
        <div className="card">
          <div className="section-title">学生（前 6）</div>
          <div className="grid" style={{ gap: 6, marginTop: 8 }}>
            {studentPreview.map((student) => (
              <div key={student.id} style={{ fontSize: 13, color: "var(--ink-1)" }}>
                {student.name} · {student.grade ? `${student.grade} 年级` : "未设置年级"}
              </div>
            ))}
            {!studentPreview.length ? <div className="section-sub">暂无学生账号。</div> : null}
          </div>
        </div>
      </div>
      <div className="cta-row" style={{ marginTop: 12 }}>
        <Link className="button secondary" href="/school/teachers">
          教师管理
        </Link>
        <Link className="button ghost" href="/school/students">
          学生管理
        </Link>
      </div>
    </Card>
  );
}
