import type { Dispatch, SetStateAction } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { ClassStudent, FormState } from "../types";
import { PUBLISH_MODE_OPTIONS } from "../utils";

type ExamCreatePublishCardProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  targetLabel: string;
  classStudents: ClassStudent[];
  studentsLoading: boolean;
  studentsError: string | null;
  onRetryStudents: () => void;
};

export default function ExamCreatePublishCard({
  form,
  setForm,
  targetLabel,
  classStudents,
  studentsLoading,
  studentsError,
  onRetryStudents
}: ExamCreatePublishCardProps) {
  return (
    <Card title="4. 发布对象" tag="Publish">
      <div className="teacher-exam-create-section-grid" id="exam-create-publish">
        <label>
          <div className="section-title">发布方式</div>
          <select value={form.publishMode} onChange={(event) => setForm((prev) => ({ ...prev, publishMode: event.target.value as FormState["publishMode"] }))}>
            {PUBLISH_MODE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="teacher-exam-create-summary-card">
          <div className="teacher-exam-create-summary-label">当前目标</div>
          <div className="teacher-exam-create-summary-value">{targetLabel}</div>
          <div className="teacher-exam-create-summary-helper">
            {form.publishMode === "teacher_assigned" ? "发布后会自动覆盖当前班级全部学生。" : "定向发布只会通知当前选中的学生。"}
          </div>
        </div>
      </div>

      {form.publishMode === "targeted" ? (
        <div className="teacher-exam-create-student-panel">
          <div className="teacher-exam-create-student-toolbar">
            <div>
              <div className="section-title">定向学生</div>
              <div className="meta-text">至少选择 1 名学生。切换班级后会自动清理不属于当前班级的学生。</div>
            </div>
            <div className="cta-row cta-row-tight no-margin">
              <button
                className="button ghost"
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, studentIds: classStudents.map((student) => student.id) }))}
                disabled={!classStudents.length}
              >
                全选
              </button>
              <button
                className="button ghost"
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, studentIds: [] }))}
                disabled={!form.studentIds.length}
              >
                清空
              </button>
            </div>
          </div>

          {studentsLoading && !classStudents.length ? (
            <StatePanel compact tone="loading" title="学生列表加载中" description="正在同步当前班级学生名单。" />
          ) : classStudents.length === 0 ? (
            <StatePanel compact tone="empty" title="当前班级没有可选学生" description="没有学生时不建议使用定向发布，可切回班级统一发布。" />
          ) : (
            <div className="teacher-exam-create-student-list">
              {classStudents.map((student) => {
                const checked = form.studentIds.includes(student.id);
                return (
                  <label className={`teacher-exam-create-student-item${checked ? " selected" : ""}`} key={student.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setForm((prev) => ({
                          ...prev,
                          studentIds: event.target.checked
                            ? [...prev.studentIds, student.id]
                            : prev.studentIds.filter((item) => item !== student.id)
                        }));
                      }}
                    />
                    <div>
                      <div className="teacher-exam-create-student-name">{student.name}</div>
                      <div className="meta-text">{student.email}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {studentsError ? (
            <StatePanel
              compact
              tone="error"
              title="学生列表刷新失败"
              description={studentsError}
              action={
                <button className="button secondary" type="button" onClick={onRetryStudents}>
                  重试学生列表
                </button>
              }
            />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
