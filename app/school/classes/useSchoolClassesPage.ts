"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestJson } from "@/lib/client-request";
import type { SchoolClassRecord } from "@/lib/school-admin-types";
import type { SchoolClassesResponse } from "../types";
import { getSchoolAdminRequestMessage, isSchoolAdminAuthRequiredError } from "../utils";

export type ClassStatusFilter =
  | "all"
  | "teacher_gap"
  | "empty"
  | "no_assignments"
  | "no_schedule"
  | "overloaded"
  | "healthy";

type SchoolClassListItem = {
  record: SchoolClassRecord;
  issueTags: string[];
};

function getClassIssueTags(item: SchoolClassRecord) {
  const tags: string[] = [];
  if (!item.teacherId) tags.push("待绑定教师");
  if (item.studentCount === 0) tags.push("暂无学生");
  if (item.scheduleCount === 0) tags.push("未排课程表");
  if (item.assignmentCount === 0) tags.push("未布置作业");
  if (item.studentCount >= 45) tags.push("人数偏高");
  return tags;
}

export function useSchoolClassesPage() {
  const loadRequestIdRef = useRef(0);
  const [classes, setClasses] = useState<SchoolClassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ClassStatusFilter>("all");

  const loadClasses = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const payload = await requestJson<SchoolClassesResponse>("/api/school/classes");
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      setClasses(payload.data ?? []);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      if (isSchoolAdminAuthRequiredError(nextError)) {
        setAuthRequired(true);
        setClasses([]);
      } else {
        setError(getSchoolAdminRequestMessage(nextError, "加载学校班级失败"));
      }
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const gradeOptions = useMemo(
    () =>
      Array.from(new Set(classes.map((item) => item.grade))).sort((left, right) =>
        left.localeCompare(right, "zh-CN")
      ),
    [classes]
  );

  const filteredClasses = useMemo<SchoolClassListItem[]>(() => {
    const keywordLower = keyword.trim().toLowerCase();
    return classes
      .map((record) => ({
        record,
        issueTags: getClassIssueTags(record)
      }))
      .filter(({ record, issueTags }) => {
        if (gradeFilter !== "all" && record.grade !== gradeFilter) return false;
        if (statusFilter === "teacher_gap" && record.teacherId) return false;
        if (statusFilter === "empty" && record.studentCount > 0) return false;
        if (statusFilter === "no_assignments" && record.assignmentCount > 0) return false;
        if (statusFilter === "no_schedule" && record.scheduleCount > 0) return false;
        if (statusFilter === "overloaded" && record.studentCount < 45) return false;
        if (statusFilter === "healthy" && issueTags.length > 0) return false;
        if (!keywordLower) return true;
        return [record.name, record.subject, record.grade, record.teacherName ?? record.teacherId ?? "", ...issueTags]
          .join(" ")
          .toLowerCase()
          .includes(keywordLower);
      });
  }, [classes, gradeFilter, keyword, statusFilter]);

  const teacherGapCount = useMemo(() => classes.filter((item) => !item.teacherId).length, [classes]);
  const emptyCount = useMemo(() => classes.filter((item) => item.studentCount === 0).length, [classes]);
  const noAssignmentCount = useMemo(() => classes.filter((item) => item.assignmentCount === 0).length, [classes]);
  const noScheduleCount = useMemo(() => classes.filter((item) => item.scheduleCount === 0).length, [classes]);
  const overloadedCount = useMemo(() => classes.filter((item) => item.studentCount >= 45).length, [classes]);

  const clearFilters = useCallback(() => {
    setKeyword("");
    setGradeFilter("all");
    setStatusFilter("all");
  }, []);

  return {
    classes,
    filteredClasses,
    loading,
    refreshing,
    error,
    authRequired,
    lastLoadedAt,
    keyword,
    gradeFilter,
    statusFilter,
    gradeOptions,
    teacherGapCount,
    emptyCount,
    noAssignmentCount,
    noScheduleCount,
    overloadedCount,
    setKeyword,
    setGradeFilter,
    setStatusFilter,
    clearFilters,
    loadClasses
  };
}
