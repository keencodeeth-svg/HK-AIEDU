"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatLoadedTime, isAuthError, requestJson } from "@/lib/client-request";
import type {
  StudentExamItem,
  StudentExamListResponse,
  StudentExamModuleTab,
  StudentSelfAssessmentTask,
  TodayTasksResponse
} from "./types";
import {
  buildSelfAssessmentSummary,
  filterSelfAssessmentTasks,
  getStudentExamListRequestMessage,
  getStudentSelfAssessmentRequestMessage,
  groupStudentExams
} from "./utils";

export function useStudentExamsPage() {
  const loadRequestIdRef = useRef(0);
  const hasExamSnapshotRef = useRef(false);
  const hasTodayTasksSnapshotRef = useRef(false);
  const [list, setList] = useState<StudentExamItem[]>([]);
  const [todayTasks, setTodayTasks] = useState<StudentSelfAssessmentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [examError, setExamError] = useState<string | null>(null);
  const [todayTasksError, setTodayTasksError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [moduleTab, setModuleTab] = useState<StudentExamModuleTab>("teacher_exam");
  const [showPastExams, setShowPastExams] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearExamPageState = useCallback(() => {
    hasExamSnapshotRef.current = false;
    hasTodayTasksSnapshotRef.current = false;
    setList([]);
    setTodayTasks([]);
    setPageError(null);
    setExamError(null);
    setTodayTasksError(null);
    setLastLoadedAt(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearExamPageState();
    setAuthRequired(true);
  }, [clearExamPageState]);

  const loadPage = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;

      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setPageError(null);
      setExamError(null);
      setTodayTasksError(null);

      try {
        const [examsResult, todayTasksResult] = await Promise.allSettled([
          requestJson<StudentExamListResponse>("/api/student/exams"),
          requestJson<TodayTasksResponse>("/api/student/today-tasks")
        ]);

        if (requestId !== loadRequestIdRef.current) {
          return;
        }

        const hasAuthFailure =
          (examsResult.status === "rejected" && isAuthError(examsResult.reason)) ||
          (todayTasksResult.status === "rejected" && isAuthError(todayTasksResult.reason));

        if (hasAuthFailure) {
          handleAuthRequired();
          return;
        }

        const nextErrors: string[] = [];
        let hasFreshData = false;

        if (examsResult.status === "fulfilled") {
          setList(examsResult.value.data ?? []);
          hasExamSnapshotRef.current = true;
          hasFreshData = true;
        } else {
          if (!hasExamSnapshotRef.current) {
            setList([]);
          }
          const nextExamError = getStudentExamListRequestMessage(examsResult.reason, "加载考试列表失败");
          setExamError(nextExamError);
          nextErrors.push(
            hasExamSnapshotRef.current
              ? `考试列表刷新失败，已展示最近一次成功数据：${nextExamError}`
              : nextExamError
          );
        }

        if (todayTasksResult.status === "fulfilled") {
          setTodayTasks(todayTasksResult.value.data?.tasks ?? []);
          hasTodayTasksSnapshotRef.current = true;
          hasFreshData = true;
        } else {
          if (!hasTodayTasksSnapshotRef.current) {
            setTodayTasks([]);
          }
          const nextTodayTasksError = getStudentSelfAssessmentRequestMessage(
            todayTasksResult.reason,
            "加载今日自主任务失败"
          );
          setTodayTasksError(nextTodayTasksError);
          nextErrors.push(
            hasTodayTasksSnapshotRef.current
              ? `自主测评任务刷新失败，已展示最近一次成功数据：${nextTodayTasksError}`
              : nextTodayTasksError
          );
        }

        setAuthRequired(false);
        if (hasFreshData) {
          setLastLoadedAt(new Date().toISOString());
        }
        setPageError(nextErrors.length ? nextErrors.join("；") : null);
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [handleAuthRequired]
  );

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (moduleTab !== "teacher_exam") {
      setShowPastExams(false);
    }
  }, [moduleTab]);

  const grouped = useMemo(() => groupStudentExams(list), [list]);
  const selfAssessmentTasks = useMemo(() => filterSelfAssessmentTasks(todayTasks), [todayTasks]);
  const visibleSelfAssessmentTasks = useMemo(() => selfAssessmentTasks.slice(0, 6), [selfAssessmentTasks]);
  const selfAssessmentSummary = useMemo(
    () => buildSelfAssessmentSummary(selfAssessmentTasks),
    [selfAssessmentTasks]
  );
  const examCount = list.length;
  const hasAnyData = Boolean(examCount || todayTasks.length);
  const hasFatalError = Boolean(examError && !list.length && todayTasksError && !todayTasks.length);
  const lastLoadedAtLabel = lastLoadedAt ? formatLoadedTime(lastLoadedAt) : null;

  return {
    loading,
    refreshing,
    pageError,
    examError,
    todayTasksError,
    authRequired,
    moduleTab,
    showPastExams,
    grouped,
    visibleSelfAssessmentTasks,
    selfAssessmentTasks,
    selfAssessmentSummary,
    examCount,
    hasAnyData,
    hasFatalError,
    lastLoadedAtLabel,
    loadPage,
    setModuleTab,
    setShowPastExams
  };
}
