"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  GradebookPayload,
  GradebookStatusFilter,
  GradebookViewMode
} from "./types";
import {
  buildGradebookExportMatrix,
  downloadTextFile,
  getTeacherGradebookRequestMessage,
  resolveTeacherGradebookClassId,
  resolveTeacherGradebookSelectedClass
} from "./utils";

export function useTeacherGradebookPage() {
  const [data, setData] = useState<GradebookPayload | null>(null);
  const [classId, setClassId] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<GradebookViewMode>("student");
  const [studentKeyword, setStudentKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<GradebookStatusFilter>("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");

  const load = useCallback(async (nextClassId?: string) => {
    setLoading(true);
    setError(null);
    const query = nextClassId ? `?classId=${nextClassId}` : "";

    try {
      const payload = await requestJson<GradebookPayload>(`/api/teacher/gradebook${query}`);
      setData(payload);
      setAuthRequired(false);
      setClassId(resolveTeacherGradebookClassId(payload));
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        setData(null);
        setClassId("");
        return;
      }

      setError(getTeacherGradebookRequestMessage(nextError, "加载成绩册失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assignments = useMemo(() => data?.assignments ?? [], [data?.assignments]);
  const assignmentStatMap = useMemo(
    () => new Map((data?.assignmentStats ?? []).map((item) => [item.assignmentId, item])),
    [data?.assignmentStats]
  );
  const visibleAssignments = assignmentFilter !== "all"
    ? assignments.filter((item) => item.id === assignmentFilter)
    : assignments.slice(0, 6);
  const filteredAssignments = assignmentFilter === "all"
    ? assignments
    : assignments.filter((item) => item.id === assignmentFilter);
  const now = Date.now();

  const ranked = useMemo(() => {
    if (!data?.students?.length) return new Map<string, number>();
    const sorted = [...data.students].sort(
      (left, right) => right.stats.avgScore - left.stats.avgScore
    );
    return new Map(sorted.map((student, index) => [student.id, index + 1]));
  }, [data?.students]);

  const filteredStudents = useMemo(() => {
    if (!data?.students?.length) return [];
    const keyword = studentKeyword.trim().toLowerCase();
    let list = data.students;

    if (keyword) {
      list = list.filter(
        (student) => student.name.toLowerCase().includes(keyword) || student.email.toLowerCase().includes(keyword)
      );
    }

    if (statusFilter === "overdue") {
      list = list.filter((student) => student.stats.overdue > 0);
    } else if (statusFilter === "pending") {
      list = list.filter((student) => student.stats.pending > 0);
    } else if (statusFilter === "completed") {
      list = list.filter((student) => student.stats.pending === 0);
    }

    return list;
  }, [data?.students, statusFilter, studentKeyword]);

  const trendMap = useMemo(
    () => new Map((data?.trend ?? []).map((item) => [item.assignmentId, item])),
    [data?.trend]
  );
  const selectedClass = useMemo(
    () => resolveTeacherGradebookSelectedClass(data?.classes, classId, data?.class),
    [classId, data?.class, data?.classes]
  );
  const overdueStudentCount = useMemo(
    () => (data?.students ?? []).filter((student) => student.stats.overdue > 0).length,
    [data?.students]
  );
  const followUpStudentCount = useMemo(
    () => (data?.students ?? []).filter((student) => student.stats.overdue > 0 || student.stats.pending > 0).length,
    [data?.students]
  );
  const urgentAssignmentCount = useMemo(
    () =>
      assignments.filter((assignment) => {
        const stat = assignmentStatMap.get(assignment.id);
        if ((stat?.completed ?? 0) >= (stat?.total ?? 0)) return false;
        const dueTs = new Date(assignment.dueDate).getTime();
        return dueTs < now || dueTs - now <= 48 * 60 * 60 * 1000;
      }).length,
    [assignmentStatMap, assignments, now]
  );

  const exportCSV = useCallback(() => {
    if (!data) return;
    const { header, rows } = buildGradebookExportMatrix(data.students, assignments, now);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    downloadTextFile(
      `gradebook-${data.class?.name ?? "class"}.csv`,
      `\uFEFF${csv}`,
      "text/csv;charset=utf-8;"
    );
  }, [assignments, data, now]);

  const exportExcel = useCallback(() => {
    if (!data) return;
    const { header, rows } = buildGradebookExportMatrix(data.students, assignments, now);
    const table = `
      <table>
        <thead><tr>${header.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    `;

    downloadTextFile(
      `gradebook-${data.class?.name ?? "class"}.xls`,
      `\uFEFF${table}`,
      "application/vnd.ms-excel;charset=utf-8;"
    );
  }, [assignments, data, now]);

  const handleClassChange = useCallback((nextClassId: string) => {
    setClassId(nextClassId);
    void load(nextClassId);
  }, [load]);

  return {
    data,
    classId,
    authRequired,
    error,
    loading,
    viewMode,
    studentKeyword,
    statusFilter,
    assignmentFilter,
    assignments,
    assignmentStatMap,
    visibleAssignments,
    filteredAssignments,
    now,
    ranked,
    filteredStudents,
    trendMap,
    selectedClass,
    overdueStudentCount,
    followUpStudentCount,
    urgentAssignmentCount,
    setViewMode,
    setStudentKeyword,
    setStatusFilter,
    setAssignmentFilter,
    load,
    handleClassChange,
    exportCSV,
    exportExcel
  };
}
