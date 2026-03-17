"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  CourseAuthResponse,
  CourseClassesResponse,
  CourseClass,
  CourseSummary,
  CourseSummaryResponse,
  CourseSyllabusResponse,
  Syllabus
} from "./types";
import {
  createBlankSyllabus,
  getCourseClassesRequestMessage,
  getCourseSaveRequestMessage,
  getCourseSummaryRequestMessage,
  getCourseSyllabusRequestMessage,
  isMissingCourseClassError,
  normalizeSyllabus,
  resolveCourseClassId
} from "./utils";

type CourseLoadResult = {
  errorMessage: string | null;
  hasSuccess: boolean;
  status: "auth" | "empty" | "error" | "loaded" | "stale";
};

export function useCoursePage() {
  const pageRequestIdRef = useRef(0);
  const courseRequestIdRef = useRef(0);
  const classIdRef = useRef("");
  const hasBootstrapSnapshotRef = useRef(false);
  const hasCourseSnapshotRef = useRef(false);
  const courseSnapshotClassIdRef = useRef("");
  const [role, setRole] = useState<string | null>(null);
  const [classes, setClasses] = useState<CourseClass[]>([]);
  const [classId, setClassId] = useState("");
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [summary, setSummary] = useState<CourseSummary | null>(null);
  const [form, setForm] = useState<Syllabus>(createBlankSyllabus);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  useEffect(() => {
    classIdRef.current = classId;
  }, [classId]);

  const applySyllabus = useCallback((nextSyllabus?: Syllabus | null) => {
    const normalized = normalizeSyllabus(nextSyllabus);
    setSyllabus(nextSyllabus ? normalized : null);
    setForm(normalized);
  }, []);

  const clearCourseDetailState = useCallback(() => {
    hasCourseSnapshotRef.current = false;
    courseSnapshotClassIdRef.current = "";
    setSummary(null);
    setMessage(null);
    setError(null);
    applySyllabus(null);
  }, [applySyllabus]);

  const clearBootstrapState = useCallback(() => {
    hasBootstrapSnapshotRef.current = false;
    setRole(null);
    setClasses([]);
    setClassId("");
  }, []);

  const clearCoursePageState = useCallback(() => {
    clearBootstrapState();
    clearCourseDetailState();
    setPageError(null);
    setLastLoadedAt(null);
  }, [clearBootstrapState, clearCourseDetailState]);

  const handleAuthRequired = useCallback(() => {
    courseRequestIdRef.current += 1;
    clearCoursePageState();
    setAuthRequired(true);
  }, [clearCoursePageState]);

  const loadCourseDetails = useCallback(
    async (
      targetClassId: string,
      options?: {
        clearBeforeLoad?: boolean;
        preserveSnapshot?: boolean;
        replaceSelection?: boolean;
      }
    ): Promise<CourseLoadResult> => {
      const requestId = courseRequestIdRef.current + 1;
      courseRequestIdRef.current = requestId;

      if (options?.replaceSelection !== false) {
        setClassId(targetClassId);
      }

      if (!targetClassId) {
        clearCourseDetailState();
        return { status: "empty", errorMessage: null, hasSuccess: false };
      }

      setMessage(null);
      setError(null);

      if (options?.clearBeforeLoad) {
        clearCourseDetailState();
      }

      try {
        const [syllabusResult, summaryResult] = await Promise.allSettled([
          requestJson<CourseSyllabusResponse>(`/api/course/syllabus?classId=${targetClassId}`),
          requestJson<CourseSummaryResponse>(`/api/course/summary?classId=${targetClassId}`)
        ]);

        if (courseRequestIdRef.current !== requestId) {
          return { status: "stale", errorMessage: null, hasSuccess: false };
        }

        const authFailure =
          (syllabusResult.status === "rejected" && isAuthError(syllabusResult.reason)) ||
          (summaryResult.status === "rejected" && isAuthError(summaryResult.reason));

        if (authFailure) {
          handleAuthRequired();
          return { status: "auth", errorMessage: null, hasSuccess: false };
        }

        const shouldPreserveSnapshot =
          options?.preserveSnapshot === true && courseSnapshotClassIdRef.current === targetClassId;
        const hasMissingClassError =
          (syllabusResult.status === "rejected" && isMissingCourseClassError(syllabusResult.reason)) ||
          (summaryResult.status === "rejected" && isMissingCourseClassError(summaryResult.reason));

        let hasSuccess = false;
        const nextErrors: string[] = [];

        if (syllabusResult.status === "fulfilled") {
          applySyllabus(syllabusResult.value.data ?? null);
          hasSuccess = true;
        } else {
          if (!shouldPreserveSnapshot || hasMissingClassError) {
            applySyllabus(null);
          }
          nextErrors.push(getCourseSyllabusRequestMessage(syllabusResult.reason, "加载课程大纲失败"));
        }

        if (summaryResult.status === "fulfilled") {
          setSummary(summaryResult.value.summary ?? null);
          hasSuccess = true;
        } else {
          if (!shouldPreserveSnapshot || hasMissingClassError) {
            setSummary(null);
          }
          nextErrors.push(getCourseSummaryRequestMessage(summaryResult.reason, "加载课程概览失败"));
        }

        if (!hasSuccess && (!shouldPreserveSnapshot || hasMissingClassError)) {
          clearCourseDetailState();
        }

        if (hasSuccess) {
          hasCourseSnapshotRef.current = true;
          courseSnapshotClassIdRef.current = targetClassId;
          setAuthRequired(false);
          setLastLoadedAt(new Date().toISOString());
        } else {
          setAuthRequired(false);
        }

        return {
          status: nextErrors.length ? "error" : "loaded",
          errorMessage: nextErrors.length ? nextErrors.join("；") : null,
          hasSuccess
        };
      } catch (nextError) {
        if (courseRequestIdRef.current !== requestId) {
          return { status: "stale", errorMessage: null, hasSuccess: false };
        }

        if (isAuthError(nextError)) {
          handleAuthRequired();
          return { status: "auth", errorMessage: null, hasSuccess: false };
        }

        if (!options?.preserveSnapshot) {
          clearCourseDetailState();
        }

        return {
          status: "error",
          errorMessage: getCourseSyllabusRequestMessage(nextError, "加载课程大纲失败"),
          hasSuccess: false
        };
      }
    },
    [applySyllabus, clearCourseDetailState, handleAuthRequired]
  );

  const loadPage = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const requestId = pageRequestIdRef.current + 1;
      pageRequestIdRef.current = requestId;

      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setPageError(null);

      try {
        const [authResult, classesResult] = await Promise.allSettled([
          requestJson<CourseAuthResponse>("/api/auth/me"),
          requestJson<CourseClassesResponse>("/api/classes")
        ]);

        if (pageRequestIdRef.current !== requestId) {
          return;
        }

        const authFailure =
          (authResult.status === "rejected" && isAuthError(authResult.reason)) ||
          (classesResult.status === "rejected" && isAuthError(classesResult.reason));

        if (authFailure) {
          handleAuthRequired();
          return;
        }

        const bootstrapErrors: string[] = [];
        let nextClassId = classIdRef.current;

        if (authResult.status === "fulfilled") {
          hasBootstrapSnapshotRef.current = true;
          setRole(authResult.value.user?.role ?? null);
        } else {
          if (!hasBootstrapSnapshotRef.current) {
            setRole(null);
          }
          bootstrapErrors.push(getCourseClassesRequestMessage(authResult.reason, "加载账号信息失败"));
        }

        if (classesResult.status === "fulfilled") {
          const nextClasses = classesResult.value.data ?? [];
          nextClassId = resolveCourseClassId(nextClasses, classIdRef.current);
          hasBootstrapSnapshotRef.current = true;
          setClasses(nextClasses);
          setClassId(nextClassId);
        } else {
          if (!hasBootstrapSnapshotRef.current) {
            setClasses([]);
            setClassId("");
            nextClassId = "";
          }
          bootstrapErrors.push(getCourseClassesRequestMessage(classesResult.reason, "加载班级列表失败"));
        }

        setAuthRequired(false);

        if (nextClassId) {
          const detailResult = await loadCourseDetails(nextClassId, {
            clearBeforeLoad: !hasCourseSnapshotRef.current || courseSnapshotClassIdRef.current !== nextClassId,
            preserveSnapshot: mode === "refresh" && courseSnapshotClassIdRef.current === nextClassId,
            replaceSelection: false
          });

          if (pageRequestIdRef.current !== requestId || detailResult.status === "stale") {
            return;
          }

          if (detailResult.status === "auth") {
            return;
          }

          const nextPageErrors = bootstrapErrors.concat(detailResult.errorMessage ? [detailResult.errorMessage] : []);
          setPageError(nextPageErrors.length ? nextPageErrors.join("；") : null);
        } else {
          clearCourseDetailState();
          setPageError(bootstrapErrors.length ? bootstrapErrors.join("；") : null);
        }
      } finally {
        if (pageRequestIdRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [clearCourseDetailState, handleAuthRequired, loadCourseDetails]
  );

  useEffect(() => {
    void loadPage("initial");
  }, [loadPage]);

  const handleClassChange = useCallback(
    async (nextClassId: string) => {
      setClassId(nextClassId);
      setPageError(null);

      const detailResult = await loadCourseDetails(nextClassId, {
        clearBeforeLoad: true,
        preserveSnapshot: false,
        replaceSelection: false
      });

      if (detailResult.status === "auth" || detailResult.status === "stale") {
        return;
      }

      setPageError(detailResult.errorMessage);
    },
    [loadCourseDetails]
  );

  const handleFormChange = useCallback((field: keyof Syllabus, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!classId) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = await requestJson<CourseSyllabusResponse>("/api/course/syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, ...form })
      });
      setAuthRequired(false);
      const nextSyllabus = normalizeSyllabus(payload.data);
      hasCourseSnapshotRef.current = true;
      courseSnapshotClassIdRef.current = classId;
      setMessage("课程大纲已更新");
      setSyllabus(nextSyllabus);
      setForm(nextSyllabus);
      setPageError(null);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        if (isMissingCourseClassError(nextError)) {
          clearCourseDetailState();
        }
        setAuthRequired(false);
        setError(getCourseSaveRequestMessage(nextError, "保存失败"));
      }
    } finally {
      setSaving(false);
    }
  }, [classId, clearCourseDetailState, form, handleAuthRequired]);

  const currentClass = useMemo(() => classes.find((item) => item.id === classId) ?? null, [classId, classes]);
  const hasCourseData = classes.length > 0 || syllabus !== null || summary !== null;

  return {
    role,
    classes,
    classId,
    syllabus,
    summary,
    form,
    message,
    error,
    pageError,
    loading,
    refreshing,
    saving,
    authRequired,
    lastLoadedAt,
    hasCourseData,
    canEdit: role === "teacher",
    currentClass,
    setClassId: handleClassChange,
    handleFormChange,
    handleSave,
    refreshCourse: () => {
      void loadPage("refresh");
    }
  };
}
