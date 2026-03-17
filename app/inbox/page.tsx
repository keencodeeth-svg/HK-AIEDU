"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import InboxComposerCard from "./_components/InboxComposerCard";
import InboxHeader from "./_components/InboxHeader";
import InboxOverviewCard from "./_components/InboxOverviewCard";
import InboxThreadDetailCard from "./_components/InboxThreadDetailCard";
import InboxThreadsCard from "./_components/InboxThreadsCard";
import { useInboxPageView } from "./useInboxPageView";

export default function InboxPage() {
  const inboxPage = useInboxPageView();

  if (inboxPage.loading && !inboxPage.authRequired && !inboxPage.hasInboxData) {
    return (
      <StatePanel
        tone="loading"
        title="收件箱加载中"
        description="正在同步会话列表、参与人和最新消息。"
      />
    );
  }

  if (inboxPage.authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录后使用收件箱"
        description="登录后即可查看会话列表、发送新消息并进行家校沟通。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (inboxPage.pageError && !inboxPage.hasInboxData) {
    return (
      <StatePanel
        tone="error"
        title="收件箱暂时不可用"
        description={inboxPage.pageError}
        action={
          <button className="button secondary" type="button" onClick={inboxPage.reloadInbox}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <InboxHeader {...inboxPage.headerProps} />

      {inboxPage.pageError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新同步失败：${inboxPage.pageError}`}
          action={
            <button className="button secondary" type="button" onClick={inboxPage.reloadInbox}>
              再试一次
            </button>
          }
        />
      ) : null}

      {inboxPage.requestedThreadMatched ? (
        <StatePanel
          compact
          tone="success"
          title="已打开分享会话"
          description="你可以继续在这里回复老师或家长，完成这次拍题沟通闭环。"
        />
      ) : null}

      <InboxOverviewCard {...inboxPage.overviewProps} />

      <InboxComposerCard {...inboxPage.composerProps} />

      <div className="grid grid-2">
        <InboxThreadsCard {...inboxPage.threadsCardProps} />

        <InboxThreadDetailCard {...inboxPage.detailCardProps} />
      </div>
    </div>
  );
}
