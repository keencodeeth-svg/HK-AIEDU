import Card from "@/components/Card";

type InboxOverviewCardProps = {
  threadsCount: number;
  unreadCount: number;
  activeThreadSubject: string | null;
  classesCount: number;
};

export default function InboxOverviewCard({
  threadsCount,
  unreadCount,
  activeThreadSubject,
  classesCount
}: InboxOverviewCardProps) {
  return (
    <Card title="沟通概览" tag="概览">
      <div className="grid grid-2">
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">会话总数</div>
          <div className="workflow-summary-value">{threadsCount}</div>
          <div className="workflow-summary-helper">已建立的班级与家校沟通会话</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">未读消息</div>
          <div className="workflow-summary-value">{unreadCount}</div>
          <div className="workflow-summary-helper">需要优先查看和处理的消息数</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">当前会话</div>
          <div className="workflow-summary-value">{activeThreadSubject ? 1 : 0}</div>
          <div className="workflow-summary-helper">{activeThreadSubject ?? "尚未选中会话"}</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">班级范围</div>
          <div className="workflow-summary-value">{classesCount}</div>
          <div className="workflow-summary-helper">可用于发起沟通的班级数</div>
        </div>
      </div>
    </Card>
  );
}
