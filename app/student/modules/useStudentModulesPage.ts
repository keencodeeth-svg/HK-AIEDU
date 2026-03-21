"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatLoadedTime, isAuthError, requestJson } from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { StudentClassModules, StudentModule, StudentModulesResponse } from "./types";
import { getStudentModulesRequestMessage, resolveStudentModulesSubjectFilter } from "./utils";

export function useStudentModulesPage() {
  const requestIdRef = useRef(0);
  const hasSnapshotRef = useRef(false);
  const [data, setData] = useState<StudentClassModules[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"compact" | "detailed">("compact");
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [expandedClassIds, setExpandedClassIds] = useState<Record<string, boolean>>({});

  const clearModulesState = useCallback(() => {
    hasSnapshotRef.current = false;
    setData([]);
    setLastLoadedAt(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearModulesState();
    setPageError(null);
    setAuthRequired(true);
  }, [clearModulesState]);

  const loadModules = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
        if (!hasSnapshotRef.current) {
          setData([]);
        }
      }
      setPageError(null);

      try {
        const payload = await requestJson<StudentModulesResponse>("/api/student/modules");
        if (requestId !== requestIdRef.current) {
          return;
        }
        const nextData = payload.data ?? [];
        hasSnapshotRef.current = true;
        setData(nextData);
        setAuthRequired(false);
        setSubjectFilter((prev) => resolveStudentModulesSubjectFilter(nextData, prev));
        setLastLoadedAt(new Date().toISOString());
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (isAuthError(error)) {
          handleAuthRequired();
        } else {
          if (!hasSnapshotRef.current) {
            clearModulesState();
          }
          setAuthRequired(false);
          setPageError(getStudentModulesRequestMessage(error, "加载课程模块失败"));
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [clearModulesState, handleAuthRequired]
  );

  useEffect(() => {
    void loadModules();
  }, [loadModules]);

  const subjectOptions = useMemo(() => {
    return Array.from(new Set(data.map((klass) => klass.subject))).sort((a, b) =>
      (SUBJECT_LABELS[a] ?? a).localeCompare(SUBJECT_LABELS[b] ?? b, "zh-CN")
    );
  }, [data]);

  const filteredClasses = useMemo(() => {
    return data
      .filter((klass) => (subjectFilter === "all" ? true : klass.subject === subjectFilter))
      .sort((a, b) => a.className.localeCompare(b.className, "zh-CN"));
  }, [data, subjectFilter]);

  const visibleClasses = useMemo(
    () => (showAllClasses ? filteredClasses : filteredClasses.slice(0, 5)),
    [filteredClasses, showAllClasses]
  );

  const totalModules = useMemo(
    () => filteredClasses.reduce((sum, klass) => sum + klass.modules.length, 0),
    [filteredClasses]
  );
  const totalAssignments = useMemo(
    () =>
      filteredClasses.reduce(
        (sum, klass) =>
          sum + klass.modules.reduce((moduleSum, module) => moduleSum + (module.assignmentCount ?? 0), 0),
        0
      ),
    [filteredClasses]
  );
  const totalCompleted = useMemo(
    () =>
      filteredClasses.reduce(
        (sum, klass) =>
          sum + klass.modules.reduce((moduleSum, module) => moduleSum + (module.completedCount ?? 0), 0),
        0
      ),
    [filteredClasses]
  );

  const hasModulesData = data.length > 0;
  const lastLoadedAtLabel = lastLoadedAt ? formatLoadedTime(lastLoadedAt) : null;

  const toggleClass = useCallback((classId: string) => {
    setExpandedClassIds((prev) => ({ ...prev, [classId]: !prev[classId] }));
  }, []);

  const updateSubjectFilter = useCallback((value: string) => {
    setSubjectFilter(value);
    setShowAllClasses(false);
  }, []);

  const renderModuleCompact = useCallback((module: StudentModule) => {
    const progress = module.assignmentCount ? Math.round((module.completedCount / module.assignmentCount) * 100) : 0;
    return {
      progress,
      href: `/student/modules/${module.id}`
    };
  }, []);

  const renderModuleDetailed = useCallback((module: StudentModule) => {
    const progress = module.assignmentCount ? Math.round((module.completedCount / module.assignmentCount) * 100) : 0;
    return {
      progress,
      href: `/student/modules/${module.id}`
    };
  }, []);

  return {
    data,
    loading,
    refreshing,
    pageError,
    authRequired,
    lastLoadedAt,
    lastLoadedAtLabel,
    subjectFilter,
    viewMode,
    showAllClasses,
    expandedClassIds,
    subjectOptions,
    filteredClasses,
    visibleClasses,
    totalModules,
    totalAssignments,
    totalCompleted,
    hasModulesData,
    setViewMode,
    setShowAllClasses,
    updateSubjectFilter,
    toggleClass,
    loadModules,
    renderModuleCompact,
    renderModuleDetailed
  };
}
