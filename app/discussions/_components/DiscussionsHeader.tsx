"use client";

import { formatLoadedTime } from "@/lib/client-request";

type DiscussionsHeaderProps = {
  classCount: number;
  topicsCount: number;
  pinnedTopicCount: number;
  lastLoadedAt: string | null;
  refreshing: boolean;
  disabled: boolean;
  onRefresh: () => void;
};

export default function DiscussionsHeader({
  classCount,
  topicsCount,
  pinnedTopicCount,
  lastLoadedAt,
  refreshing,
  disabled,
  onRefresh
}: DiscussionsHeaderProps) {
  return (
    <div className="section-head">
      <div>
        <h2>课程讨论区</h2>
        <div className="section-sub">班级话题、课堂答疑、互动回复与讨论沉淀统一收敛。</div>
      </div>
      <div className="workflow-toolbar">
        <span className="chip">讨论</span>
        <span className="chip">班级 {classCount}</span>
        <span className="chip">话题 {topicsCount}</span>
        <span className="chip">置顶 {pinnedTopicCount}</span>
        {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
        <button className="button secondary" type="button" onClick={onRefresh} disabled={disabled}>
          {refreshing ? "刷新中..." : "刷新"}
        </button>
      </div>
    </div>
  );
}
