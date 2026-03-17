"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  StudentAssignmentItem,
  StudentAssignmentStatusFilter,
  StudentAssignmentViewMode
} from "./types";
import {
  buildStudentAssignmentActiveFilterSummary,
  buildStudentAssignmentSubjectOptions,
  countCompletedAssignments,
  countDueSoonAssignments,
  countOverdueAssignments,
  countPendingAssignments,
  filterStudentAssignments,
  findPriorityAssignment,
  getStudentAssignmentsRequestMessage,
  isMissingStudentAssignmentsClassError,
  resolveStudentAssignmentsSubjectFilter
} from "./utils";

type StudentAssignmentsResponse = {
  data?: StudentAssignmentItem[];
  error?: string;
};

export function useStudentAssignmentsPage() {
  const loadRequestIdRef = useRef(0);
  const hasAssignmentsSnapshotRef = useRef(false);
  const [assignments, setAssignments] = useState<StudentAssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StudentAssignmentStatusFilter>("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [viewMode, setViewMode] = useState<StudentAssignmentViewMode>("compact");
  const [keyword, setKeyword] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearAssignmentsState = useCallback(() => {
    hasAssignmentsSnapshotRef.current = false;
    setAssignments([]);
    setError(null);
    setLastLoadedAt(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearAssignmentsState();
    setAuthRequired(true);
  }, [clearAssignmentsState]);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    const isRefresh = mode === "refresh";
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const payload = await requestJson<StudentAssignmentsResponse>("/api/student/assignments");
      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      const nextAssignments = Array.isArray(payload.data) ? payload.data : [];
      const nextSubjectFilter = resolveStudentAssignmentsSubjectFilter(nextAssignments, subjectFilter);

      setAuthRequired(false);
      hasAssignmentsSnapshotRef.current = true;
      setAssignments(nextAssignments);
      if (nextSubjectFilter !== subjectFilter) {
        setSubjectFilter(nextSubjectFilter);
        setShowAll(false);
      }
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        if (!hasAssignmentsSnapshotRef.current || isMissingStudentAssignmentsClassError(nextError)) {
          clearAssignmentsState();
        }
        setAuthRequired(false);
        setError(getStudentAssignmentsRequestMessage(nextError, "加载失败"));
      }
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [clearAssignmentsState, handleAuthRequired, subjectFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const subjectOptions = useMemo(() => buildStudentAssignmentSubjectOptions(assignments), [assignments]);
  const filteredAssignments = useMemo(
    () =>
      filterStudentAssignments(assignments, {
        statusFilter,
        subjectFilter,
        keyword
      }),
    [assignments, keyword, statusFilter, subjectFilter]
  );
  const visibleAssignments = useMemo(
    () => (showAll ? filteredAssignments : filteredAssignments.slice(0, 10)),
    [filteredAssignments, showAll]
  );

  const pendingCount = useMemo(() => countPendingAssignments(assignments), [assignments]);
  const completedCount = useMemo(() => countCompletedAssignments(assignments), [assignments]);
  const overdueCount = useMemo(() => countOverdueAssignments(assignments), [assignments]);
  const dueSoonCount = useMemo(() => countDueSoonAssignments(assignments), [assignments]);
  const priorityAssignment = useMemo(() => findPriorityAssignment(assignments), [assignments]);
  const activeFilterSummary = useMemo(
    () =>
      buildStudentAssignmentActiveFilterSummary({
        statusFilter,
        subjectFilter,
        viewMode,
        keyword
      }),
    [keyword, statusFilter, subjectFilter, viewMode]
  );
  const hasActiveFilters = statusFilter !== "all" || subjectFilter !== "all" || keyword.trim().length > 0;

  const handleStatusFilterChange = useCallback((value: StudentAssignmentStatusFilter) => {
    setStatusFilter(value);
    setShowAll(false);
  }, []);

  const handleSubjectFilterChange = useCallback((value: string) => {
    setSubjectFilter(value);
    setShowAll(false);
  }, []);

  const handleViewModeChange = useCallback((value: StudentAssignmentViewMode) => {
    setViewMode(value);
  }, []);

  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value);
    setShowAll(false);
  }, []);

  const handleClearFilters = useCallback(() => {
    setStatusFilter("all");
    setSubjectFilter("all");
    setKeyword("");
    setShowAll(false);
  }, []);

  return {
    assignments,
    loading,
    refreshing,
    error,
    authRequired,
    statusFilter,
    subjectFilter,
    viewMode,
    keyword,
    showAll,
    lastLoadedAt,
    subjectOptions,
    filteredAssignments,
    visibleAssignments,
    pendingCount,
    completedCount,
    overdueCount,
    dueSoonCount,
    priorityAssignment,
    activeFilterSummary,
    hasActiveFilters,
    load,
    handleStatusFilterChange,
    handleSubjectFilterChange,
    handleViewModeChange,
    handleKeywordChange,
    handleClearFilters,
    toggleShowAll: () => {
      setShowAll((current) => !current);
    }
  };
}
