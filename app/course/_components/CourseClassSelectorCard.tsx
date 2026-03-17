import Card from "@/components/Card";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { CourseClass } from "../types";
import { COURSE_FIELD_STYLE } from "../utils";

export function CourseClassSelectorCard({
  classes,
  classId,
  onClassChange
}: {
  classes: CourseClass[];
  classId: string;
  onClassChange: (classId: string) => void;
}) {
  return (
    <Card title="课程选择" tag="课程">
      {classes.length ? (
        <label>
          <div className="section-title">选择班级</div>
          <select value={classId} onChange={(event) => onClassChange(event.target.value)} style={COURSE_FIELD_STYLE}>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>暂无班级，请先在教师端创建班级或加入班级。</p>
      )}
    </Card>
  );
}
