import Card from "@/components/Card";
import type { Syllabus } from "../types";
import { COURSE_FIELD_STYLE } from "../utils";

export function CourseSyllabusEditorCard({
  form,
  error,
  message,
  saving,
  hasSelectedClass,
  onFieldChange,
  onSave
}: {
  form: Syllabus;
  error: string | null;
  message: string | null;
  saving: boolean;
  hasSelectedClass: boolean;
  onFieldChange: (field: keyof Syllabus, value: string) => void;
  onSave: () => void;
}) {
  return (
    <Card title="编辑课程大纲" tag="教师">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
        style={{ display: "grid", gap: 12 }}
      >
        <label>
          <div className="section-title">课程简介</div>
          <textarea value={form.summary} onChange={(event) => onFieldChange("summary", event.target.value)} rows={3} style={COURSE_FIELD_STYLE} />
        </label>
        <label>
          <div className="section-title">课程目标</div>
          <textarea
            value={form.objectives}
            onChange={(event) => onFieldChange("objectives", event.target.value)}
            rows={3}
            style={COURSE_FIELD_STYLE}
          />
        </label>
        <label>
          <div className="section-title">评分规则</div>
          <textarea
            value={form.gradingPolicy}
            onChange={(event) => onFieldChange("gradingPolicy", event.target.value)}
            rows={3}
            style={COURSE_FIELD_STYLE}
          />
        </label>
        <label>
          <div className="section-title">周/单元安排</div>
          <textarea
            value={form.scheduleText}
            onChange={(event) => onFieldChange("scheduleText", event.target.value)}
            rows={4}
            style={COURSE_FIELD_STYLE}
          />
        </label>
        {error ? <div style={{ color: "#b42318", fontSize: 13 }}>{error}</div> : null}
        {message ? <div style={{ color: "#027a48", fontSize: 13 }}>{message}</div> : null}
        <button className="button primary" type="submit" disabled={saving || !hasSelectedClass}>
          {saving ? "保存中..." : "保存大纲"}
        </button>
      </form>
    </Card>
  );
}
