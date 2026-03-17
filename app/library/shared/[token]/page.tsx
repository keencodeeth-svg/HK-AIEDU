"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/Card";
import LibraryReader from "@/components/LibraryReader";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import { getRequestErrorMessage, getRequestStatus, requestJson } from "@/lib/client-request";
import type { LibraryDetailItem, LibraryDetailResponse } from "../../types";

export default function SharedLibraryPage({ params }: { params: { token: string } }) {
  const [item, setItem] = useState<LibraryDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadSharedItem = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
      setItem(null);
    }
    setPageError(null);

    try {
      const payload = await requestJson<LibraryDetailResponse>(`/api/library/shared/${params.token}`);
      setItem(payload.data ?? null);
    } catch (error) {
      if (mode !== "refresh") {
        setItem(null);
      }
      if (getRequestStatus(error) === 404) {
        setPageError("分享内容不存在或已失效。");
      } else {
        setPageError(getRequestErrorMessage(error, "加载分享内容失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.token]);

  useEffect(() => {
    void loadSharedItem();
  }, [loadSharedItem]);

  if (loading && !item) {
    return <StatePanel title="分享阅读加载中" description="正在同步分享资料内容。" tone="loading" />;
  }

  if (pageError && !item) {
    return (
      <StatePanel
        title="分享阅读加载失败"
        description={pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void loadSharedItem()}>
            重新加载
          </button>
        }
      />
    );
  }

  if (!item) {
    return (
      <StatePanel
        title="分享阅读暂时不可用"
        description="当前未能读取分享内容，请稍后再试。"
        tone="empty"
        action={
          <button className="button secondary" type="button" onClick={() => void loadSharedItem()}>
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
          <h2>{item.title}</h2>
          <div className="section-sub">
            {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
          </div>
        </div>
        <div className="cta-row no-margin" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="chip">分享</span>
          <button className="button secondary" type="button" onClick={() => void loadSharedItem("refresh")} disabled={loading || refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {pageError ? <StatePanel title="本次刷新存在异常" description={pageError} tone="error" compact /> : null}

      <Card title="内容" tag="只读">
        <LibraryReader item={item} />
      </Card>
    </div>
  );
}
