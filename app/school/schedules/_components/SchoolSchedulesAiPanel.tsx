import type { Dispatch, SetStateAction } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import Stat from "@/components/Stat";
import { formatLoadedTime } from "@/lib/client-request";
import type { AiMode, AiOperationSummary, AiScheduleFormState, AiScheduleResponse } from "../types";
import { WEEKDAY_OPTIONS, fieldStyle, formatSubjectLine } from "../utils";

type SchoolSchedulesAiPanelProps = {
  aiForm: AiScheduleFormState;
  aiGenerating: boolean;
  aiRollingBack: boolean;
  aiMessage: string | null;
  aiError: string | null;
  aiResult: AiScheduleResponse["data"] | null;
  latestAiOperation: AiOperationSummary | null;
  aiWeeklyLessonsTarget: number;
  aiTargetClassCount: number;
  aiRequestedLessonCount: number;
  aiTeacherGapCount: number;
  aiTemplateCoverageCount: number;
  lockedSessionCount: number;
  aiTeacherBoundTargetCount: number;
  aiMissingTemplateTargetCount: number;
  aiTeacherRuleGapTargetCount: number;
  aiZeroScheduleTargetCount: number;
  aiPreviewBlockingReasons: string[];
  aiPreviewWarningReasons: string[];
  aiReadinessLabel: string;
  aiReadinessTone: string;
  setAiForm: Dispatch<SetStateAction<AiScheduleFormState>>;
  onToggleAiWeekday: (weekday: string) => void;
  onResetAiForm: () => void;
  onPreview: () => void;
  onApplyPreview: () => void;
  onRollback: () => void;
};

export function SchoolSchedulesAiPanel({
  aiForm,
  aiGenerating,
  aiRollingBack,
  aiMessage,
  aiError,
  aiResult,
  latestAiOperation,
  aiWeeklyLessonsTarget,
  aiTargetClassCount,
  aiRequestedLessonCount,
  aiTeacherGapCount,
  aiTemplateCoverageCount,
  lockedSessionCount,
  aiTeacherBoundTargetCount,
  aiMissingTemplateTargetCount,
  aiTeacherRuleGapTargetCount,
  aiZeroScheduleTargetCount,
  aiPreviewBlockingReasons,
  aiPreviewWarningReasons,
  aiReadinessLabel,
  aiReadinessTone,
  setAiForm,
  onToggleAiWeekday,
  onResetAiForm,
  onPreview,
  onApplyPreview,
  onRollback
}: SchoolSchedulesAiPanelProps) {
  return (
    <Card title="AI 一键排课" tag="AI">
      <div className="grid" data-testid="school-schedules-ai-panel" style={{ gap: 12 }}>
        <div className="section-sub">
          先预演、再写入，并支持保留锁定节次和回滚最近一次 AI 排课，避免学校端误操作直接覆盖课表。
        </div>

        <div className="grid grid-3">
          <Stat label="本轮目标班级" value={String(aiTargetClassCount)} helper={aiForm.mode === "replace_all" ? "全校现有课表重排" : "优先补齐不足班级"} />
          <Stat label="预计新增节次" value={String(aiRequestedLessonCount)} helper={`按每班 ${aiWeeklyLessonsTarget || 0} 节/周估算`} />
          <Stat label="待补教师班级" value={String(aiTeacherGapCount)} helper="未绑定教师会自动跳过" />
          <Stat label="已配置模板班级" value={String(aiTemplateCoverageCount)} helper="同年级同学科自动套用" />
          <Stat label="已锁定节次" value={String(lockedSessionCount)} helper="重排时自动保留" />
          <Stat label="最近 AI 新增" value={String(latestAiOperation?.createdSessions ?? 0)} helper={latestAiOperation ? "可一键回滚" : "暂无已写入记录"} />
        </div>

        <div className="card">
          <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div className="section-title">排前检查</div>
              <div className="meta-text" style={{ marginTop: 6 }}>先确认老师、模板和约束是否齐备，再进入 AI 预演，避免出现“预演了但大量跳过”的体验。</div>
            </div>
            <span className="pill" style={{ color: aiReadinessTone, borderColor: aiReadinessTone }}>
              {aiReadinessLabel}
            </span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
            <div className="card">
              <div className="section-title">已绑教师目标班级</div>
              <p>
                {aiTeacherBoundTargetCount} / {aiTargetClassCount}
              </p>
            </div>
            <div className="card">
              <div className="section-title">缺模板目标班级</div>
              <p>{aiMissingTemplateTargetCount} 个</p>
            </div>
            <div className="card">
              <div className="section-title">缺教师规则班级</div>
              <p>{aiTeacherRuleGapTargetCount} 个</p>
            </div>
            <div className="card">
              <div className="section-title">待补首课班级</div>
              <p>{aiZeroScheduleTargetCount} 个</p>
            </div>
          </div>
          {aiPreviewBlockingReasons.length ? (
            <div className="grid" style={{ gap: 8, marginTop: 12 }}>
              <div className="section-title">必须先处理</div>
              {aiPreviewBlockingReasons.map((reason) => (
                <div key={reason} className="meta-text">
                  - {reason}
                </div>
              ))}
            </div>
          ) : null}
          {aiPreviewWarningReasons.length ? (
            <div className="grid" style={{ gap: 8, marginTop: 12 }}>
              <div className="section-title">建议先补配置</div>
              {aiPreviewWarningReasons.slice(0, 5).map((reason) => (
                <div key={reason} className="meta-text">
                  - {reason}
                </div>
              ))}
            </div>
          ) : null}
          <div className="cta-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
            <a className="button ghost" href="#schedule-templates">
              去补课时模板
            </a>
            <a className="button ghost" href="#schedule-unavailability">
              去配禁排时段
            </a>
            <a className="button ghost" href="#schedule-rules">
              去配教师规则
            </a>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">排课模式</span>
            <select value={aiForm.mode} onChange={(event) => setAiForm((prev) => ({ ...prev, mode: event.target.value as AiMode }))} style={fieldStyle}>
              <option value="fill_missing">补齐不足课时</option>
              <option value="replace_all">全校重排课表</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">每班每周总节数</span>
            <input
              type="number"
              min={1}
              max={30}
              value={aiForm.weeklyLessonsPerClass}
              onChange={(event) => setAiForm((prev) => ({ ...prev, weeklyLessonsPerClass: event.target.value }))}
              style={fieldStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">单节课时（分钟）</span>
            <input
              type="number"
              min={30}
              max={120}
              value={aiForm.lessonDurationMinutes}
              onChange={(event) => setAiForm((prev) => ({ ...prev, lessonDurationMinutes: event.target.value }))}
              style={fieldStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">每日节次数</span>
            <input
              type="number"
              min={1}
              max={12}
              value={aiForm.periodsPerDay}
              onChange={(event) => setAiForm((prev) => ({ ...prev, periodsPerDay: event.target.value }))}
              style={fieldStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">首节开始时间</span>
            <input type="time" value={aiForm.dayStartTime} onChange={(event) => setAiForm((prev) => ({ ...prev, dayStartTime: event.target.value }))} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">课间（分钟）</span>
            <input
              type="number"
              min={0}
              max={30}
              value={aiForm.shortBreakMinutes}
              onChange={(event) => setAiForm((prev) => ({ ...prev, shortBreakMinutes: event.target.value }))}
              style={fieldStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">午休前节次</span>
            <input
              type="number"
              min={1}
              max={12}
              value={aiForm.lunchBreakAfterPeriod}
              onChange={(event) => setAiForm((prev) => ({ ...prev, lunchBreakAfterPeriod: event.target.value }))}
              style={fieldStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">午休（分钟）</span>
            <input
              type="number"
              min={0}
              max={180}
              value={aiForm.lunchBreakMinutes}
              onChange={(event) => setAiForm((prev) => ({ ...prev, lunchBreakMinutes: event.target.value }))}
              style={fieldStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">默认校区</span>
            <input
              value={aiForm.campus}
              onChange={(event) => setAiForm((prev) => ({ ...prev, campus: event.target.value }))}
              placeholder="如：主校区 / 东校区"
              style={fieldStyle}
            />
          </label>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <span className="section-sub">排课日</span>
          <div className="cta-row" style={{ flexWrap: "wrap" }}>
            {WEEKDAY_OPTIONS.map((item) => {
              const active = aiForm.weekdays.includes(item.value);
              return (
                <button
                  key={item.value}
                  className={active ? "button secondary" : "button ghost"}
                  type="button"
                  onClick={() => onToggleAiWeekday(item.value)}
                  disabled={aiGenerating || aiRollingBack}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {latestAiOperation ? (
          <div className="card">
            <div className="section-title">最近一次已写入的 AI 排课</div>
            <div className="meta-text" style={{ marginTop: 6 }}>
              {latestAiOperation.mode === "replace_all" ? "全校重排" : "补齐课时"} · 目标班级 {latestAiOperation.targetClassCount} 个 · 新增 {latestAiOperation.createdSessions} 节 · 未完成 {latestAiOperation.unresolvedLessons} 节
            </div>
            <div className="meta-text" style={{ marginTop: 6 }}>
              写入于 {formatLoadedTime(latestAiOperation.appliedAt ?? latestAiOperation.createdAt)}
              {latestAiOperation.lockedPreservedSessionCount ? ` · 保留锁定节次 ${latestAiOperation.lockedPreservedSessionCount} 个` : ""}
            </div>
          </div>
        ) : null}

        {aiError ? <StatePanel compact tone="error" title="AI 排课失败" description={aiError} /> : null}
        {aiMessage ? <StatePanel compact tone="success" title={aiResult?.applied ? "AI 排课已写入" : "AI 预演完成"} description={aiMessage} /> : null}

        <div className="cta-row">
          <button
            className="button primary"
            data-testid="school-schedules-ai-preview"
            type="button"
            onClick={onPreview}
            disabled={aiGenerating || aiRollingBack || aiPreviewBlockingReasons.length > 0}
          >
            {aiPreviewBlockingReasons.length ? "先补配置再预演" : aiGenerating && (!aiResult?.previewId || aiResult?.applied) ? "AI 预演中..." : "先预演 AI 排课"}
          </button>
          <button
            className="button secondary"
            data-testid="school-schedules-ai-apply"
            type="button"
            onClick={onApplyPreview}
            disabled={aiGenerating || aiRollingBack || !aiResult?.previewId || aiResult?.applied}
          >
            {aiGenerating && aiResult?.previewId && !aiResult?.applied ? "写入中..." : aiResult?.applied ? "已写入课表" : "确认写入课表"}
          </button>
          <button
            className="button ghost"
            data-testid="school-schedules-ai-rollback"
            type="button"
            onClick={onRollback}
            disabled={aiGenerating || aiRollingBack || !latestAiOperation?.rollbackAvailable}
          >
            {aiRollingBack ? "回滚中..." : "回滚最近一次 AI"}
          </button>
          <button className="button ghost" type="button" onClick={onResetAiForm} disabled={aiGenerating || aiRollingBack}>
            重置配置
          </button>
        </div>

        {aiResult ? (
          <div className="grid grid-2" style={{ alignItems: "start" }}>
            <div className="card">
              <div className="section-title">{aiResult.applied ? "本次 AI 已写入课表" : "本次 AI 预演结果"}</div>
              <div className="meta-text" style={{ marginTop: 6 }}>
                目标班级 {aiResult.summary.targetClassCount} 个 · 新增节次 {aiResult.summary.createdSessions} 个 · 未完成 {aiResult.summary.unresolvedLessons} 节
                {(aiResult.summary.lockedPreservedSessionCount ?? 0) > 0 ? ` · 保留锁定 ${aiResult.summary.lockedPreservedSessionCount ?? 0} 节` : ""}
              </div>
              <div className="meta-text" style={{ marginTop: 6 }}>
                {aiResult.applied ? "本轮已落库；如果尚未有后续人工改动，可用上方按钮一键回滚。" : "当前仅为预演结果，确认后才会正式写入学校课程表。"}
              </div>
              <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                {aiResult.createdSessions.slice(0, 6).map((item) => (
                  <div key={item.id} style={{ border: "1px solid var(--stroke)", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{item.className}</div>
                    <div className="section-sub" style={{ marginTop: 4 }}>
                      {item.startTime}-{item.endTime}
                      {item.slotLabel ? ` · ${item.slotLabel}` : ""}
                    </div>
                    <div className="meta-text" style={{ marginTop: 6 }}>
                      {formatSubjectLine(item)}
                      {item.room ? ` · ${item.room}` : ""}
                    </div>
                  </div>
                ))}
                {!aiResult.createdSessions.length ? <div className="section-sub">本次没有生成新节次。</div> : null}
              </div>
            </div>

            <div className="card">
              <div className="section-title">班级处理明细</div>
              <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                {aiResult.impactedClasses.slice(0, 8).map((item) => (
                  <div key={item.id} style={{ border: "1px solid var(--stroke)", borderRadius: 12, padding: 10 }}>
                    <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</div>
                        <div className="section-sub" style={{ marginTop: 4 }}>
                          {item.subject} · {item.grade} 年级 · 教师 {item.teacherName ?? item.teacherId ?? "未绑定"}
                        </div>
                      </div>
                      <span className="pill">{item.status === "generated" ? "已生成" : item.status === "unchanged" ? "已达标" : "已跳过"}</span>
                    </div>
                    <div className="meta-text" style={{ marginTop: 6 }}>
                      目标 {item.requestedLessons} 节 · 新增 {item.createdLessons} 节 · 课表总数 {item.totalLessonsAfter} 节
                    </div>
                    {item.reason ? <div className="meta-text" style={{ marginTop: 6 }}>说明：{item.reason}</div> : null}
                  </div>
                ))}
              </div>
              {aiResult.warnings.length ? (
                <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                  <div className="section-title">需人工确认</div>
                  {aiResult.warnings.slice(0, 6).map((warning, index) => (
                    <div key={`${warning}-${index}`} className="meta-text">
                      - {warning}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="meta-text" style={{ marginTop: 12 }}>本轮未发现需要人工处理的异常约束。</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
