import Card from "@/components/Card";
import { SUBJECT_LABELS } from "@/lib/constants";
import type {
  AnalysisAlertImpactData,
  AnalysisAlertItem,
  AnalysisAlertSummary,
  AnalysisParentCollaborationSummary,
  TeacherAlertActionType
} from "../types";
import { ACTION_TYPE_LABEL, formatDateTime, getAlertNotificationLabel, getAlertTypeLabel } from "../utils";

type AnalysisAlertsCardProps = {
  alerts: AnalysisAlertItem[];
  alertActionMessage: string | null;
  alertSummary: AnalysisAlertSummary | null;
  parentCollaboration: AnalysisParentCollaborationSummary | null;
  actingAlertKey: string | null;
  acknowledgingAlertId: string | null;
  loadingImpactId: string | null;
  impactByAlertId: Record<string, AnalysisAlertImpactData>;
  onRunAlertAction: (alertId: string, actionType: TeacherAlertActionType) => void | Promise<void>;
  onAcknowledgeAlert: (alertId: string) => void | Promise<void>;
  onLoadAlertImpact: (alertId: string) => void | Promise<void>;
};

export default function AnalysisAlertsCard({
  alerts,
  alertActionMessage,
  alertSummary,
  parentCollaboration,
  actingAlertKey,
  acknowledgingAlertId,
  loadingImpactId,
  impactByAlertId,
  onRunAlertAction,
  onAcknowledgeAlert,
  onLoadAlertImpact
}: AnalysisAlertsCardProps) {
  return (
    <Card title="教师预警看板" tag="风险">
      {alertActionMessage ? <div className="status-note info">{alertActionMessage}</div> : null}
      <div className="grid grid-3">
        <div className="card">
          <div className="section-title">班级风险分</div>
          <div className="kpi-value">{alertSummary?.classRiskScore ?? 0}</div>
        </div>
        <div className="card">
          <div className="section-title">活跃预警</div>
          <div className="kpi-value">{alertSummary?.activeAlerts ?? 0}</div>
        </div>
        <div className="card">
          <div className="section-title">高风险预警</div>
          <div className="kpi-value">{alertSummary?.highRiskAlerts ?? 0}</div>
        </div>
      </div>
      {parentCollaboration ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="section-title">家校协同闭环</div>
          <div className="pill-list" style={{ marginTop: 8 }}>
            <span className="pill">
              7天活跃家长 {parentCollaboration.activeParentCount7d}/{parentCollaboration.totalParentCount}
            </span>
            <span className="pill">回执覆盖学生 {parentCollaboration.coveredStudentCount}</span>
            <span className="pill">回执完成率 {parentCollaboration.doneRate}%</span>
            <span className="pill">近7天完成率 {parentCollaboration.last7dDoneRate}%</span>
            <span className="pill">净效果分 {parentCollaboration.avgEffectScore}</span>
            <span className="pill">执行时长 {parentCollaboration.doneMinutes} 分钟</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>
            周报动作完成率 {parentCollaboration.sourceDoneRate.weeklyReport}% · 作业动作完成率{" "}
            {parentCollaboration.sourceDoneRate.assignmentPlan}% · 累计回执 {parentCollaboration.receiptCount} 条
          </div>
        </div>
      ) : null}
      <div className="grid" style={{ gap: 10, marginTop: 12 }}>
        {alerts.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">暂无预警</p>
            <p>当前班级暂无风险告警。</p>
          </div>
        ) : null}
        {alerts.slice(0, 12).map((item) => {
          const impact = impactByAlertId[item.id];

          return (
            <div className="card" key={item.id}>
              <div className="section-title">
                {getAlertTypeLabel(item.type)} · 风险分 {item.riskScore}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                {item.className} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
              </div>
              <p>{item.riskReason}</p>
              <p style={{ color: "var(--ink-1)" }}>建议动作：{item.recommendedAction}</p>
              {item.lastActionType ? (
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  最近动作：{ACTION_TYPE_LABEL[item.lastActionType]} · {formatDateTime(item.lastActionAt)}
                </div>
              ) : null}
              {item.lastActionDetail ? (
                <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>{item.lastActionDetail}</div>
              ) : null}
              <div className="cta-row">
                <button
                  className="button primary"
                  onClick={() => onRunAlertAction(item.id, "auto_chain")}
                  disabled={actingAlertKey === `${item.id}:auto_chain`}
                >
                  {actingAlertKey === `${item.id}:auto_chain` ? "执行中..." : "一键闭环执行"}
                </button>
                <button
                  className="button ghost"
                  onClick={() => onRunAlertAction(item.id, "assign_review")}
                  disabled={actingAlertKey === `${item.id}:assign_review`}
                >
                  {actingAlertKey === `${item.id}:assign_review` ? "布置中..." : "一键布置修复任务"}
                </button>
                <button
                  className="button ghost"
                  onClick={() => onRunAlertAction(item.id, "notify_student")}
                  disabled={actingAlertKey === `${item.id}:notify_student`}
                >
                  {actingAlertKey === `${item.id}:notify_student`
                    ? "提醒中..."
                    : getAlertNotificationLabel(item.type)}
                </button>
                {item.status === "acknowledged" ? (
                  <span className="badge">已确认</span>
                ) : (
                  <button
                    className="button secondary"
                    onClick={() => onAcknowledgeAlert(item.id)}
                    disabled={acknowledgingAlertId === item.id}
                  >
                    {acknowledgingAlertId === item.id ? "确认中..." : "确认预警"}
                  </button>
                )}
                <button
                  className="button ghost"
                  onClick={() => onLoadAlertImpact(item.id)}
                  disabled={loadingImpactId === item.id}
                >
                  {loadingImpactId === item.id ? "加载中..." : "查看24h/72h效果"}
                </button>
              </div>
              {impact ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    border: "1px dashed var(--stroke)",
                    background: "rgba(255,255,255,0.5)"
                  }}
                >
                  {impact.impact.tracked ? (
                    <div style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--ink-1)" }}>
                      <div>
                        基线时间： {formatDateTime(impact.impact.trackedAt)} · 已追踪 {impact.impact.elapsedHours} 小时
                      </div>
                      <div>
                        风险分变化：
                        <strong style={{ marginLeft: 4 }}>{impact.impact.deltas.riskScore ?? 0}</strong>
                        {" · "}
                        {(impact.impact.deltas.riskScore ?? 0) < 0 ? "风险下降" : "风险未下降"}
                      </div>
                      <div>
                        24h 窗口：{impact.impact.windows.h24.ready ? "已到期" : "观察中"} ·{" "}
                        {impact.impact.windows.h24.ready
                          ? `Δ${impact.impact.windows.h24.riskDelta ?? 0}`
                          : `剩余 ${impact.impact.windows.h24.remainingHours}h`}
                      </div>
                      <div>
                        72h 窗口：{impact.impact.windows.h72.ready ? "已到期" : "观察中"} ·{" "}
                        {impact.impact.windows.h72.ready
                          ? `Δ${impact.impact.windows.h72.riskDelta ?? 0}`
                          : `剩余 ${impact.impact.windows.h72.remainingHours}h`}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: 10 }}>
                      <p className="empty-state-title">暂无追踪基线</p>
                      <p>请先执行“一键布置修复任务”或“提醒学生”。</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
