import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { CourseClass, Syllabus } from "../types";

export function CourseSyllabusPreviewCard({
  currentClass,
  syllabus
}: {
  currentClass: CourseClass | null;
  syllabus: Syllabus | null;
}) {
  return (
    <Card title="课程主页预览" tag="主页">
      <div className="feature-card">
        <EduIcon name="board" />
        <div>
          <div className="section-title">{currentClass ? `${currentClass.name} · ${currentClass.grade} 年级` : "课程"}</div>
          <div className="section-sub">{currentClass ? SUBJECT_LABELS[currentClass.subject] ?? currentClass.subject : "学科"}</div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="section-title">课程简介</div>
        <p style={{ whiteSpace: "pre-wrap" }}>{syllabus?.summary || "暂无简介"}</p>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="section-title">课程目标</div>
        <p style={{ whiteSpace: "pre-wrap" }}>{syllabus?.objectives || "暂无目标"}</p>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="section-title">评分规则</div>
        <p style={{ whiteSpace: "pre-wrap" }}>{syllabus?.gradingPolicy || "暂无规则"}</p>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="section-title">周/单元安排</div>
        <p style={{ whiteSpace: "pre-wrap" }}>{syllabus?.scheduleText || "暂无安排"}</p>
      </div>
    </Card>
  );
}
