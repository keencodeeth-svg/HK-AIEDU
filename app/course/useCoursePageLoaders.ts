"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
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
  getCourseNoStoreRequestInit,
  getCourseClassesRequestMessage,
  getCourseSummaryRequestMessage,
  getCourseSyllabusRequestMessage,
  isMissingCourseClassError,
  resolveCourseClassId
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type CourseLoadMode = "initial" | "refresh";

export type CourseLoadResult = {
  errorMessage: string | null;
  hasSuccess: boolean;
  status: "auth" | "empty" | "error" | "loaded" | "stale";
};

type CoursePageLoadersOptions = {
  pageRequestIdRef: MutableRefObject<number>;
  courseRequestIdRef: MutableRefObject<number>;
  classIdRef: MutableRefObject<string>;
  hasBootstrapSnapshotRef: MutableRefObject<boolean>;
  hasCourseSnapshotRef: MutableRefObject<boolean>;
  courseSnapshotClassIdRef: MutableRefObject<string>;
  applySyllabus: (nextSyllabus?: Syllabus | null) => void;
  clearCourseDetailState: () => void;
  handleAuthRequired: () => void;
  setRole: Setter<string | null>;
  setClasses: Setter<CourseClass[]>;
  setClassId: Setter<string>;
  setSummary: Setter<CourseSummary | null>;
  setMessage: Setter<string | null>;
  setError: Setter<string | null>;
  setPageError: Setter<string | null>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useCoursePageLoaders({
  pageRequestIdRef,
  courseRequestIdRef,
  classIdRef,
  hasBootstrapSnapshotRef,
  hasCourseSnapshotRef,
  courseSnapshotClassIdRef,
  applySyllabus,
  clearCourseDetailState,
  handleAuthRequired,
  setRole,
  setClasses,
  setClassId,
  setSummary,
  setMessage,
  setError,
  setPageError,
  setLoading,
  setRefreshing,
  setAuthRequired,
  setLastLoadedAt
}: CoursePageLoadersOptions) {
  const loadCourseDetails = useCallback(async (
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
  }, [
    applySyllabus,
    clearCourseDetailState,
    courseRequestIdRef,
    courseSnapshotClassIdRef,
    handleAuthRequired,
    hasCourseSnapshotRef,
    setAuthRequired,
    setClassId,
    setError,
    setLastLoadedAt,
    setMessage,
    setSummary
  ]);

  const loadPage = useCallback(async (mode: CourseLoadMode = "initial") => {
    const requestId = pageRequestIdRef.current + 1;
    pageRequestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setPageError(null);

    try {
      const noStoreRequestInit = getCourseNoStoreRequestInit();
      const [authResult, classesResult] = await Promise.allSettled([
        requestJson<CourseAuthResponse>("/api/auth/me", noStoreRequestInit),
        requestJson<CourseClassesResponse>("/api/classes", noStoreRequestInit)
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
  }, [
    classIdRef,
    clearCourseDetailState,
    courseSnapshotClassIdRef,
    handleAuthRequired,
    hasBootstrapSnapshotRef,
    hasCourseSnapshotRef,
    loadCourseDetails,
    pageRequestIdRef,
    setAuthRequired,
    setClassId,
    setClasses,
    setLoading,
    setPageError,
    setRefreshing,
    setRole
  ]);

  return {
    loadCourseDetails,
    loadPage
  };
}
