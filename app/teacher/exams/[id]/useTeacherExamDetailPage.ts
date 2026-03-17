"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import { useMathViewSettings } from "@/lib/math-view-settings";
import type { ExamDetail } from "./types";
import {
  getTeacherExamDetailRequestMessage,
  isMissingTeacherExamDetailError
} from "./utils";

function formatLoadedTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getDueRelativeLabel(endAt: string, now: number) {
  const diffMs = new Date(endAt).getTime() - now;
  const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (diffHours < 0) return `已结束 ${Math.abs(diffHours)} 小时`;
  if (diffHours <= 1) return "1 小时内结束";
  if (diffHours < 24) return `${diffHours} 小时后结束`;
  return `${Math.ceil(diffHours / 24)} 天后结束`;
}

export function useTeacherExamDetailPage(id: string) {
  const requestIdRef = useRef(0);
  const hasSnapshotRef = useRef(false);

  const [data, setData] = useState<ExamDetail | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [publishingReviewPack, setPublishingReviewPack] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const mathView = useMathViewSettings("teacher-exam-detail");
  const now = Date.now();

  const clearExamDetailState = useCallback(() => {
    hasSnapshotRef.current = false;
    setData(null);
    setLastLoadedAt(null);
    setPublishMessage(null);
    setPublishError(null);
    setStatusError(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearExamDetailState();
    setLoadError(null);
    setAuthRequired(true);
  }, [clearExamDetailState]);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
        if (!hasSnapshotRef.current) {
          setData(null);
        }
      }
      setLoadError(null);

      try {
        const payload = await requestJson<ExamDetail>(`/api/teacher/exams/${id}`);
        if (requestId !== requestIdRef.current) {
          return;
        }
        hasSnapshotRef.current = true;
        setAuthRequired(false);
        setData(payload);
        setLastLoadedAt(new Date().toISOString());
      } catch (nextError) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }

        const nextMessage = getTeacherExamDetailRequestMessage(nextError, "加载失败");
        if (isMissingTeacherExamDetailError(nextError) || !hasSnapshotRef.current) {
          clearExamDetailState();
        }
        setLoadError(nextMessage);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [clearExamDetailState, handleAuthRequired, id]
  );

  const handleStatusAction = useCallback(
    async (action: "close" | "reopen") => {
      if (!data || updatingStatus) return;
      setUpdatingStatus(true);
      setStatusError(null);

      try {
        const payload = await requestJson<{ data?: { status?: ExamDetail["exam"]["status"] } }>(`/api/teacher/exams/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action })
        });
        setAuthRequired(false);
        setData((prev) =>
          prev ? { ...prev, exam: { ...prev.exam, status: payload?.data?.status ?? prev.exam.status } } : prev
        );
        setLastLoadedAt(new Date().toISOString());
      } catch (nextError) {
        if (isAuthError(nextError)) {
          handleAuthRequired();
        } else if (isMissingTeacherExamDetailError(nextError)) {
          clearExamDetailState();
          setLoadError(getTeacherExamDetailRequestMessage(nextError, "加载失败"));
        } else {
          setStatusError(getTeacherExamDetailRequestMessage(nextError, "更新失败"));
        }
      } finally {
        setUpdatingStatus(false);
      }
    },
    [clearExamDetailState, data, handleAuthRequired, id, updatingStatus]
  );

  const handlePublishReviewPack = useCallback(
    async (dryRun: boolean) => {
      if (!data || publishingReviewPack) return;
      setPublishMessage(null);
      setPublishError(null);
      setPublishingReviewPack(true);

      try {
        const payload = await requestJson<{
          data?: {
            message?: string;
            publishedStudents?: number;
            targetedStudents?: number;
            skippedLowRisk?: number;
            skippedNoSubmission?: number;
          };
        }>(`/api/teacher/exams/${id}/review-pack/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            minRiskLevel: "high",
            includeParents: true,
            dryRun
          })
        });

        const result = payload?.data;
        const summary =
          result?.message ??
          (dryRun
            ? `预览完成：计划通知学生 ${result?.publishedStudents ?? 0} 人`
            : `发布完成：已通知学生 ${result?.publishedStudents ?? 0} 人`);
        const detail = `覆盖 ${result?.targetedStudents ?? 0} 人，跳过低风险 ${result?.skippedLowRisk ?? 0} 人，缺少提交 ${result?.skippedNoSubmission ?? 0} 人。`;
        setPublishMessage(`${summary} ${detail}`);
        setAuthRequired(false);
      } catch (nextError) {
        if (isAuthError(nextError)) {
          handleAuthRequired();
        } else if (isMissingTeacherExamDetailError(nextError)) {
          clearExamDetailState();
          setLoadError(getTeacherExamDetailRequestMessage(nextError, "加载失败"));
        } else {
          setPublishError(getTeacherExamDetailRequestMessage(nextError, "发布失败"));
        }
      } finally {
        setPublishingReviewPack(false);
      }
    },
    [clearExamDetailState, data, handleAuthRequired, id, publishingReviewPack]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const rankedStudents = useMemo(() => {
    if (!data?.students?.length) return [];
    return [...data.students].sort((a, b) => {
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
      if ((a.status === "submitted") !== (b.status === "submitted")) {
        return a.status === "submitted" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "zh-CN");
    });
  }, [data?.students]);

  const submittedRate = data?.summary.assigned
    ? Math.round((data.summary.submitted / data.summary.assigned) * 100)
    : 0;
  const topRiskStudent = rankedStudents[0] ?? null;
  const totalQuestionScore = data?.questions.reduce((sum, question) => sum + question.score, 0) ?? 0;
  const dueRelativeLabel = data ? getDueRelativeLabel(data.exam.endAt, now) : "";
  const lastLoadedAtLabel = formatLoadedTime(lastLoadedAt);

  return {
    data,
    authRequired,
    loadError,
    statusError,
    updatingStatus,
    publishingReviewPack,
    publishMessage,
    publishError,
    loading,
    refreshing,
    lastLoadedAt,
    lastLoadedAtLabel,
    mathView,
    now,
    rankedStudents,
    submittedRate,
    topRiskStudent,
    totalQuestionScore,
    dueRelativeLabel,
    load,
    handleStatusAction,
    handlePublishReviewPack
  };
}
