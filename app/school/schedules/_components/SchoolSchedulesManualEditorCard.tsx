import type { Dispatch, RefObject, SetStateAction } from "react";
import Card from "@/components/Card";
import type { SchoolClassRecord } from "@/lib/school-admin-types";
import type { SchoolScheduleTemplate } from "@/lib/school-schedule-templates";
import type { TeacherScheduleRule } from "@/lib/teacher-schedule-rules";
import type { ScheduleFormState } from "../types";
import { WEEKDAY_OPTIONS, fieldStyle } from "../utils";

type SchoolSchedulesManualEditorCardProps = {
  manualEditorRef: RefObject<HTMLDivElement>;
  editingId: string | null;
  saving: boolean;
  classes: SchoolClassRecord[];
  form: ScheduleFormState;
  formMessage: string | null;
  formError: string | null;
  selectedManualClass: SchoolClassRecord | null;
  selectedManualClassTemplate: SchoolScheduleTemplate | null;
  selectedManualTeacherRule: TeacherScheduleRule | null;
  selectedManualClassScheduleCount: number;
  selectedManualClassLockedCount: number;
  setForm: Dispatch<SetStateAction<ScheduleFormState>>;
  buildManualScheduleDraft: (classId: string) => ScheduleFormState;
  applySelectedClassTemplateToForm: () => void;
  focusClassInWeekView: (classId: string) => void;
  handleSave: () => Promise<void>;
  resetForm: () => void;
};

export function SchoolSchedulesManualEditorCard({
  manualEditorRef,
  editingId,
  saving,
  classes,
  form,
  formMessage,
  formError,
  selectedManualClass,
  selectedManualClassTemplate,
  selectedManualTeacherRule,
  selectedManualClassScheduleCount,
  selectedManualClassLockedCount,
  setForm,
  buildManualScheduleDraft,
  applySelectedClassTemplateToForm,
  focusClassInWeekView,
  handleSave,
  resetForm
}: SchoolSchedulesManualEditorCardProps) {
  return (
    <div ref={manualEditorRef} id="schedule-manual-editor">
      <Card title={editingId ? "编辑课程节次" : "新建课程节次"} tag={editingId ? "编辑" : "新建"}>
        <div className="grid" style={{ gap: 12 }}>
          {selectedManualClass ? (
            <div className="card">
              <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div>
                  <div className="section-title">当前正在处理：{selectedManualClass.name}</div>
                  <div className="section-sub" style={{ marginTop: 4 }}>
                    {selectedManualClass.subject} · {selectedManualClass.grade} 年级 · 教师 {selectedManualClass.teacherName ?? selectedManualClass.teacherId ?? "未绑定"}
                  </div>
                </div>
                <span className="pill">{editingId ? "编辑已有节次" : "新建单个节次"}</span>
              </div>
              <div className="badge-row" style={{ marginTop: 10 }}>
                <span className="badge">已排 {selectedManualClassScheduleCount} 节/周</span>
                <span className="badge">锁定 {selectedManualClassLockedCount} 节</span>
                <span className="badge">{selectedManualClassTemplate ? "已配课时模板" : "缺课时模板"}</span>
                <span className="badge">{selectedManualTeacherRule ? "已配教师规则" : selectedManualClass.teacherId ? "缺教师规则" : "未绑定教师"}</span>
              </div>
              <div className="meta-text" style={{ marginTop: 10, lineHeight: 1.65 }}>
                {selectedManualClassTemplate
                  ? `建议优先使用模板时段：${selectedManualClassTemplate.dayStartTime} 开始，单节 ${selectedManualClassTemplate.lessonDurationMinutes} 分钟，排课日 ${selectedManualClassTemplate.weekdays
                      .map((day) => WEEKDAY_OPTIONS.find((option) => option.value === String(day))?.label ?? day)
                      .join(" / ")}。`
                  : "当前没有匹配的年级学科模板，建议先补模板后再批量或手动排课。"}
              </div>
              <div className="cta-row" style={{ marginTop: 10, flexWrap: "wrap" }}>
                {selectedManualClassTemplate ? (
                  <button className="button secondary" type="button" onClick={applySelectedClassTemplateToForm} disabled={saving}>
                    带入模板基础参数
                  </button>
                ) : (
                  <a className="button ghost" href="#schedule-templates">
                    去补课时模板
                  </a>
                )}
                {selectedManualClass.teacherId && !selectedManualTeacherRule ? (
                  <a className="button ghost" href="#schedule-rules">
                    去配教师规则
                  </a>
                ) : null}
                <button className="button ghost" type="button" onClick={() => focusClassInWeekView(selectedManualClass.id)}>
                  查看该班周视图
                </button>
              </div>
            </div>
          ) : null}
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">班级</span>
            <select
              value={form.classId}
              onChange={(event) => setForm(buildManualScheduleDraft(event.target.value))}
              style={fieldStyle}
              disabled={Boolean(editingId)}
            >
              <option value="">请选择班级</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.subject} · {item.grade} 年级
                </option>
              ))}
            </select>
            {editingId ? <div className="meta-text">编辑模式只修改当前节次的时间、教室和备注；若要换班，建议新建后删除原节次。</div> : null}
          </label>
          <div className="grid grid-2">
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">星期</span>
              <select value={form.weekday} onChange={(event) => setForm((prev) => ({ ...prev, weekday: event.target.value }))} style={fieldStyle}>
                {WEEKDAY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">节次名称</span>
              <input
                value={form.slotLabel}
                onChange={(event) => setForm((prev) => ({ ...prev, slotLabel: event.target.value }))}
                placeholder="如：第一节 / 晚自习"
                style={fieldStyle}
              />
            </label>
          </div>
          <div className="grid grid-2">
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">开始时间</span>
              <input type="time" value={form.startTime} onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))} style={fieldStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">结束时间</span>
              <input type="time" value={form.endTime} onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))} style={fieldStyle} />
            </label>
          </div>
          <div className="grid grid-2">
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">教室</span>
              <input value={form.room} onChange={(event) => setForm((prev) => ({ ...prev, room: event.target.value }))} placeholder="如：A201" style={fieldStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">校区</span>
              <input value={form.campus} onChange={(event) => setForm((prev) => ({ ...prev, campus: event.target.value }))} placeholder="如：主校区" style={fieldStyle} />
            </label>
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">课堂焦点</span>
            <input
              value={form.focusSummary}
              onChange={(event) => setForm((prev) => ({ ...prev, focusSummary: event.target.value }))}
              placeholder="如：分数应用、作文审题、口语演练"
              style={fieldStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">补充备注</span>
            <textarea
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              rows={3}
              placeholder="如：课前带练习册、第三周起改到实验室"
              style={fieldStyle}
            />
          </label>
          {formError ? <div style={{ color: "#b42318", fontSize: 13 }}>{formError}</div> : null}
          {formMessage ? <div style={{ color: "#027a48", fontSize: 13 }}>{formMessage}</div> : null}
          <div className="cta-row">
            <button className="button primary" type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "保存中..." : editingId ? "保存修改" : "创建节次"}
            </button>
            <button className="button ghost" type="button" onClick={resetForm} disabled={saving}>
              {editingId ? "取消编辑" : "重置表单"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
