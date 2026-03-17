import { SUBJECT_LABELS } from "@/lib/constants";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime } from "@/lib/client-request";
import type { HistoryItem, HistoryResponse } from "../types";
import { getStageLabel } from "../utils";

type TeacherNotificationHistoryCardProps = {
  historyLoading: boolean;
  history: HistoryItem[];
  historySummary: HistoryResponse["summary"] | null;
  latestHistory: HistoryItem | null;
  classId: string;
};

export default function TeacherNotificationHistoryCard({
  historyLoading,
  history,
  historySummary,
  latestHistory,
  classId
}: TeacherNotificationHistoryCardProps) {
  return (
    <Card title="执行历史与复盘" tag="History">
      <div id="teacher-notification-history">
        <div className="workflow-card-meta">
          <span className="pill">历史记录 {historySummary?.totalRuns ?? 0} 次</span>
          <span className="pill">累计学生提醒 {historySummary?.studentTargets ?? 0} 条</span>
          <span className="pill">累计家长提醒 {historySummary?.parentTargets ?? 0} 条</span>
          <span className="pill">累计作业覆盖 {historySummary?.assignmentTargets ?? 0} 份</span>
        </div>

        <div className="meta-text" style={{ marginTop: 12 }}>
          历史记录负责回答“之前发过多少”，但它不能替代结果页。复盘时要把这里的触达规模，和提交箱、成绩册里的变化放在一起看。
        </div>

        {historyLoading && !history.length ? (
          <StatePanel compact tone="loading" title="历史加载中" description="正在同步当前班级的最近执行记录。" />
        ) : !history.length ? (
          <StatePanel
            compact
            tone="empty"
            title="当前班级还没有执行历史"
            description="执行一次“立即发送提醒”后，这里会记录本次触达范围、规则快照和作业样本。"
          />
        ) : (
          <div className="notification-history-list">
            {history.map((item) => {
              const classResult = item.classResults.find((entry) => entry.classId === classId) ?? item.classResults[0];
              if (!classResult) return null;

              return (
                <div className="notification-history-card" key={item.id}>
                  <div className="notification-history-header">
                    <div>
                      <div className="section-title">执行于 {formatLoadedTime(item.executedAt)}</div>
                      <div className="workflow-summary-helper">
                        {classResult.className} · {SUBJECT_LABELS[classResult.subject] ?? classResult.subject} · {classResult.grade} 年级
                      </div>
                    </div>
                    {latestHistory?.id === item.id ? <span className="card-tag">最近一次</span> : <span className="pill">历史记录</span>}
                  </div>

                  <div className="notification-history-metrics">
                    <span className="pill">学生提醒 {classResult.studentTargets}</span>
                    <span className="pill">家长提醒 {classResult.parentTargets}</span>
                    <span className="pill">作业覆盖 {classResult.assignmentTargets}</span>
                    <span className="pill">即将到期 {classResult.dueSoonAssignments}</span>
                    <span className="pill">已逾期 {classResult.overdueAssignments}</span>
                  </div>

                  <div className="workflow-summary-helper" style={{ marginTop: 8 }}>
                    规则快照：{classResult.rule.enabled ? "开启" : "关闭"} · 截止前 {classResult.rule.dueDays} 天 · 逾期 {classResult.rule.overdueDays} 天 · 家长抄送{" "}
                    {classResult.rule.includeParents ? "开启" : "关闭"}
                  </div>

                  {classResult.sampleAssignments.length ? (
                    <div className="notification-history-samples">
                      {classResult.sampleAssignments.map((sample) => (
                        <div className="notification-history-sample" key={`${item.id}-${sample.assignmentId}`}>
                          <div className="section-title" style={{ fontSize: 13 }}>
                            {sample.title}
                          </div>
                          <div className="workflow-summary-helper">
                            {getStageLabel(sample.stage)} · 截止 {new Date(sample.dueDate).toLocaleDateString("zh-CN")} · 学生 {sample.studentTargets} · 家长 {sample.parentTargets}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
