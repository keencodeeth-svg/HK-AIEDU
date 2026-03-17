"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import NotificationsFiltersCard from "./_components/NotificationsFiltersCard";
import NotificationsHeader from "./_components/NotificationsHeader";
import NotificationsListCard from "./_components/NotificationsListCard";
import NotificationsOverviewCard from "./_components/NotificationsOverviewCard";
import { useNotificationsPageView } from "./useNotificationsPageView";

export default function NotificationsPage() {
  const notificationsPage = useNotificationsPageView();

  if (notificationsPage.loading && !notificationsPage.hasNotifications && !notificationsPage.authRequired) {
    return (
      <StatePanel
        tone="loading"
        title="通知中心加载中"
        description="正在同步作业提醒、班级动态和学习反馈。"
      />
    );
  }

  if (notificationsPage.authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录后查看通知"
        description="登录后可查看作业、班级和学习相关提醒。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (notificationsPage.error && !notificationsPage.hasNotifications) {
    return (
      <StatePanel
        tone="error"
        title="通知中心暂时不可用"
        description={notificationsPage.error}
        action={
          <button className="button secondary" type="button" onClick={notificationsPage.reload}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <NotificationsHeader {...notificationsPage.headerProps} />

      {notificationsPage.error ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${notificationsPage.error}`}
          action={
            <button className="button secondary" type="button" onClick={notificationsPage.reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      <NotificationsOverviewCard {...notificationsPage.overviewProps} />

      <NotificationsFiltersCard {...notificationsPage.filtersProps} />

      <NotificationsListCard {...notificationsPage.listProps} />
    </div>
  );
}
