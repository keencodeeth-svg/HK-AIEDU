"use client";

import { formatLoadedTime } from "@/lib/client-request";

type TeacherNotificationHeaderProps = {
  selectedClassLabel: string;
  configuredRuleCount: number;
  enabledRuleCount: number;
  assignmentTargets: number | null;
  lastLoadedAt: string | null;
  refreshing: boolean;
  disabled: boolean;
  onRefresh: () => void;
};

export default function TeacherNotificationHeader({
  selectedClassLabel,
  configuredRuleCount,
  enabledRuleCount,
  assignmentTargets,
  lastLoadedAt,
  refreshing,
  disabled,
  onRefresh
}: TeacherNotificationHeaderProps) {
  return (
    <div className="section-head">
      <div>
        <h2>通知规则</h2>
        <div className="section-sub">把提醒阈值、发送预览、历史复盘和后续验收串成一条完整催交链路。</div>
      </div>
      <div className="workflow-toolbar">
        <span className="chip">教师端</span>
        <span className="chip">{selectedClassLabel}</span>
        <span className="chip">已配置规则 {configuredRuleCount}</span>
        <span className="chip">启用中 {enabledRuleCount}</span>
        {assignmentTargets ? <span className="chip">当前待发 {assignmentTargets} 份作业</span> : null}
        {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
        <button className="button secondary" type="button" onClick={onRefresh} disabled={disabled}>
          {refreshing ? "刷新中..." : "刷新"}
        </button>
      </div>
    </div>
  );
}
