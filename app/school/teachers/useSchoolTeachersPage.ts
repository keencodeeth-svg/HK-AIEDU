"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestJson } from "@/lib/client-request";
import type { SchoolClassRecord, SchoolUserRecord } from "@/lib/school-admin-types";
import type { SchoolClassesResponse, SchoolUsersResponse } from "../types";
import { getSchoolAdminRequestMessage, isSchoolAdminAuthRequiredError } from "../utils";

export type TeacherFilter = "all" | "assigned" | "unassigned" | "multi_class";

type TeacherListItem = {
  teacher: SchoolUserRecord;
  assignedClasses: SchoolClassRecord[];
};

export function useSchoolTeachersPage() {
  const loadRequestIdRef = useRef(0);
  const [teachers, setTeachers] = useState<SchoolUserRecord[]>([]);
  const [classes, setClasses] = useState<SchoolClassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<TeacherFilter>("all");

  const loadData = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [teacherPayload, classPayload] = await Promise.all([
        requestJson<SchoolUsersResponse>("/api/school/users?role=teacher"),
        requestJson<SchoolClassesResponse>("/api/school/classes")
      ]);
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      setTeachers(teacherPayload.data ?? []);
      setClasses(classPayload.data ?? []);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      if (isSchoolAdminAuthRequiredError(nextError)) {
        setAuthRequired(true);
        setTeachers([]);
        setClasses([]);
      } else {
        setError(getSchoolAdminRequestMessage(nextError, "加载教师管理失败"));
      }
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const teacherClassMap = useMemo(() => {
    const map = new Map<string, SchoolClassRecord[]>();
    classes.forEach((item) => {
      if (!item.teacherId) return;
      const list = map.get(item.teacherId) ?? [];
      list.push(item);
      map.set(item.teacherId, list);
    });
    return map;
  }, [classes]);

  const filteredTeachers = useMemo<TeacherListItem[]>(() => {
    const keywordLower = keyword.trim().toLowerCase();
    return teachers
      .map((teacher) => ({
        teacher,
        assignedClasses: teacherClassMap.get(teacher.id) ?? []
      }))
      .filter(({ teacher, assignedClasses }) => {
        if (filter === "assigned" && assignedClasses.length === 0) return false;
        if (filter === "unassigned" && assignedClasses.length > 0) return false;
        if (filter === "multi_class" && assignedClasses.length < 2) return false;
        if (!keywordLower) return true;
        return [teacher.name, teacher.email, ...assignedClasses.map((item) => item.name)]
          .join(" ")
          .toLowerCase()
          .includes(keywordLower);
      });
  }, [filter, keyword, teacherClassMap, teachers]);

  const assignedCount = useMemo(
    () => teachers.filter((teacher) => (teacherClassMap.get(teacher.id) ?? []).length > 0).length,
    [teacherClassMap, teachers]
  );

  const multiClassCount = useMemo(
    () => teachers.filter((teacher) => (teacherClassMap.get(teacher.id) ?? []).length >= 2).length,
    [teacherClassMap, teachers]
  );

  const clearFilters = useCallback(() => {
    setKeyword("");
    setFilter("all");
  }, []);

  return {
    teachers,
    classes,
    filteredTeachers,
    loading,
    refreshing,
    error,
    authRequired,
    lastLoadedAt,
    keyword,
    filter,
    assignedCount,
    multiClassCount,
    setKeyword,
    setFilter,
    clearFilters,
    loadData
  };
}
