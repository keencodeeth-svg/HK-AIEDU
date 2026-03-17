import type { Dispatch, FormEventHandler, SetStateAction } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { ClassItem, LibraryAiFormState } from "../types";

const fieldStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)"
} as const;

type LibraryAiGeneratePanelProps = {
  classes: ClassItem[];
  aiForm: LibraryAiFormState;
  setAiForm: Dispatch<SetStateAction<LibraryAiFormState>>;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export default function LibraryAiGeneratePanel({ classes, aiForm, setAiForm, onSubmit }: LibraryAiGeneratePanelProps) {
  return (
    <Card title="AI 生成课件/教案" tag="AI">
      <div className="feature-card">
        <EduIcon name="brain" />
        <p>输入主题后自动生成，可直接给老师和学生查看。</p>
      </div>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          <div className="section-title">班级</div>
          <select value={aiForm.classId} onChange={(event) => setAiForm((prev) => ({ ...prev, classId: event.target.value }))} style={fieldStyle}>
            {classes.length ? (
              classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                </option>
              ))
            ) : (
              <option value="">暂无可用班级</option>
            )}
          </select>
        </label>
        {!classes.length ? <div className="status-note info">当前暂无可用班级，请先创建班级或稍后重试。</div> : null}
        <label>
          <div className="section-title">主题</div>
          <input value={aiForm.topic} onChange={(event) => setAiForm((prev) => ({ ...prev, topic: event.target.value }))} placeholder="例如：分数加减法综合复习" style={fieldStyle} />
        </label>
        <label>
          <div className="section-title">生成类型</div>
          <select value={aiForm.contentType} onChange={(event) => setAiForm((prev) => ({ ...prev, contentType: event.target.value as LibraryAiFormState["contentType"] }))} style={fieldStyle}>
            <option value="lesson_plan">教案</option>
            <option value="courseware">课件</option>
          </select>
        </label>
        <button className="button primary" type="submit" disabled={!classes.length}>
          AI 生成并发布
        </button>
      </form>
    </Card>
  );
}
