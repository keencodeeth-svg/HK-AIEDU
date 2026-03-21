"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import WrongBookHistoryCard from "./_components/WrongBookHistoryCard";
import WrongBookReviewQueueCard from "./_components/WrongBookReviewQueueCard";
import WrongBookTaskGeneratorCard from "./_components/WrongBookTaskGeneratorCard";
import WrongBookTasksCard from "./_components/WrongBookTasksCard";
import { useWrongBookPage } from "./useWrongBookPage";

export default function WrongBookPage() {
  const wrongBookPage = useWrongBookPage();

  if (wrongBookPage.loading && !wrongBookPage.hasContent && !wrongBookPage.authRequired) {
    return <StatePanel title="错题闭环加载中" description="正在同步错题本、订正任务和今日复练队列。" tone="loading" />;
  }

  if (wrongBookPage.authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可查看错题本、订正任务与统一复练队列。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (wrongBookPage.pageError && !wrongBookPage.hasContent) {
    return (
      <StatePanel
        title="错题闭环加载失败"
        description={wrongBookPage.pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void wrongBookPage.load()}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>错题与订正</h2>
          <div className="section-sub">错题复盘 + 间隔复练 + 订正计划。</div>
        </div>
        <div className="cta-row no-margin" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="chip">错题闭环</span>
          {wrongBookPage.lastLoadedAtLabel ? <span className="chip">更新于 {wrongBookPage.lastLoadedAtLabel}</span> : null}
          <button className="button secondary" type="button" onClick={() => void wrongBookPage.load("refresh")} disabled={wrongBookPage.loading || wrongBookPage.refreshing || wrongBookPage.actionBusy}>
            {wrongBookPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {wrongBookPage.pageError ? (
        <StatePanel
          title="已展示最近一次成功数据"
          description={`最新同步失败：${wrongBookPage.pageError}`}
          tone="error"
          compact
        />
      ) : null}

      {wrongBookPage.actionError ? <div className="status-note error">{wrongBookPage.actionError}</div> : null}
      {wrongBookPage.actionMessage ? <div className="status-note success">{wrongBookPage.actionMessage}</div> : null}

      <WrongBookReviewQueueCard
        reviewQueue={wrongBookPage.reviewQueue}
        reviewAnswers={wrongBookPage.reviewAnswers}
        reviewSubmitting={wrongBookPage.reviewSubmitting}
        reviewMessages={wrongBookPage.reviewMessages}
        onReviewAnswerChange={wrongBookPage.handleReviewAnswerChange}
        onSubmitReview={wrongBookPage.submitReview}
      />

      <WrongBookTasksCard
        summary={wrongBookPage.summary}
        tasks={wrongBookPage.tasks}
        completingTaskIds={wrongBookPage.completingTaskIds}
        onCompleteTask={wrongBookPage.handleComplete}
      />

      <WrongBookTaskGeneratorCard
        dueDate={wrongBookPage.dueDate}
        list={wrongBookPage.list}
        selected={wrongBookPage.selected}
        message={wrongBookPage.taskGeneratorMessage}
        errors={wrongBookPage.taskGeneratorErrors}
        submitting={wrongBookPage.creatingTasks}
        onDueDateChange={wrongBookPage.updateDueDate}
        onToggleSelect={wrongBookPage.toggleSelect}
        onCreateTasks={wrongBookPage.handleCreateTasks}
      />

      <WrongBookHistoryCard list={wrongBookPage.list} />
    </div>
  );
}
