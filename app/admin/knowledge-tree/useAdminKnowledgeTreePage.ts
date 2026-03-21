"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import type { KnowledgePoint, KnowledgePointListPayload, KnowledgeTree } from "./types";

async function loadAllKnowledgePoints() {
  const firstPage = await requestJson<KnowledgePointListPayload>(
    "/api/admin/knowledge-points?page=1&pageSize=200"
  );
  const totalPages = Math.max(1, Number(firstPage.meta?.totalPages ?? 1));
  if (totalPages === 1) {
    return firstPage.data ?? [];
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      requestJson<KnowledgePointListPayload>(
        `/api/admin/knowledge-points?page=${index + 2}&pageSize=200`
      )
    )
  );

  return [
    ...(firstPage.data ?? []),
    ...remainingPages.flatMap((payload) => payload.data ?? [])
  ];
}

export function useAdminKnowledgeTreePage() {
  const requestIdRef = useRef(0);
  const [list, setList] = useState<KnowledgePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const loadKnowledgePoints = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const payload = await loadAllKnowledgePoints();
      if (requestId !== requestIdRef.current) return;
      setAuthRequired(false);
      setList(payload);
    } catch (nextError) {
      if (requestId !== requestIdRef.current) return;
      setList([]);
      if (isAuthError(nextError)) {
        setAuthRequired(true);
      }
      setError(getRequestErrorMessage(nextError, "知识点加载失败"));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadKnowledgePoints();
  }, [loadKnowledgePoints]);

  const tree = useMemo(() => {
    return list.reduce((acc, kp) => {
      const unit = kp.unit ?? "未分单元";
      if (!acc[kp.subject]) acc[kp.subject] = {};
      if (!acc[kp.subject][kp.grade]) acc[kp.subject][kp.grade] = {};
      if (!acc[kp.subject][kp.grade][unit]) acc[kp.subject][kp.grade][unit] = {};
      if (!acc[kp.subject][kp.grade][unit][kp.chapter]) acc[kp.subject][kp.grade][unit][kp.chapter] = [];
      acc[kp.subject][kp.grade][unit][kp.chapter].push(kp);
      return acc;
    }, {} as KnowledgeTree);
  }, [list]);

  return {
    list,
    tree,
    loading,
    error,
    authRequired,
    loadKnowledgePoints
  };
}
