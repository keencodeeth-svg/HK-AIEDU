"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import NotificationExecutionLoopCard from "./_components/NotificationExecutionLoopCard";
import TeacherNotificationCommandCard from "./_components/TeacherNotificationCommandCard";
import TeacherNotificationConfigCard from "./_components/TeacherNotificationConfigCard";
import TeacherNotificationHeader from "./_components/TeacherNotificationHeader";
import TeacherNotificationHistoryCard from "./_components/TeacherNotificationHistoryCard";
import TeacherNotificationPreviewCard from "./_components/TeacherNotificationPreviewCard";
import { useTeacherNotificationRulesPageView } from "./useTeacherNotificationRulesPageView";

export default function TeacherNotificationRulesPage() {
  const {
    loading,
    authRequired,
    hasClasses,
    loadError,
    actionError,
    message,
    classId,
    isPreviewCurrent,
    headerProps,
    executionLoopCardProps,
    configCardProps,
    commandCardProps,
    previewCardProps,
    historyCardProps,
    reload
  } = useTeacherNotificationRulesPageView();

  if (loading && !hasClasses && !authRequired) {
    return (
      <StatePanel
        tone="loading"
        title="通知规则加载中"
        description="正在同步教师班级、已保存规则、提醒预览和执行历史。"
      />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先使用教师账号登录"
        description="登录后即可配置班级通知规则、预览提醒范围并查看执行历史。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (loadError && !hasClasses) {
    return (
      <StatePanel
        tone="error"
        title="通知规则暂时不可用"
        description={loadError}
        action={
          <button className="button secondary" type="button" onClick={reload}>
            重新加载
          </button>
        }
      />
    );
  }

  if (!hasClasses) {
    return (
      <StatePanel
        tone="empty"
        title="当前没有可配置的班级"
        description="创建班级或加入教学关系后，这里会自动出现可用的通知规则配置。"
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <TeacherNotificationHeader {...headerProps} />

      <NotificationExecutionLoopCard {...executionLoopCardProps} />

      {loadError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${loadError}`}
          action={
            <button className="button secondary" type="button" onClick={reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      {actionError ? (
        <StatePanel compact tone="error" title="本次操作失败" description={actionError} />
      ) : null}

      {message ? <StatePanel compact tone="success" title="执行成功" description={message} /> : null}

      {!isPreviewCurrent && classId ? (
        <StatePanel
          compact
          tone="info"
          title="当前草稿尚未刷新到预览"
          description="你已经修改了提醒窗口或家长抄送设置。先刷新预览，确认最新草稿会覆盖哪些作业和学生，再决定是否发送。"
        />
      ) : null}

      <div className="teacher-notification-top-grid">
        <TeacherNotificationConfigCard {...configCardProps} />

        <TeacherNotificationCommandCard {...commandCardProps} />
      </div>

      <TeacherNotificationPreviewCard {...previewCardProps} />

      <TeacherNotificationHistoryCard {...historyCardProps} />
    </div>
  );
}
