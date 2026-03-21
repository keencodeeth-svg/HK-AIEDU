"use client";

import { useCallback, useEffect, useState } from "react";
import { getRequestErrorMessage, getRequestStatus, requestJson } from "@/lib/client-request";
import type { LibraryDetailItem, LibraryDetailResponse } from "../../types";

export function useSharedLibraryPage(token: string) {
  const [item, setItem] = useState<LibraryDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadSharedItem = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
        setItem(null);
      }
      setPageError(null);

      try {
        const payload = await requestJson<LibraryDetailResponse>(`/api/library/shared/${token}`);
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
    },
    [token]
  );

  useEffect(() => {
    void loadSharedItem();
  }, [loadSharedItem]);

  return {
    item,
    loading,
    refreshing,
    pageError,
    loadSharedItem
  };
}
