"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import DiscussionsComposerCard from "./_components/DiscussionsComposerCard";
import DiscussionsDetailCard from "./_components/DiscussionsDetailCard";
import DiscussionsFiltersCard from "./_components/DiscussionsFiltersCard";
import DiscussionsHeader from "./_components/DiscussionsHeader";
import DiscussionsOverviewCard from "./_components/DiscussionsOverviewCard";
import DiscussionsTopicListCard from "./_components/DiscussionsTopicListCard";
import { useDiscussionsPageView } from "./useDiscussionsPageView";

export default function DiscussionsPage() {
  const {
    loading,
    authRequired,
    hasDiscussionData,
    teacherMode,
    classes,
    pageError,
    actionError,
    actionMessage,
    detailSectionRef,
    headerProps,
    overviewProps,
    filtersProps,
    composerProps,
    topicListProps,
    detailProps,
    reload
  } = useDiscussionsPageView();

  if (loading && !authRequired && !hasDiscussionData) {
    return (
      <StatePanel
        tone="loading"
        title="正在加载讨论区"
        description="正在同步班级、话题与回复数据，请稍等片刻。"
      />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录再查看讨论区"
        description="登录后即可按身份进入班级讨论，查看老师话题并继续互动。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (pageError && !classes.length && !hasDiscussionData) {
    return (
      <StatePanel
        tone="error"
        title="讨论区加载失败"
        description={pageError}
        action={
          <button className="button secondary" type="button" onClick={reload}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <DiscussionsHeader {...headerProps} />

      {pageError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${pageError}`}
          action={
            <button className="button secondary" type="button" onClick={reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      {actionError ? <div className="status-note error">{actionError}</div> : null}
      {actionMessage ? <div className="status-note success">{actionMessage}</div> : null}

      <DiscussionsOverviewCard {...overviewProps} />

      <DiscussionsFiltersCard {...filtersProps} />

      {teacherMode ? (
        <DiscussionsComposerCard {...composerProps} />
      ) : null}

      <div className="grid grid-2">
        <DiscussionsTopicListCard {...topicListProps} />

        <div id="discussion-detail-anchor" ref={detailSectionRef} />
        <DiscussionsDetailCard {...detailProps} />
      </div>
    </div>
  );
}
