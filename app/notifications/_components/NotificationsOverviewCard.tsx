import Card from "@/components/Card";

type NotificationsOverviewCardProps = {
  totalCount: number;
  unreadCount: number;
  readCount: number;
  typeCount: number;
};

export default function NotificationsOverviewCard({
  totalCount,
  unreadCount,
  readCount,
  typeCount
}: NotificationsOverviewCardProps) {
  return (
    <Card title="通知概览" tag="概览">
      <div className="grid grid-2">
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">通知总数</div>
          <div className="workflow-summary-value">{totalCount}</div>
          <div className="workflow-summary-helper">当前账号可见的全部通知</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">未读通知</div>
          <div className="workflow-summary-value">{unreadCount}</div>
          <div className="workflow-summary-helper">建议优先处理的最新提醒</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">已读通知</div>
          <div className="workflow-summary-value">{readCount}</div>
          <div className="workflow-summary-helper">已确认或已浏览的消息</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">通知类型</div>
          <div className="workflow-summary-value">{typeCount}</div>
          <div className="workflow-summary-helper">作业、班级、公告等分类提醒</div>
        </div>
      </div>
    </Card>
  );
}
