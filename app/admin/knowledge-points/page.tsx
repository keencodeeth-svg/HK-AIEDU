"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import KnowledgePointsListPanel from "./_components/KnowledgePointsListPanel";
import KnowledgePointsToolsPanel from "./_components/KnowledgePointsToolsPanel";
import { useAdminKnowledgePointsPageView } from "./useAdminKnowledgePointsPageView";

export default function KnowledgePointsAdminPage() {
  const knowledgePointsPage = useAdminKnowledgePointsPageView();

  if (knowledgePointsPage.authRequired) {
    return (
      <Card title="知识点管理">
        <StatePanel
          compact
          tone="info"
          title="请先登录后进入管理端"
          description="登录管理员账号后即可继续批量生成、导入和维护知识点。"
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
          <h2>知识点管理</h2>
          <div className="section-sub">批量生成、AI 生成与知识点维护。</div>
        </div>
        <span className="chip">管理端</span>
      </div>

      <div className="cta-row" style={{ marginTop: 0 }}>
        <button
          className={knowledgePointsPage.workspace === "list" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => knowledgePointsPage.setWorkspace("list")}
        >
          列表与分类
        </button>
        <button
          className={knowledgePointsPage.workspace === "tools" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => knowledgePointsPage.setWorkspace("tools")}
        >
          生成与维护
        </button>
      </div>

      {knowledgePointsPage.loadError ? <div className="status-note error">{knowledgePointsPage.loadError}</div> : null}
      {knowledgePointsPage.pageActionError ? <div className="status-note error">{knowledgePointsPage.pageActionError}</div> : null}

      {knowledgePointsPage.workspace === "tools" ? (
        <KnowledgePointsToolsPanel {...knowledgePointsPage.toolsPanelProps} />
      ) : null}

      {knowledgePointsPage.workspace === "list" ? (
        <KnowledgePointsListPanel {...knowledgePointsPage.listPanelProps} />
      ) : null}
      {knowledgePointsPage.stepUpDialog}
    </div>
  );
}
