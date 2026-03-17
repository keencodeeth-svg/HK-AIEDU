import type { Dispatch, SetStateAction } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import Stat from "@/components/Stat";
import type { TeacherScheduleRule } from "@/lib/teacher-schedule-rules";
import type { TeacherRuleFormState } from "../types";
import { fieldStyle } from "../utils";

type TeacherOption = {
  id: string;
  name: string;
};

type SchoolScheduleTeacherRulesCardProps = {
  teacherRules: TeacherScheduleRule[];
  teacherRuleCoverageCount: number;
  crossCampusRuleCount: number;
  teacherRuleForm: TeacherRuleFormState;
  teacherRuleSaving: boolean;
  teacherRuleDeletingId: string | null;
  teacherRuleMessage: string | null;
  teacherRuleError: string | null;
  teacherOptions: TeacherOption[];
  setTeacherRuleForm: Dispatch<SetStateAction<TeacherRuleFormState>>;
  resetTeacherRuleForm: () => void;
  startEditTeacherRule: (rule: TeacherScheduleRule) => void;
  handleSaveTeacherRule: () => Promise<void>;
  handleDeleteTeacherRule: (id: string) => Promise<void>;
  formatTeacherRuleSummary: (rule: TeacherScheduleRule) => string;
};

export function SchoolScheduleTeacherRulesCard({
  teacherRules,
  teacherRuleCoverageCount,
  crossCampusRuleCount,
  teacherRuleForm,
  teacherRuleSaving,
  teacherRuleDeletingId,
  teacherRuleMessage,
  teacherRuleError,
  teacherOptions,
  setTeacherRuleForm,
  resetTeacherRuleForm,
  startEditTeacherRule,
  handleSaveTeacherRule,
  handleDeleteTeacherRule,
  formatTeacherRuleSummary
}: SchoolScheduleTeacherRulesCardProps) {
  return (
    <Card title="教师排课规则" tag="规则">
      <div className="grid" style={{ gap: 12 }}>
        <div id="schedule-rules" className="section-sub">用于限制教师周课时、连续连堂和跨校区缓冲时间；AI 预演、正式写入和手动新建节次都会同步校验。</div>
        <div className="grid grid-3">
          <Stat label="已配置教师" value={String(teacherRules.length)} helper="逐教师精细约束" />
          <Stat label="覆盖班级" value={String(teacherRuleCoverageCount)} helper="命中已绑定教师班级" />
          <Stat label="跨校区规则" value={String(crossCampusRuleCount)} helper="含跨校区缓冲" />
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">教师</span>
            <select value={teacherRuleForm.teacherId} onChange={(event) => setTeacherRuleForm((prev) => ({ ...prev, teacherId: event.target.value }))} style={fieldStyle}>
              <option value="">请选择教师</option>
              {teacherOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">周课时上限</span>
            <input type="number" min={1} max={60} value={teacherRuleForm.weeklyMaxLessons} onChange={(event) => setTeacherRuleForm((prev) => ({ ...prev, weeklyMaxLessons: event.target.value }))} placeholder="如：18" style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">最多连续节数</span>
            <input type="number" min={1} max={12} value={teacherRuleForm.maxConsecutiveLessons} onChange={(event) => setTeacherRuleForm((prev) => ({ ...prev, maxConsecutiveLessons: event.target.value }))} placeholder="如：2" style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">跨校区最小间隔</span>
            <input type="number" min={1} max={240} value={teacherRuleForm.minCampusGapMinutes} onChange={(event) => setTeacherRuleForm((prev) => ({ ...prev, minCampusGapMinutes: event.target.value }))} placeholder="如：20 分钟" style={fieldStyle} />
          </label>
        </div>
        {teacherRuleError ? <StatePanel compact tone="error" title="教师规则保存失败" description={teacherRuleError} /> : null}
        {teacherRuleMessage ? <StatePanel compact tone="success" title="教师规则已更新" description={teacherRuleMessage} /> : null}
        <div className="cta-row">
          <button className="button primary" type="button" onClick={() => void handleSaveTeacherRule()} disabled={teacherRuleSaving}>
            {teacherRuleSaving ? "保存中..." : teacherRuleForm.id ? "更新规则" : "保存规则"}
          </button>
          <button className="button ghost" type="button" onClick={resetTeacherRuleForm} disabled={teacherRuleSaving}>
            重置
          </button>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {teacherRules.map((item) => {
            const teacherName = teacherOptions.find((option) => option.id === item.teacherId)?.name ?? item.teacherId;
            return (
              <div key={item.id} className="card">
                <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div className="section-title">{teacherName}</div>
                    <div className="meta-text" style={{ marginTop: 6 }}>{formatTeacherRuleSummary(item)}</div>
                  </div>
                  <span className="pill">教师规则</span>
                </div>
                <div className="cta-row cta-row-tight" style={{ marginTop: 10 }}>
                  <button className="button secondary" type="button" onClick={() => startEditTeacherRule(item)} disabled={teacherRuleDeletingId === item.id}>
                    编辑
                  </button>
                  <button className="button ghost" type="button" onClick={() => void handleDeleteTeacherRule(item.id)} disabled={teacherRuleDeletingId === item.id}>
                    {teacherRuleDeletingId === item.id ? "删除中..." : "删除"}
                  </button>
                </div>
              </div>
            );
          })}
          {!teacherRules.length ? <div className="section-sub">当前未配置教师排课规则，建议优先为满课教师、跨校区教师配置约束。</div> : null}
        </div>
      </div>
    </Card>
  );
}
