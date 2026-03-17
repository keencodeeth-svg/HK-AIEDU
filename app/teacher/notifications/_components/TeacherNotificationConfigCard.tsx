import { SUBJECT_LABELS } from "@/lib/constants";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import type { ClassItem, PreviewData, RuleItem } from "../types";
import { getRuleWindowLabel, getSelectedClassLabel } from "../utils";

type TeacherNotificationConfigCardProps = {
  classes: ClassItem[];
  classId: string;
  selectedClass: ClassItem | null;
  draftRule: RuleItem;
  hasUnsavedChanges: boolean;
  isPreviewCurrent: boolean;
  preview: PreviewData | null;
  saving: boolean;
  running: boolean;
  previewing: boolean;
  onClassChange: (classId: string) => void;
  onUpdateDraft: (patch: Partial<RuleItem>) => void;
  onReset: () => void;
  onPreview: () => void;
  onSave: () => void;
  onRun: () => void;
};

export default function TeacherNotificationConfigCard({
  classes,
  classId,
  selectedClass,
  draftRule,
  hasUnsavedChanges,
  isPreviewCurrent,
  preview,
  saving,
  running,
  previewing,
  onClassChange,
  onUpdateDraft,
  onReset,
  onPreview,
  onSave,
  onRun
}: TeacherNotificationConfigCardProps) {
  return (
    <Card title="规则与执行区" tag="Config">
      <div className="feature-card">
        <EduIcon name="board" />
        <p>先选班级和提醒窗口，再刷新预览核对触达范围；保存解决默认策略，立即发送解决今天这一轮催交。</p>
      </div>

      <div className="teacher-notification-rule-grid" id="teacher-notification-config">
        <label>
          <div className="section-title">选择班级</div>
          <select value={classId} onChange={(event) => onClassChange(event.target.value)} style={{ width: "100%" }}>
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name} · {SUBJECT_LABELS[klass.subject] ?? klass.subject} · {klass.grade} 年级
              </option>
            ))}
          </select>
        </label>

        <label>
          <div className="section-title">提醒开关</div>
          <select
            value={draftRule.enabled ? "on" : "off"}
            onChange={(event) => onUpdateDraft({ enabled: event.target.value === "on" })}
            style={{ width: "100%" }}
          >
            <option value="on">开启</option>
            <option value="off">关闭</option>
          </select>
        </label>

        <label>
          <div className="section-title">截止前提醒（天）</div>
          <input
            className="workflow-search-input"
            type="number"
            min={0}
            value={draftRule.dueDays}
            onChange={(event) => onUpdateDraft({ dueDays: Number(event.target.value || 0) })}
          />
        </label>

        <label>
          <div className="section-title">逾期提醒（天）</div>
          <input
            className="workflow-search-input"
            type="number"
            min={0}
            value={draftRule.overdueDays}
            onChange={(event) => onUpdateDraft({ overdueDays: Number(event.target.value || 0) })}
          />
        </label>

        <label className="teacher-notification-checkbox">
          <input
            type="checkbox"
            checked={draftRule.includeParents}
            onChange={(event) => onUpdateDraft({ includeParents: event.target.checked })}
          />
          <span>抄送家长</span>
        </label>
      </div>

      <div className="workflow-card-meta">
        <span className="pill">{getSelectedClassLabel(selectedClass)}</span>
        <span className="pill">当前草稿 {draftRule.enabled ? "已开启" : "已关闭"}</span>
        <span className="pill">{getRuleWindowLabel(draftRule)}</span>
      </div>

      <div className="meta-text" style={{ marginTop: 12 }}>
        当前班级的默认规则是持久配置，但“立即发送提醒”始终会按当前草稿执行。先预览，再决定是只处理今天，还是顺便把默认策略也更新掉。
      </div>

      <div className="cta-row" id="teacher-notification-actions" style={{ marginTop: 12 }}>
        <button className="button ghost" type="button" onClick={onReset} disabled={!hasUnsavedChanges || saving || running || previewing}>
          重置修改
        </button>
        <button className="button secondary" type="button" onClick={onPreview} disabled={previewing || saving || running}>
          {previewing ? "预览中..." : "刷新预览"}
        </button>
        <button className="button secondary" type="button" onClick={onSave} disabled={saving || running || previewing || !hasUnsavedChanges}>
          {saving ? "保存中..." : "保存默认规则"}
        </button>
        <button
          className="button primary"
          type="button"
          onClick={onRun}
          disabled={running || saving || previewing || !draftRule.enabled || !isPreviewCurrent || !preview?.summary.assignmentTargets}
        >
          {running ? "发送中..." : "立即发送提醒"}
        </button>
      </div>
    </Card>
  );
}
