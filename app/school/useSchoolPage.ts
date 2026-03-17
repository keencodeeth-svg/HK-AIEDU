"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestJson } from "@/lib/client-request";
import type { SchoolClassRecord, SchoolOverview, SchoolUserRecord } from "@/lib/school-admin-types";
import type { SchoolClassesResponse, SchoolOverviewResponse, SchoolUsersResponse } from "./types";
import { getSchoolAdminRequestMessage, isSchoolAdminAuthRequiredError } from "./utils";

const PREVIEW_LIMIT = 6;

export function useSchoolPage() {
  const loadRequestIdRef = useRef(0);
  const hasOverviewSnapshotRef = useRef(false);
  const hasClassesSnapshotRef = useRef(false);
  const hasTeachersSnapshotRef = useRef(false);
  const hasStudentsSnapshotRef = useRef(false);
  const [overview, setOverview] = useState<SchoolOverview | null>(null);
  const [classes, setClasses] = useState<SchoolClassRecord[]>([]);
  const [teachers, setTeachers] = useState<SchoolUserRecord[]>([]);
  const [students, setStudents] = useState<SchoolUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearOverviewState = useCallback(() => {
    hasOverviewSnapshotRef.current = false;
    setOverview(null);
  }, []);

  const clearClassesState = useCallback(() => {
    hasClassesSnapshotRef.current = false;
    setClasses([]);
  }, []);

  const clearTeachersState = useCallback(() => {
    hasTeachersSnapshotRef.current = false;
    setTeachers([]);
  }, []);

  const clearStudentsState = useCallback(() => {
    hasStudentsSnapshotRef.current = false;
    setStudents([]);
  }, []);

  const clearSchoolPageState = useCallback(() => {
    clearOverviewState();
    clearClassesState();
    clearTeachersState();
    clearStudentsState();
    setPageError(null);
    setLastLoadedAt(null);
  }, [clearClassesState, clearOverviewState, clearStudentsState, clearTeachersState]);

  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    clearSchoolPageState();
    setLoading(false);
    setRefreshing(false);
    setAuthRequired(true);
  }, [clearSchoolPageState]);

  const loadAll = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);

    try {
      const [overviewData, classesData, teachersData, studentsData] = await Promise.allSettled([
        requestJson<SchoolOverviewResponse>("/api/school/overview"),
        requestJson<SchoolClassesResponse>("/api/school/classes"),
        requestJson<SchoolUsersResponse>("/api/school/users?role=teacher"),
        requestJson<SchoolUsersResponse>("/api/school/users?role=student")
      ]);

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      const authFailure = [overviewData, classesData, teachersData, studentsData].find(
        (result) => result.status === "rejected" && isSchoolAdminAuthRequiredError(result.reason)
      );
      if (authFailure) {
        handleAuthRequired();
        return;
      }

      const nextErrors: string[] = [];
      let hasSuccess = false;

      if (overviewData.status === "fulfilled") {
        hasOverviewSnapshotRef.current = true;
        setOverview(overviewData.value.data ?? null);
        hasSuccess = true;
      } else {
        if (!hasOverviewSnapshotRef.current) {
          clearOverviewState();
        }
        nextErrors.push(getSchoolAdminRequestMessage(overviewData.reason, "加载学校控制台失败"));
      }

      if (classesData.status === "fulfilled") {
        hasClassesSnapshotRef.current = true;
        setClasses(classesData.value.data ?? []);
        hasSuccess = true;
      } else {
        if (!hasClassesSnapshotRef.current) {
          clearClassesState();
        }
        nextErrors.push(`班级数据加载失败：${getSchoolAdminRequestMessage(classesData.reason, "加载失败")}`);
      }

      if (teachersData.status === "fulfilled") {
        hasTeachersSnapshotRef.current = true;
        setTeachers(teachersData.value.data ?? []);
        hasSuccess = true;
      } else {
        if (!hasTeachersSnapshotRef.current) {
          clearTeachersState();
        }
        nextErrors.push(`教师数据加载失败：${getSchoolAdminRequestMessage(teachersData.reason, "加载失败")}`);
      }

      if (studentsData.status === "fulfilled") {
        hasStudentsSnapshotRef.current = true;
        setStudents(studentsData.value.data ?? []);
        hasSuccess = true;
      } else {
        if (!hasStudentsSnapshotRef.current) {
          clearStudentsState();
        }
        nextErrors.push(`学生数据加载失败：${getSchoolAdminRequestMessage(studentsData.reason, "加载失败")}`);
      }

      setAuthRequired(false);
      if (hasSuccess) {
        setLastLoadedAt(new Date().toISOString());
      }
      if (nextErrors.length) {
        setPageError(nextErrors.join("；"));
      }
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      if (isSchoolAdminAuthRequiredError(error)) {
        handleAuthRequired();
      } else {
        if (!hasOverviewSnapshotRef.current) {
          clearOverviewState();
        }
        if (!hasClassesSnapshotRef.current) {
          clearClassesState();
        }
        if (!hasTeachersSnapshotRef.current) {
          clearTeachersState();
        }
        if (!hasStudentsSnapshotRef.current) {
          clearStudentsState();
        }
        setAuthRequired(false);
        setPageError(getSchoolAdminRequestMessage(error, "加载学校控制台失败"));
      }
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    clearClassesState,
    clearOverviewState,
    clearStudentsState,
    clearTeachersState,
    handleAuthRequired
  ]);

  useEffect(() => {
    void loadAll("initial");
  }, [loadAll]);

  const classPreview = useMemo(() => classes.slice(0, PREVIEW_LIMIT), [classes]);
  const teacherPreview = useMemo(() => teachers.slice(0, PREVIEW_LIMIT), [teachers]);
  const studentPreview = useMemo(() => students.slice(0, PREVIEW_LIMIT), [students]);

  return {
    overview,
    classes,
    teachers,
    students,
    classPreview,
    teacherPreview,
    studentPreview,
    loading,
    refreshing,
    pageError,
    authRequired,
    lastLoadedAt,
    loadAll
  };
}
