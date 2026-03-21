"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestJson } from "@/lib/client-request";
import type { SchoolUserRecord } from "@/lib/school-admin-types";
import type { SchoolUsersResponse } from "../types";
import { getSchoolAdminRequestMessage, isSchoolAdminAuthRequiredError } from "../utils";

export function useSchoolStudentsPage() {
  const loadRequestIdRef = useRef(0);
  const [students, setStudents] = useState<SchoolUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");

  const loadStudents = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const payload = await requestJson<SchoolUsersResponse>("/api/school/users?role=student");
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      setStudents(payload.data ?? []);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      if (isSchoolAdminAuthRequiredError(nextError)) {
        setAuthRequired(true);
        setStudents([]);
      } else {
        setError(getSchoolAdminRequestMessage(nextError, "加载学生管理失败"));
      }
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const gradeOptions = useMemo(
    () =>
      Array.from(new Set(students.map((item) => item.grade).filter(Boolean) as string[])).sort(
        (left, right) => left.localeCompare(right, "zh-CN")
      ),
    [students]
  );

  const stageSummary = useMemo(() => {
    return students.reduce(
      (acc, item) => {
        const grade = Number(item.grade ?? 0);
        if (!item.grade || Number.isNaN(grade)) {
          acc.missing += 1;
        } else if (grade <= 6) {
          acc.primary += 1;
        } else if (grade <= 9) {
          acc.middle += 1;
        } else {
          acc.high += 1;
        }
        return acc;
      },
      { primary: 0, middle: 0, high: 0, missing: 0 }
    );
  }, [students]);

  const filteredStudents = useMemo(() => {
    const keywordLower = keyword.trim().toLowerCase();
    return students.filter((student) => {
      if (gradeFilter !== "all" && student.grade !== gradeFilter) return false;
      if (!keywordLower) return true;
      return [student.name, student.email, student.grade ?? "未设置年级"]
        .join(" ")
        .toLowerCase()
        .includes(keywordLower);
    });
  }, [gradeFilter, keyword, students]);

  const clearFilters = useCallback(() => {
    setKeyword("");
    setGradeFilter("all");
  }, []);

  return {
    students,
    filteredStudents,
    loading,
    refreshing,
    error,
    authRequired,
    lastLoadedAt,
    keyword,
    gradeFilter,
    gradeOptions,
    stageSummary,
    setKeyword,
    setGradeFilter,
    clearFilters,
    loadStudents
  };
}
