"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import LibraryAdminImportPanel from "./_components/LibraryAdminImportPanel";
import LibraryAiGeneratePanel from "./_components/LibraryAiGeneratePanel";
import LibraryBatchImportPanel from "./_components/LibraryBatchImportPanel";
import LibraryFiltersPanel from "./_components/LibraryFiltersPanel";
import LibraryListPanel from "./_components/LibraryListPanel";
import { useLibraryPageView } from "./useLibraryPageView";

export default function LibraryPage() {
  const libraryPage = useLibraryPageView();

  if (libraryPage.authRequired) {
    return (
      <Card title="教材与课件资料库">
        <StatePanel
          compact
          tone="info"
          title="请先登录后查看资料库"
          description="登录后即可查看资料列表、下载资源并继续教师或管理端操作。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (libraryPage.pageLoading) {
    return (
      <Card title="教材与课件资料库">
        <StatePanel
          compact
          tone="loading"
          title="资料库加载中"
          description="正在同步教材、课件、筛选维度和分页信息。"
        />
      </Card>
    );
  }

  if (libraryPage.pageError) {
    return (
      <Card title="教材与课件资料库">
        <StatePanel
          compact
          tone="error"
          title="资料库加载失败"
          description={libraryPage.pageError}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={libraryPage.reload}>
                重试
              </button>
              <Link className="button ghost" href="/">
                返回首页
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>教材与课件资料库</h2>
          <div className="section-sub">支持全局教材导入、AI 生成课件/教案、阅读与标注。</div>
        </div>
        <span className="chip">资料中心</span>
      </div>

      {libraryPage.userRole === "admin" ? <LibraryAdminImportPanel {...libraryPage.adminImportPanelProps} /> : null}

      {libraryPage.userRole === "admin" ? <LibraryBatchImportPanel {...libraryPage.batchImportPanelProps} /> : null}

      {libraryPage.userRole === "teacher" ? <LibraryAiGeneratePanel {...libraryPage.aiGeneratePanelProps} /> : null}

      {libraryPage.bootstrapNotice ? <div className="status-note error">{libraryPage.bootstrapNotice}</div> : null}
      {libraryPage.classesNotice ? <div className="status-note error">{libraryPage.classesNotice}</div> : null}
      {libraryPage.listNotice ? <div className="status-note error">{libraryPage.listNotice}</div> : null}
      {libraryPage.error ? <div className="status-note error">{libraryPage.error}</div> : null}
      {libraryPage.message ? <div className="status-note success">{libraryPage.message}</div> : null}
      {libraryPage.stepUpDialog}

      <LibraryFiltersPanel {...libraryPage.filtersPanelProps} />

      <LibraryListPanel {...libraryPage.listPanelProps} />
    </div>
  );
}
