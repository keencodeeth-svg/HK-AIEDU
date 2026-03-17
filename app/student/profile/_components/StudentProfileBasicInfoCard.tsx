import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { GRADE_OPTIONS, SUBJECT_OPTIONS } from "@/lib/constants";
import type { StudentProfileFormState } from "../types";
import { studentProfileInputStyle } from "../utils";

type StudentProfileBasicInfoCardProps = {
  form: StudentProfileFormState;
  onGradeChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onSchoolChange: (value: string) => void;
  onToggleSubject: (subject: string) => void;
};

export default function StudentProfileBasicInfoCard({
  form,
  onGradeChange,
  onTargetChange,
  onSchoolChange,
  onToggleSubject
}: StudentProfileBasicInfoCardProps) {
  return (
    <Card title="基础学习信息" tag="学习">
      <div className="feature-card">
        <EduIcon name="book" />
        <p>年级、学科和目标会影响题目推荐、计划生成和学习路径。</p>
      </div>
      <div className="grid grid-2" style={{ gap: 12, marginTop: 12 }}>
        <label>
          <div className="section-title">年级</div>
          <select value={form.grade} onChange={(event) => onGradeChange(event.target.value)} style={studentProfileInputStyle}>
            {GRADE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">学习目标</div>
          <input
            value={form.target}
            onChange={(event) => onTargetChange(event.target.value)}
            placeholder="例如：提升数学应用题和阅读理解"
            style={studentProfileInputStyle}
          />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          <div className="section-title">学校（可选）</div>
          <input value={form.school} onChange={(event) => onSchoolChange(event.target.value)} style={studentProfileInputStyle} />
        </label>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="section-title">学习学科</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          {SUBJECT_OPTIONS.map((subject) => (
            <label key={subject.value} className="card" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.subjects.includes(subject.value)}
                onChange={() => onToggleSubject(subject.value)}
                style={{ marginRight: 8 }}
              />
              {subject.label}
            </label>
          ))}
        </div>
      </div>
    </Card>
  );
}
