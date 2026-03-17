"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  AssignmentNotifyTarget,
  AssignmentStudentFilter,
  RubricItem,
  RubricLevel,
  TeacherAssignmentDetailData,
  TeacherAssignmentStudent
} from "./types";
import {
  getStudentPriority,
  getTeacherAssignmentDetailRequestMessage,
  isMissingTeacherAssignmentDetailError,
  normalizeRubricItems
} from "./utils";

type AssignmentRubricsResponse = {
  data?: RubricItem[];
};

type AssignmentNotifyResponse = {
  data?: {
    students?: number;
    parents?: number;
  };
};

export function useTeacherAssignmentDetailPage(id: string) {
  const loadRequestIdRef = useRef(0);
  const rubricRequestIdRef = useRef(0);
  const hasDetailSnapshotRef = useRef(false);
  const rubricsReadyRef = useRef(false);

  const [data, setData] = useState<TeacherAssignmentDetailData | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<AssignmentNotifyTarget>("missing");
  const [threshold, setThreshold] = useState(60);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [rubrics, setRubrics] = useState<RubricItem[]>([]);
  const [rubricsLoading, setRubricsLoading] = useState(false);
  const [rubricsReady, setRubricsReady] = useState(false);
  const [rubricLoadError, setRubricLoadError] = useState<string | null>(null);
  const [rubricMessage, setRubricMessage] = useState<string | null>(null);
  const [rubricError, setRubricError] = useState<string | null>(null);
  const [rubricSaving, setRubricSaving] = useState(false);
  const [studentFilter, setStudentFilter] = useState<AssignmentStudentFilter>("all");
  const [studentKeyword, setStudentKeyword] = useState("");
  const now = Date.now();

  useEffect(() => {
    rubricsReadyRef.current = rubricsReady;
  }, [rubricsReady]);

  const clearAssignmentDetailState = useCallback(() => {
    hasDetailSnapshotRef.current = false;
    rubricsReadyRef.current = false;
    setData(null);
    setNotifySuccess(null);
    setNotifyError(null);
    setRubrics([]);
    setRubricsReady(false);
    setRubricLoadError(null);
    setRubricMessage(null);
    setRubricError(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearAssignmentDetailState();
    setLoadError(null);
    setAuthRequired(true);
  }, [clearAssignmentDetailState]);

  const requestRubrics = useCallback(async () => {
    const payload = await requestJson<AssignmentRubricsResponse>(
      `/api/teacher/assignments/${id}/rubrics`
    );
    return normalizeRubricItems(payload.data ?? []);
  }, [id]);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    setLoading(true);
    setLoadError(null);
    setRubricLoadError(null);
    setRubricsLoading(true);

    if (mode === "initial" && !hasDetailSnapshotRef.current) {
      setData(null);
    }

    try {
      const [detailResult, rubricsResult] = await Promise.allSettled([
        requestJson<TeacherAssignmentDetailData>(`/api/teacher/assignments/${id}`),
        requestRubrics()
      ]);

      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      const detailAuthError =
        detailResult.status === "rejected" && isAuthError(detailResult.reason);
      const rubricsAuthError =
        rubricsResult.status === "rejected" && isAuthError(rubricsResult.reason);

      if (detailAuthError || rubricsAuthError) {
        handleAuthRequired();
        return;
      }

      if (detailResult.status === "rejected") {
        const nextMessage = getTeacherAssignmentDetailRequestMessage(detailResult.reason, "加载失败");
        if (isMissingTeacherAssignmentDetailError(detailResult.reason) || !hasDetailSnapshotRef.current) {
          clearAssignmentDetailState();
        }
        setAuthRequired(false);
        setLoadError(nextMessage);
        return;
      }

      hasDetailSnapshotRef.current = true;
      setAuthRequired(false);
      setData(detailResult.value);

      if (rubricsResult.status === "fulfilled") {
        setRubrics(rubricsResult.value);
        setRubricsReady(true);
        setRubricLoadError(null);
      } else {
        if (isMissingTeacherAssignmentDetailError(rubricsResult.reason)) {
          clearAssignmentDetailState();
          setLoadError(getTeacherAssignmentDetailRequestMessage(rubricsResult.reason, "加载失败"));
          return;
        }

        setRubricLoadError(getTeacherAssignmentDetailRequestMessage(rubricsResult.reason, "评分细则加载失败"));
        if (!rubricsReadyRef.current) {
          setRubrics([]);
          setRubricsReady(false);
        }
      }
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
        setRubricsLoading(false);
      }
    }
  }, [clearAssignmentDetailState, handleAuthRequired, id, requestRubrics]);

  const retryRubrics = useCallback(async () => {
    const requestId = rubricRequestIdRef.current + 1;
    rubricRequestIdRef.current = requestId;
    setRubricsLoading(true);
    setRubricLoadError(null);

    try {
      const nextRubrics = await requestRubrics();
      if (requestId !== rubricRequestIdRef.current) {
        return;
      }
      setRubrics(nextRubrics);
      setRubricsReady(true);
      setAuthRequired(false);
    } catch (nextError) {
      if (requestId !== rubricRequestIdRef.current) {
        return;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else if (isMissingTeacherAssignmentDetailError(nextError)) {
        clearAssignmentDetailState();
        setLoadError(getTeacherAssignmentDetailRequestMessage(nextError, "加载失败"));
      } else {
        setRubricLoadError(getTeacherAssignmentDetailRequestMessage(nextError, "评分细则加载失败"));
        if (!rubricsReadyRef.current) {
          setRubrics([]);
          setRubricsReady(false);
        }
      }
    } finally {
      if (requestId === rubricRequestIdRef.current) {
        setRubricsLoading(false);
      }
    }
  }, [clearAssignmentDetailState, handleAuthRequired, requestRubrics]);

  useEffect(() => {
    void load("initial");
  }, [load]);

  const assignmentOverdue = useMemo(
    () => (data ? new Date(data.assignment.dueDate).getTime() < now : false),
    [data, now]
  );
  const completedStudents = useMemo(
    () => data?.students.filter((student) => student.status === "completed") ?? [],
    [data]
  );
  const pendingStudents = useMemo(
    () => data?.students.filter((student) => student.status !== "completed") ?? [],
    [data]
  );
  const reviewReadyStudents = useMemo(
    () =>
      completedStudents.filter(
        (student) => student.score === null || student.total === null
      ),
    [completedStudents]
  );
  const scoredStudents = useMemo(
    () =>
      completedStudents.filter(
        (student) =>
          student.score !== null && student.total !== null && student.total > 0
      ),
    [completedStudents]
  );
  const lowScoreStudents = useMemo(
    () => scoredStudents.filter((student) => student.score! / student.total! < 0.6),
    [scoredStudents]
  );
  const latestCompletedStudent = useMemo(
    () =>
      [...completedStudents].sort((left, right) => {
        const leftTs = new Date(left.completedAt ?? "").getTime();
        const rightTs = new Date(right.completedAt ?? "").getTime();
        return rightTs - leftTs;
      })[0] ?? null,
    [completedStudents]
  );
  const completionRate = data?.students.length
    ? Math.round((completedStudents.length / data.students.length) * 100)
    : 0;
  const averagePercent = scoredStudents.length
    ? Math.round(
        scoredStudents.reduce(
          (sum, student) => sum + (student.score! / student.total!) * 100,
          0
        ) / scoredStudents.length
      )
    : null;
  const notifyPreviewStudents = useMemo(() => {
    if (!data) return [];
    if (notifyTarget === "missing") return pendingStudents;
    if (notifyTarget === "low_score") {
      return scoredStudents.filter(
        (student) => (student.score! / student.total!) * 100 < threshold
      );
    }
    return data.students;
  }, [data, notifyTarget, pendingStudents, scoredStudents, threshold]);
  const hasStudentFilters = Boolean(studentFilter !== "all" || studentKeyword.trim());

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const keywordLower = studentKeyword.trim().toLowerCase();
    let list = data.students;

    if (studentFilter === "pending") {
      list = list.filter((student) => student.status !== "completed");
    } else if (studentFilter === "review") {
      list = list.filter(
        (student) =>
          student.status === "completed" &&
          (student.score === null || student.total === null)
      );
    } else if (studentFilter === "low_score") {
      list = list.filter(
        (student) =>
          student.status === "completed" &&
          student.score !== null &&
          student.total !== null &&
          student.total > 0 &&
          student.score / student.total < 0.6
      );
    } else if (studentFilter === "completed") {
      list = list.filter((student) => student.status === "completed");
    }

    if (keywordLower) {
      list = list.filter((student) =>
        [student.name, student.email, student.grade ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(keywordLower)
      );
    }

    const getRank = (student: TeacherAssignmentStudent) => {
      const priority = getStudentPriority(student, assignmentOverdue);
      if (priority.label === "优先催交") return 0;
      if (priority.label === "待提交") return 1;
      if (priority.label === "待批改") return 2;
      if (priority.label === "需要复盘") return 3;
      return 4;
    };

    return [...list].sort((left, right) => {
      const rankDiff = getRank(left) - getRank(right);
      if (rankDiff !== 0) return rankDiff;
      if (left.status === "completed" && right.status === "completed") {
        const leftTs = new Date(left.completedAt ?? "").getTime();
        const rightTs = new Date(right.completedAt ?? "").getTime();
        return rightTs - leftTs;
      }
      return left.name.localeCompare(right.name, "zh-CN");
    });
  }, [assignmentOverdue, data, studentFilter, studentKeyword]);

  const updateRubric = useCallback((index: number, patch: Partial<RubricItem>) => {
    setRubrics((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  }, []);

  const updateLevel = useCallback(
    (rubricIndex: number, levelIndex: number, patch: Partial<RubricLevel>) => {
      setRubrics((prev) =>
        prev.map((item, idx) => {
          if (idx !== rubricIndex) return item;
          const levels = item.levels.map((level, lidx) =>
            lidx === levelIndex ? { ...level, ...patch } : level
          );
          return { ...item, levels };
        })
      );
    },
    []
  );

  const addRubric = useCallback(() => {
    setRubrics((prev) => [
      ...prev,
      {
        title: "评分维度",
        description: "",
        maxScore: 10,
        weight: 1,
        levels: [
          { label: "优秀", score: 10, description: "表现优秀" },
          { label: "良好", score: 8, description: "表现良好" },
          { label: "需改进", score: 6, description: "需要改进" }
        ]
      }
    ]);
  }, []);

  const removeRubric = useCallback((index: number) => {
    setRubrics((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const addLevel = useCallback((index: number) => {
    setRubrics((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              levels: [
                ...item.levels,
                { label: "分档", score: item.maxScore, description: "" }
              ]
            }
          : item
      )
    );
  }, []);

  const removeLevel = useCallback((rubricIndex: number, levelIndex: number) => {
    setRubrics((prev) =>
      prev.map((item, idx) =>
        idx === rubricIndex
          ? {
              ...item,
              levels: item.levels.filter((_, lidx) => lidx !== levelIndex)
            }
          : item
      )
    );
  }, []);

  const clearStudentFilters = useCallback(() => {
    setStudentFilter("all");
    setStudentKeyword("");
  }, []);

  const handleNotify = useCallback(async () => {
    if (!data || notifyLoading) return;

    setNotifyLoading(true);
    setNotifySuccess(null);
    setNotifyError(null);

    try {
      const payload = await requestJson<AssignmentNotifyResponse>(
        `/api/teacher/assignments/${data.assignment.id}/notify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target: notifyTarget,
            threshold,
            message: notifyMessage
          })
        }
      );
      setNotifySuccess(
        `已通知学生 ${payload.data?.students ?? 0} 人，家长 ${
          payload.data?.parents ?? 0
        } 人。`
      );
      setAuthRequired(false);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else if (isMissingTeacherAssignmentDetailError(nextError)) {
        clearAssignmentDetailState();
        setLoadError(getTeacherAssignmentDetailRequestMessage(nextError, "加载失败"));
      } else {
        setNotifyError(getTeacherAssignmentDetailRequestMessage(nextError, "提醒失败"));
      }
    } finally {
      setNotifyLoading(false);
    }
  }, [clearAssignmentDetailState, data, handleAuthRequired, notifyLoading, notifyMessage, notifyTarget, threshold]);

  const handleSaveRubrics = useCallback(async () => {
    if (!data || rubricSaving || !rubricsReady) return;

    setRubricSaving(true);
    setRubricMessage(null);
    setRubricError(null);

    try {
      const payload = await requestJson<AssignmentRubricsResponse>(
        `/api/teacher/assignments/${data.assignment.id}/rubrics`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: rubrics })
        }
      );
      setRubricMessage("评分细则已保存");
      setRubrics(normalizeRubricItems(payload.data ?? []));
      setRubricsReady(true);
      setRubricLoadError(null);
      setAuthRequired(false);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else if (isMissingTeacherAssignmentDetailError(nextError)) {
        clearAssignmentDetailState();
        setLoadError(getTeacherAssignmentDetailRequestMessage(nextError, "加载失败"));
      } else {
        setRubricError(getTeacherAssignmentDetailRequestMessage(nextError, "保存失败"));
      }
    } finally {
      setRubricSaving(false);
    }
  }, [clearAssignmentDetailState, data, handleAuthRequired, rubricSaving, rubrics, rubricsReady]);

  return {
    data,
    authRequired,
    loading,
    loadError,
    notifyTarget,
    threshold,
    notifyMessage,
    notifyLoading,
    notifySuccess,
    notifyError,
    rubrics,
    rubricsLoading,
    rubricsReady,
    rubricLoadError,
    rubricMessage,
    rubricError,
    rubricSaving,
    studentFilter,
    studentKeyword,
    now,
    assignmentOverdue,
    completedStudents,
    pendingStudents,
    reviewReadyStudents,
    scoredStudents,
    lowScoreStudents,
    latestCompletedStudent,
    completionRate,
    averagePercent,
    notifyPreviewStudents,
    hasStudentFilters,
    filteredStudents,
    setNotifyTarget,
    setThreshold,
    setNotifyMessage,
    setStudentFilter,
    setStudentKeyword,
    updateRubric,
    updateLevel,
    addRubric,
    removeRubric,
    addLevel,
    removeLevel,
    clearStudentFilters,
    load,
    retryRubrics,
    handleNotify,
    handleSaveRubrics
  };
}
