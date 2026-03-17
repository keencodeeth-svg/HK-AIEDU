import type { Dispatch, SetStateAction } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import Stat from "@/components/Stat";
import type { SchoolScheduleTemplate } from "@/lib/school-schedule-templates";
import type { TemplateFormState } from "../types";
import { WEEKDAY_OPTIONS, fieldStyle } from "../utils";

type SchoolScheduleTemplatesCardProps = {
  templates: SchoolScheduleTemplate[];
  templateForm: TemplateFormState;
  gradeOptions: string[];
  subjectOptions: string[];
  aiTemplateCoverageCount: number;
  teacherUnavailableSlotCount: number;
  templateSaving: boolean;
  templateDeletingId: string | null;
  templateMessage: string | null;
  templateError: string | null;
  setTemplateForm: Dispatch<SetStateAction<TemplateFormState>>;
  toggleTemplateWeekday: (weekday: string) => void;
  resetTemplateForm: () => void;
  applyDraftTemplateToAi: () => void;
  startEditTemplate: (template: SchoolScheduleTemplate) => void;
  handleSaveTemplate: () => Promise<void>;
  handleDeleteTemplate: (id: string) => Promise<void>;
  onApplyTemplateToAi: (template: SchoolScheduleTemplate) => void;
};

export function SchoolScheduleTemplatesCard({
  templates,
  templateForm,
  gradeOptions,
  subjectOptions,
  aiTemplateCoverageCount,
  teacherUnavailableSlotCount,
  templateSaving,
  templateDeletingId,
  templateMessage,
  templateError,
  setTemplateForm,
  toggleTemplateWeekday,
  resetTemplateForm,
  applyDraftTemplateToAi,
  startEditTemplate,
  handleSaveTemplate,
  handleDeleteTemplate,
  onApplyTemplateToAi
}: SchoolScheduleTemplatesCardProps) {
  return (
    <Card title="年级学科课时模板" tag="模板">
      <div className="grid" style={{ gap: 12 }}>
        <div id="schedule-templates" className="section-sub">为同年级同学科配置默认每周节数、课时和时段参数，AI 排课时会自动优先套用。</div>
        <div className="grid grid-3">
          <Stat label="模板总数" value={String(templates.length)} helper="学校级规则库" />
          <Stat label="模板覆盖班级" value={String(aiTemplateCoverageCount)} helper="可直接套用" />
          <Stat label="禁排时段" value={String(teacherUnavailableSlotCount)} helper="教师约束" />
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">年级</span>
            <select value={templateForm.grade} onChange={(event) => setTemplateForm((prev) => ({ ...prev, grade: event.target.value }))} style={fieldStyle}>
              <option value="">请选择年级</option>
              {gradeOptions.map((item) => (
                <option key={item} value={item}>
                  {item} 年级
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">学科</span>
            <select value={templateForm.subject} onChange={(event) => setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))} style={fieldStyle}>
              <option value="">请选择学科</option>
              {subjectOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">每周总节数</span>
            <input type="number" min={1} max={30} value={templateForm.weeklyLessonsPerClass} onChange={(event) => setTemplateForm((prev) => ({ ...prev, weeklyLessonsPerClass: event.target.value }))} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">单节课时</span>
            <input type="number" min={30} max={120} value={templateForm.lessonDurationMinutes} onChange={(event) => setTemplateForm((prev) => ({ ...prev, lessonDurationMinutes: event.target.value }))} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">每日节次数</span>
            <input type="number" min={1} max={12} value={templateForm.periodsPerDay} onChange={(event) => setTemplateForm((prev) => ({ ...prev, periodsPerDay: event.target.value }))} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">首节时间</span>
            <input type="time" value={templateForm.dayStartTime} onChange={(event) => setTemplateForm((prev) => ({ ...prev, dayStartTime: event.target.value }))} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">课间</span>
            <input type="number" min={0} max={30} value={templateForm.shortBreakMinutes} onChange={(event) => setTemplateForm((prev) => ({ ...prev, shortBreakMinutes: event.target.value }))} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">午休前节次</span>
            <input type="number" min={1} max={12} value={templateForm.lunchBreakAfterPeriod} onChange={(event) => setTemplateForm((prev) => ({ ...prev, lunchBreakAfterPeriod: event.target.value }))} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">午休时长</span>
            <input type="number" min={0} max={180} value={templateForm.lunchBreakMinutes} onChange={(event) => setTemplateForm((prev) => ({ ...prev, lunchBreakMinutes: event.target.value }))} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">默认校区</span>
            <input value={templateForm.campus} onChange={(event) => setTemplateForm((prev) => ({ ...prev, campus: event.target.value }))} style={fieldStyle} />
          </label>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="section-sub">模板排课日</span>
          <div className="cta-row" style={{ flexWrap: "wrap" }}>
            {WEEKDAY_OPTIONS.map((item) => {
              const active = templateForm.weekdays.includes(item.value);
              return (
                <button key={item.value} className={active ? "button secondary" : "button ghost"} type="button" onClick={() => toggleTemplateWeekday(item.value)}>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        {templateError ? <StatePanel compact tone="error" title="模板保存失败" description={templateError} /> : null}
        {templateMessage ? <StatePanel compact tone="success" title="模板已更新" description={templateMessage} /> : null}
        <div className="cta-row">
          <button className="button primary" type="button" onClick={() => void handleSaveTemplate()} disabled={templateSaving}>
            {templateSaving ? "保存中..." : templateForm.id ? "更新模板" : "保存模板"}
          </button>
          <button className="button ghost" type="button" onClick={resetTemplateForm} disabled={templateSaving}>
            重置
          </button>
          <button className="button secondary" type="button" onClick={applyDraftTemplateToAi} disabled={templateSaving || !templateForm.grade || !templateForm.subject}>
            应用到 AI 参数
          </button>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {templates.map((item) => (
            <div key={item.id} className="card">
              <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div>
                  <div className="section-title">
                    {item.grade} 年级 · {item.subject}
                  </div>
                  <div className="meta-text" style={{ marginTop: 6 }}>
                    {item.weeklyLessonsPerClass} 节/周 · {item.lessonDurationMinutes} 分钟 · 每日 {item.periodsPerDay} 节 · {item.dayStartTime} 开始
                  </div>
                </div>
                <span className="pill">
                  {item.weekdays.map((day) => WEEKDAY_OPTIONS.find((option) => option.value === String(day))?.label ?? day).join(" / ")}
                </span>
              </div>
              <div className="cta-row cta-row-tight" style={{ marginTop: 10 }}>
                <button className="button secondary" type="button" onClick={() => onApplyTemplateToAi(item)}>
                  应用到 AI
                </button>
                <button className="button ghost" type="button" onClick={() => startEditTemplate(item)}>
                  编辑
                </button>
                <button className="button ghost" type="button" onClick={() => void handleDeleteTemplate(item.id)} disabled={templateDeletingId === item.id}>
                  {templateDeletingId === item.id ? "删除中..." : "删除"}
                </button>
              </div>
            </div>
          ))}
          {!templates.length ? <div className="section-sub">还没有模板，建议先为高频年级学科配置默认课时。</div> : null}
        </div>
      </div>
    </Card>
  );
}
