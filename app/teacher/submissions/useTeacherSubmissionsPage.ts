"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";
import type {
  SubmissionClassItem,
  SubmissionRow,
  SubmissionStatusFilter
} from "./types";
import {
  getTeacherSubmissionsRequestMessage,
  resolveTeacherSubmissionsClassId
} from "./utils";

type TeacherSubmissionsResponse = {
  data?: SubmissionRow[];
  classes?: SubmissionClassItem[];
};

export function useTeacherSubmissionsPage() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [classes, setClasses] = useState<SubmissionClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState<SubmissionStatusFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageReady, setPageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const hasSnapshotRef = useRef(false);
  const now = Date.now();

  const load = useCallback(
    async (nextClassId: string, mode: "initial" | "refresh" = "initial") => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setPageError(null);
      setError(null);

      try {
        const query = new URLSearchParams();
        if (nextClassId) query.set("classId", nextClassId);
        const payload = await requestJson<TeacherSubmissionsResponse>(
          `/api/teacher/submissions?${query.toString()}`
        );

        if (requestIdRef.current !== requestId) {
          return;
        }

        const nextRows = Array.isArray(payload.data) ? payload.data : [];
        const nextClasses = Array.isArray(payload.classes) ? payload.classes : [];
        const nextSelectedClassId = resolveTeacherSubmissionsClassId(nextClasses, nextClassId);

        setRows(nextRows);
        setClasses(nextClasses);
        setClassId(nextSelectedClassId);
        setLastLoadedAt(new Date().toISOString());
        setAuthRequired(false);
        setPageReady(true);
        hasSnapshotRef.current = true;
      } catch (nextError) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        if (isAuthError(nextError)) {
          setAuthRequired(true);
          setRows([]);
          setClasses([]);
          setClassId("");
          return;
        }

        const nextMessage = getTeacherSubmissionsRequestMessage(nextError, "加载提交箱失败");

        if (hasSnapshotRef.current) {
          setError(nextMessage);
          return;
        }

        setPageError(nextMessage);
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void load(classId);
  }, [classId, load]);

  const filtered = useMemo(() => {
    const keywordLower = keyword.trim().toLowerCase();
    let list = rows;

    if (status !== "all") {
      list = list.filter((row) => row.status === status);
    }

    if (keywordLower) {
      list = list.filter((row) =>
        [
          row.studentName,
          row.studentEmail,
          row.assignmentTitle,
          row.className,
          SUBJECT_LABELS[row.subject] ?? row.subject,
          row.grade
        ]
          .join(" ")
          .toLowerCase()
          .includes(keywordLower)
      );
    }

    return list.slice().sort((left, right) => {
      const statusRank = { overdue: 0, pending: 1, completed: 2 } as const;
      const leftRank = statusRank[left.status as keyof typeof statusRank] ?? 3;
      const rightRank = statusRank[right.status as keyof typeof statusRank] ?? 3;
      if (leftRank !== rightRank) return leftRank - rightRank;
      if (left.status === "completed" && right.status === "completed") {
        const leftTs = new Date(left.submittedAt ?? left.completedAt ?? "").getTime();
        const rightTs = new Date(right.submittedAt ?? right.completedAt ?? "").getTime();
        return rightTs - leftTs;
      }
      return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    });
  }, [keyword, rows, status]);

  const overallSummary = useMemo(
    () => ({
      total: rows.length,
      completed: rows.filter((row) => row.status === "completed").length,
      pending: rows.filter((row) => row.status === "pending").length,
      overdue: rows.filter((row) => row.status === "overdue").length
    }),
    [rows]
  );

  const filteredSummary = useMemo(
    () => ({
      total: filtered.length,
      completed: filtered.filter((row) => row.status === "completed").length,
      pending: filtered.filter((row) => row.status === "pending").length,
      overdue: filtered.filter((row) => row.status === "overdue").length
    }),
    [filtered]
  );

  const hasActiveFilters = Boolean(classId || status !== "all" || keyword.trim());
  const selectedClass = classes.find((item) => item.id === classId);
  const recentSubmittedCount = useMemo(
    () =>
      rows.filter((row) => {
        const ts = new Date(row.submittedAt ?? row.completedAt ?? "").getTime();
        return row.status === "completed" && Number.isFinite(ts) && ts >= now - 24 * 60 * 60 * 1000;
      }).length,
    [now, rows]
  );
  const uniqueAssignmentCount = useMemo(
    () => new Set(rows.map((row) => row.assignmentId)).size,
    [rows]
  );

  const clearFilters = useCallback(() => {
    setClassId("");
    setStatus("all");
    setKeyword("");
  }, []);

  return {
    rows,
    classes,
    classId,
    status,
    keyword,
    loading,
    refreshing,
    authRequired,
    pageError,
    pageReady,
    error,
    lastLoadedAt,
    now,
    filtered,
    overallSummary,
    filteredSummary,
    hasActiveFilters,
    selectedClass,
    recentSubmittedCount,
    uniqueAssignmentCount,
    setClassId,
    setStatus,
    setKeyword,
    clearFilters,
    load
  };
}
