import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime } from "@/lib/client-request";
import type { PreviewAssignment, PreviewData } from "../types";
import { getRuleWindowLabel, getStageDescription, getStageLabel } from "../utils";

type TeacherNotificationPreviewCardProps = {
  previewing: boolean;
  preview: PreviewData | null;
  overdueAssignments: PreviewAssignment[];
  dueSoonAssignments: PreviewAssignment[];
};

export default function TeacherNotificationPreviewCard({
  previewing,
  preview,
  overdueAssignments,
  dueSoonAssignments
}: TeacherNotificationPreviewCardProps) {
  return (
    <Card title="优先提醒队列" tag="Preview">
      <div id="teacher-notification-preview">
        {previewing && !preview ? (
          <StatePanel compact tone="loading" title="预览生成中" description="正在根据当前草稿计算提醒范围。" />
        ) : !preview ? (
          <StatePanel
            compact
            tone="empty"
            title="当前还没有提醒预览"
            description="调整规则后刷新预览，这里会直接告诉你今天先催哪一批作业。"
          />
        ) : !preview.summary.enabled ? (
          <StatePanel
            compact
            tone="info"
            title="当前规则处于关闭状态"
            description="开启提醒开关后，系统才会根据阈值筛出待发送作业。"
          />
        ) : !preview.summary.assignmentTargets ? (
          <StatePanel
            compact
            tone="empty"
            title="当前配置下没有待发送提醒"
            description="可以放宽截止前提醒天数、调整逾期窗口，或等待班级出现新的待完成作业。"
          />
        ) : (
          <div className="teacher-notification-queue-groups">
            <div className="teacher-notification-queue-group">
              <div className="task-queue-group-head">
                <div>
                  <div className="section-title">逾期优先队列</div>
                  <div className="meta-text">先看已经逾期的作业，这批最影响今天的催交效率。</div>
                </div>
                <span className="chip">共 {overdueAssignments.length} 份</span>
              </div>

              {overdueAssignments.length ? (
                <div className="notification-preview-list">
                  {overdueAssignments.map((item) => (
                    <div className="notification-preview-card overdue" key={item.assignmentId}>
                      <div className="notification-preview-header">
                        <div>
                          <div className="section-title">{item.title}</div>
                          <div className="meta-text">截止 {new Date(item.dueDate).toLocaleDateString("zh-CN")}</div>
                        </div>
                        <span className="card-tag">{getStageLabel(item.stage)}</span>
                      </div>
                      <div className="notification-preview-meta">
                        <span className="pill">学生提醒 {item.studentTargets}</span>
                        <span className="pill">家长提醒 {item.parentTargets}</span>
                      </div>
                      <div className="notification-preview-note">{getStageDescription(item.stage)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <StatePanel
                  compact
                  tone="empty"
                  title="当前没有逾期作业"
                  description="说明这轮提醒更适合用在截止前预防，而不是事后催交。"
                />
              )}
            </div>

            <div className="teacher-notification-queue-group">
              <div className="task-queue-group-head">
                <div>
                  <div className="section-title">即将到期队列</div>
                  <div className="meta-text">这批适合做温和提醒，把今天的临期作业拦在逾期前。</div>
                </div>
                <span className="chip">共 {dueSoonAssignments.length} 份</span>
              </div>

              {dueSoonAssignments.length ? (
                <div className="notification-preview-list">
                  {dueSoonAssignments.map((item) => (
                    <div className="notification-preview-card due-soon" key={item.assignmentId}>
                      <div className="notification-preview-header">
                        <div>
                          <div className="section-title">{item.title}</div>
                          <div className="meta-text">截止 {new Date(item.dueDate).toLocaleDateString("zh-CN")}</div>
                        </div>
                        <span className="card-tag">{getStageLabel(item.stage)}</span>
                      </div>
                      <div className="notification-preview-meta">
                        <span className="pill">学生提醒 {item.studentTargets}</span>
                        <span className="pill">家长提醒 {item.parentTargets}</span>
                      </div>
                      <div className="notification-preview-note">{getStageDescription(item.stage)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <StatePanel
                  compact
                  tone="empty"
                  title="当前没有即将到期作业"
                  description="如果当前确实没有临期任务，这一块可以视为今天不需要主动提醒。"
                />
              )}
            </div>
          </div>
        )}

        {preview ? (
          <div className="workflow-card-meta" style={{ marginTop: 12 }}>
            <span className="pill">预览生成于 {formatLoadedTime(preview.generatedAt)}</span>
            <span className="pill">当前规则 {getRuleWindowLabel(preview.rule)}</span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
