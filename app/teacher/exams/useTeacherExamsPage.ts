"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import { SUBJECT_LABELS, getGradeLabel } from "@/lib/constants";
import type { TeacherExamItem, TeacherExamStatusFilter } from "./types";
import {
  buildClassOptions,
  getTeacherExamsRequestMessage,
  getAttentionScore,
  getSubmissionRate,
  resolveTeacherExamsClassFilter
} from "./utils";

type TeacherExamsResponse = {
  data?: TeacherExamItem[];
};

export function useTeacherExamsPage() {
  const [list, setList] = useState<TeacherExamItem[]>([]);
  const [classFilter, setClassFilter] = useState("");
  const [status, setStatus] = useState<TeacherExamStatusFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const now = Date.now();

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const payload = await requestJson<TeacherExamsResponse>("/api/teacher/exams");
      setAuthRequired(false);
      setList(Array.isArray(payload.data) ? payload.data : []);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        setError(null);
        setList([]);
        setClassFilter("");
        setLastLoadedAt(null);
        return;
      }

      setError(getTeacherExamsRequestMessage(nextError, "加载考试列表失败"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const classOptions = useMemo(() => buildClassOptions(list), [list]);

  useEffect(() => {
    const nextClassFilter = resolveTeacherExamsClassFilter(classFilter, classOptions);
    if (nextClassFilter !== classFilter) {
      setClassFilter(nextClassFilter);
    }
  }, [classFilter, classOptions]);

  const sortedList = useMemo(
    () =>
      list.slice().sort((left, right) => {
        if (left.status !== right.status) return left.status === "published" ? -1 : 1;
        if (left.status === "closed" && right.status === "closed") {
          return new Date(right.endAt).getTime() - new Date(left.endAt).getTime();
        }
        const scoreDiff = getAttentionScore(right, now) - getAttentionScore(left, now);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(left.endAt).getTime() - new Date(right.endAt).getTime();
      }),
    [list, now]
  );

  const filtered = useMemo(() => {
    const keywordLower = keyword.trim().toLowerCase();
    return sortedList.filter((item) => {
      if (classFilter) {
        const itemClassKey = `${item.className}::${item.classSubject}::${item.classGrade}`;
        if (itemClassKey !== classFilter) return false;
      }
      if (status !== "all" && item.status !== status) return false;
      if (!keywordLower) return true;

      return [item.title, item.description, item.className, SUBJECT_LABELS[item.classSubject] ?? item.classSubject, getGradeLabel(item.classGrade)]
        .join(" ")
        .toLowerCase()
        .includes(keywordLower);
    });
  }, [classFilter, keyword, sortedList, status]);

  const overallSummary = useMemo(
    () => ({
      total: list.length,
      published: list.filter((item) => item.status === "published").length,
      closed: list.filter((item) => item.status === "closed").length,
      dueSoon: list.filter((item) => {
        if (item.status !== "published") return false;
        const diffMs = new Date(item.endAt).getTime() - now;
        return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000 && item.submittedCount < item.assignedCount;
      }).length,
      lowCompletion: list.filter((item) => item.status === "published" && getSubmissionRate(item) < 60).length
    }),
    [list, now]
  );

  const filteredSummary = useMemo(
    () => ({
      total: filtered.length,
      published: filtered.filter((item) => item.status === "published").length,
      closed: filtered.filter((item) => item.status === "closed").length
    }),
    [filtered]
  );

  const topPriorityExam = useMemo(
    () => sortedList.find((item) => item.status === "published") ?? null,
    [sortedList]
  );
  const latestCreatedExam = useMemo(
    () =>
      list.slice().sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null,
    [list]
  );
  const selectedClass = classOptions.find((item) => item.id === classFilter);
  const hasActiveFilters = Boolean(classFilter || status !== "all" || keyword.trim());

  const clearFilters = useCallback(() => {
    setClassFilter("");
    setStatus("all");
    setKeyword("");
  }, []);

  return {
    list,
    classFilter,
    status,
    keyword,
    loading,
    refreshing,
    authRequired,
    error,
    lastLoadedAt,
    now,
    classOptions,
    filtered,
    overallSummary,
    filteredSummary,
    topPriorityExam,
    latestCreatedExam,
    selectedClass,
    hasActiveFilters,
    setClassFilter,
    setStatus,
    setKeyword,
    clearFilters,
    load
  };
}
