"use client";

import Card from "@/components/Card";
import LibraryReader from "@/components/LibraryReader";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useSharedLibraryPage } from "./useSharedLibraryPage";

export default function SharedLibraryPage({ params }: { params: { token: string } }) {
  const sharedLibraryPage = useSharedLibraryPage(params.token);

  if (sharedLibraryPage.loading && !sharedLibraryPage.item) {
    return <StatePanel title="分享阅读加载中" description="正在同步分享资料内容。" tone="loading" />;
  }

  if (sharedLibraryPage.pageError && !sharedLibraryPage.item) {
    return (
      <StatePanel
        title="分享阅读加载失败"
        description={sharedLibraryPage.pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void sharedLibraryPage.loadSharedItem()}>
            重新加载
          </button>
        }
      />
    );
  }

  if (!sharedLibraryPage.item) {
    return (
      <StatePanel
        title="分享阅读暂时不可用"
        description="当前未能读取分享内容，请稍后再试。"
        tone="empty"
        action={
          <button className="button secondary" type="button" onClick={() => void sharedLibraryPage.loadSharedItem()}>
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
          <h2>{sharedLibraryPage.item.title}</h2>
          <div className="section-sub">
            {SUBJECT_LABELS[sharedLibraryPage.item.subject] ?? sharedLibraryPage.item.subject} · {sharedLibraryPage.item.grade} 年级
          </div>
        </div>
        <div className="cta-row no-margin" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="chip">分享</span>
          <button
            className="button secondary"
            type="button"
            onClick={() => void sharedLibraryPage.loadSharedItem("refresh")}
            disabled={sharedLibraryPage.loading || sharedLibraryPage.refreshing}
          >
            {sharedLibraryPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {sharedLibraryPage.pageError ? (
        <StatePanel title="本次刷新存在异常" description={sharedLibraryPage.pageError} tone="error" compact />
      ) : null}

      <Card title="内容" tag="只读">
        <LibraryReader item={sharedLibraryPage.item} />
      </Card>
    </div>
  );
}
