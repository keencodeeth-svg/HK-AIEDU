"use client";

import { useCallback, useEffect, useState } from "react";
import { getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import type { AdminLog } from "@/lib/admin-log";

export function useAdminLogsPage() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [actionInput, setActionInput] = useState("");
  const [entityTypeInput, setEntityTypeInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedAction, setAppliedAction] = useState("");
  const [appliedEntityType, setAppliedEntityType] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

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
        params.set("limit", "100");
        if (appliedAction.trim()) {
          params.set("action", appliedAction.trim());
        }
        if (appliedEntityType.trim()) {
          params.set("entityType", appliedEntityType.trim());
        }
        if (appliedQuery.trim()) {
          params.set("query", appliedQuery.trim());
        }

        const payload = await requestJson<{ data?: AdminLog[] }>(`/api/admin/logs?${params.toString()}`);
        setLogs(payload.data ?? []);
        setLastLoadedAt(new Date().toISOString());
      } catch (error) {
        setAuthRequired(isAuthError(error));
        setPageError(getRequestErrorMessage(error, "加载管理日志失败"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedAction, appliedEntityType, appliedQuery]
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  const applyFilters = useCallback(() => {
    setAppliedAction(actionInput);
    setAppliedEntityType(entityTypeInput);
    setAppliedQuery(searchInput);
  }, [actionInput, entityTypeInput, searchInput]);

  const clearFilters = useCallback(() => {
    setActionInput("");
    setEntityTypeInput("");
    setSearchInput("");
    setAppliedAction("");
    setAppliedEntityType("");
    setAppliedQuery("");
  }, []);

  return {
    logs,
    loading,
    refreshing,
    pageError,
    authRequired,
    lastLoadedAt,
    actionInput,
    entityTypeInput,
    searchInput,
    setActionInput,
    setEntityTypeInput,
    setSearchInput,
    load,
    applyFilters,
    clearFilters
  };
}
