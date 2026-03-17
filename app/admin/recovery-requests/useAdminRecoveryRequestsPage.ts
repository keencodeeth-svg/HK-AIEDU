"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import {
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  RecoveryActionResponse,
  RecoveryFilterStatus,
  RecoveryItem,
  RecoveryListResponse,
  RecoveryStatus,
  RecoverySummary
} from "./types";

export function useAdminRecoveryRequestsPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [summary, setSummary] = useState<RecoverySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RecoveryFilterStatus>("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actingStatus, setActingStatus] = useState<RecoveryStatus | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setPageError(null);
      setAuthRequired(false);

      try {
        const params = new URLSearchParams();
        params.set("limit", "50");
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (appliedQuery.trim()) {
          params.set("query", appliedQuery.trim());
        }

        const payload = await requestJson<RecoveryListResponse>(
          `/api/admin/recovery-requests?${params.toString()}`
        );
        const nextItems = payload.data?.items ?? [];
        setItems(nextItems);
        setSummary(payload.data?.summary ?? null);
        setSelectedId((current) => {
          if (current && nextItems.some((item) => item.id === current)) {
            return current;
          }
          return nextItems[0]?.id ?? null;
        });
        setLastLoadedAt(new Date().toISOString());
      } catch (error) {
        setAuthRequired(isAuthError(error));
        setPageError(getRequestErrorMessage(error, "加载恢复工单失败"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedQuery, statusFilter]
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );

  useEffect(() => {
    setActionMessage(null);
    setActionError(null);
    setActionNote(selectedItem?.adminNote ?? "");
  }, [selectedItem?.adminNote, selectedItem?.id]);

  const performAction = useCallback(
    async (nextStatus: RecoveryStatus) => {
      if (!selectedItem) return;
      const requiresConfirmation =
        nextStatus === "resolved" || nextStatus === "rejected";
      if (requiresConfirmation) {
        const label =
          nextStatus === "resolved" ? "标记为已解决" : "标记为无法核验";
        const confirmed = window.confirm(
          `确认要将该恢复工单${label}吗？此操作会写入管理员处理记录。`
        );
        if (!confirmed) {
          return;
        }
      }
      setActingStatus(nextStatus);
      setActionMessage(null);
      setActionError(null);

      try {
        await runWithStepUp(
          async () => {
            const payload = await requestJson<RecoveryActionResponse>(
              `/api/admin/recovery-requests/${selectedItem.id}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  status: nextStatus,
                  adminNote: actionNote,
                  confirmAction: requiresConfirmation || undefined
                })
              }
            );
            setActionMessage(payload.message ?? "恢复工单已更新");
            await load("refresh");
          },
          (error) => {
            setActionError(getRequestErrorMessage(error, "更新恢复工单失败"));
          }
        );
      } finally {
        setActingStatus(null);
      }
    },
    [actionNote, load, runWithStepUp, selectedItem]
  );

  const applySearch = useCallback(() => {
    setAppliedQuery(searchInput.trim());
  }, [searchInput]);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setAppliedQuery("");
    setStatusFilter("all");
  }, []);

  return {
    items,
    summary,
    loading,
    refreshing,
    pageError,
    authRequired,
    lastLoadedAt,
    statusFilter,
    searchInput,
    appliedQuery,
    selectedItem,
    actingStatus,
    actionNote,
    actionMessage,
    actionError,
    setStatusFilter,
    setSearchInput,
    setSelectedId,
    setActionNote,
    load,
    performAction,
    applySearch,
    clearFilters,
    stepUpDialog
  };
}
