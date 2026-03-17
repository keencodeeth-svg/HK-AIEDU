import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { NotificationItem } from "../types";
import { getNotificationTypeLabel } from "../utils";

type NotificationsListCardProps = {
  list: NotificationItem[];
  filteredList: NotificationItem[];
  actingKey: string | null;
  onMarkRead: (id: string) => void;
  onClearFilters: () => void;
};

export default function NotificationsListCard({
  list,
  filteredList,
  actingKey,
  onMarkRead,
  onClearFilters
}: NotificationsListCardProps) {
  return (
    <Card title="通知列表" tag="消息">
      {!list.length ? (
        <StatePanel
          compact
          tone="empty"
          title="目前没有通知"
          description="当老师发布作业、班级有新动态或系统推送提醒时，这里会第一时间展示。"
        />
      ) : !filteredList.length ? (
        <StatePanel
          compact
          tone="empty"
          title="没有匹配的通知"
          description="试试更换筛选条件或清空关键词。"
          action={
            <button className="button secondary" type="button" onClick={onClearFilters}>
              清空筛选
            </button>
          }
        />
      ) : (
        <div className="notification-list">
          {filteredList.map((item) => (
            <div className={`notification-item-card${item.readAt ? "" : " unread"}`} key={item.id}>
              <div className="notification-item-header">
                <div>
                  <div className="section-title">{item.title}</div>
                  <div className="notification-item-meta">
                    <span className="pill">{getNotificationTypeLabel(item.type)}</span>
                    <span className="pill">{item.readAt ? "已读" : "未读"}</span>
                    <span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
                  </div>
                </div>
                {!item.readAt ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => onMarkRead(item.id)}
                    disabled={actingKey !== null}
                  >
                    {actingKey === item.id ? "处理中..." : "标记已读"}
                  </button>
                ) : null}
              </div>
              <p style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{item.content}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
