import type { Dispatch, SetStateAction } from "react";
import Card from "@/components/Card";
import { SUBJECT_LABELS, getGradeLabel } from "@/lib/constants";
import type { ClassItem, FormState } from "../types";

type ExamCreateScopeCardProps = {
  classes: ClassItem[];
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  classLabel: string;
  filteredPointCount: number;
  classStudentsCount: number;
};

export default function ExamCreateScopeCard({
  classes,
  form,
  setForm,
  classLabel,
  filteredPointCount,
  classStudentsCount
}: ExamCreateScopeCardProps) {
  return (
    <Card title="1. 发布范围" tag="Scope">
      <div className="teacher-exam-create-section-grid" id="exam-create-scope">
        <label>
          <div className="section-title">班级</div>
          <select
            value={form.classId}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                classId: event.target.value,
                knowledgePointId: "",
                studentIds: []
              }))
            }
            required
          >
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {getGradeLabel(item.grade)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div className="section-title">考试标题</div>
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="例如：第一单元阶段测评"
            required
          />
        </label>

        <label className="teacher-exam-create-span-full">
          <div className="section-title">考试说明（可选）</div>
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            rows={3}
            placeholder="说明考试范围、答题注意事项和评分方式"
          />
        </label>
      </div>

      <div className="workflow-card-meta">
        <span className="pill">当前班级：{classLabel}</span>
        <span className="pill">知识点目录 {filteredPointCount} 个</span>
        <span className="pill">学生 {classStudentsCount} 人</span>
      </div>
    </Card>
  );
}
