import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime } from "@/lib/client-request";
import type { Topic } from "../types";
import { truncateDiscussionText } from "../utils";

type DiscussionsTopicListCardProps = {
  listLoading: boolean;
  hasClasses: boolean;
  filteredTopics: Topic[];
  totalTopicCount: number;
  activeTopicId: string;
  hasTopicFilters: boolean;
  teacherMode: boolean;
  onSelectTopic: (topicId: string) => void;
  onClearFilters: () => void;
};

export default function DiscussionsTopicListCard({
  listLoading,
  hasClasses,
  filteredTopics,
  totalTopicCount,
  activeTopicId,
  hasTopicFilters,
  teacherMode,
  onSelectTopic,
  onClearFilters
}: DiscussionsTopicListCardProps) {
  return (
    <Card title="话题列表" tag="列表">
      {listLoading && !totalTopicCount ? (
        <StatePanel compact tone="loading" title="正在加载话题" description="马上展示当前班级的最新讨论。" />
      ) : !hasClasses ? (
        <StatePanel compact tone="empty" title="暂无班级讨论" description="加入班级后，这里会展示可参与的话题列表。" />
      ) : filteredTopics.length === 0 ? (
        <StatePanel
          compact
          tone="empty"
          title={hasTopicFilters ? "当前筛选条件下暂无话题" : "当前班级还没有讨论话题"}
          description={
            hasTopicFilters
              ? "可以清空筛选后查看全部话题。"
              : teacherMode
                ? "先发布一个课堂讨论，学生就能开始参与。"
                : "等老师发布新话题后，你可以在这里直接参与回复。"
          }
          action={
            hasTopicFilters ? (
              <button className="button secondary" type="button" onClick={onClearFilters}>
                清空筛选
              </button>
            ) : null
          }
        />
      ) : (
        <div className="inbox-thread-list">
          {filteredTopics.map((topic) => (
            <button key={topic.id} type="button" className={`inbox-thread-item${topic.id === activeTopicId ? " active" : ""}`} onClick={() => onSelectTopic(topic.id)}>
              <div className="inbox-thread-header">
                <div className="section-title">{topic.title}</div>
                {topic.pinned ? <span className="card-tag">置顶</span> : <span className="pill">普通</span>}
              </div>
              <div className="section-sub">
                {topic.authorName ?? "老师"} · 发布于 {formatLoadedTime(topic.createdAt)}
              </div>
              <div className="inbox-thread-preview">{truncateDiscussionText(topic.content)}</div>
              <div className="workflow-card-meta">
                <span className="pill">更新于 {formatLoadedTime(topic.updatedAt)}</span>
                {topic.id === activeTopicId ? <span className="pill">当前查看中</span> : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
