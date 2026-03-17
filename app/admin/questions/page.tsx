"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import QuestionsListPanel from "./_components/QuestionsListPanel";
import QuestionsToolsPanel from "./_components/QuestionsToolsPanel";
import { useAdminQuestionsPageView } from "./useAdminQuestionsPageView";

export default function QuestionsAdminPage() {
  const questionsPage = useAdminQuestionsPageView();

  if (questionsPage.authRequired) {
    return (
      <Card title="题库管理">
        <StatePanel
          compact
          tone="info"
          title="请先登录后进入管理端"
          description="登录管理员账号后即可继续导入题目、执行 AI 出题和维护题库。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid">
      <div className="section-head">
        <div>
          <h2>题库管理</h2>
          <div className="section-sub">CSV 导入、AI 出题与题库维护。</div>
        </div>
        <span className="chip">管理端</span>
      </div>

      <div className="cta-row questions-workspace-switch">
        <button
          className={questionsPage.workspace === "list" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => questionsPage.setWorkspace("list")}
        >
          列表与分类
        </button>
        <button
          className={questionsPage.workspace === "tools" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => questionsPage.setWorkspace("tools")}
        >
          导入/生成/新增
        </button>
      </div>

      {questionsPage.loadError ? <div className="status-note error">{questionsPage.loadError}</div> : null}
      {questionsPage.pageActionError ? <div className="status-note error">{questionsPage.pageActionError}</div> : null}

      {questionsPage.workspace === "tools" ? (
        <QuestionsToolsPanel {...questionsPage.toolsPanelProps} />
      ) : null}

      {questionsPage.workspace === "list" ? (
        <QuestionsListPanel {...questionsPage.listPanelProps} />
      ) : null}
      {questionsPage.stepUpDialog}
    </div>
  );
}
