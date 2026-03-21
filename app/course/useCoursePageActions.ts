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
  CourseSyllabusResponse,
  Syllabus
} from "./types";
import type { CourseLoadResult } from "./useCoursePageLoaders";
import {
  getCourseSaveRequestMessage,
  isMissingCourseClassError,
  normalizeSyllabus
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type LoadCourseDetails = (
  targetClassId: string,
  options?: {
    clearBeforeLoad?: boolean;
    preserveSnapshot?: boolean;
    replaceSelection?: boolean;
  }
) => Promise<CourseLoadResult>;

type CoursePageActionsOptions = {
  classId: string;
  form: Syllabus;
  hasCourseSnapshotRef: MutableRefObject<boolean>;
  courseSnapshotClassIdRef: MutableRefObject<string>;
  loadCourseDetails: LoadCourseDetails;
  clearCourseDetailState: () => void;
  handleAuthRequired: () => void;
  setClassId: Setter<string>;
  setSyllabus: Setter<Syllabus | null>;
  setForm: Setter<Syllabus>;
  setMessage: Setter<string | null>;
  setError: Setter<string | null>;
  setPageError: Setter<string | null>;
  setSaving: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useCoursePageActions({
  classId,
  form,
  hasCourseSnapshotRef,
  courseSnapshotClassIdRef,
  loadCourseDetails,
  clearCourseDetailState,
  handleAuthRequired,
  setClassId,
  setSyllabus,
  setForm,
  setMessage,
  setError,
  setPageError,
  setSaving,
  setAuthRequired,
  setLastLoadedAt
}: CoursePageActionsOptions) {
  const handleClassChange = useCallback(async (nextClassId: string) => {
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
  }, [loadCourseDetails, setClassId, setPageError]);

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
  }, [
    classId,
    clearCourseDetailState,
    courseSnapshotClassIdRef,
    form,
    handleAuthRequired,
    hasCourseSnapshotRef,
    setAuthRequired,
    setError,
    setForm,
    setLastLoadedAt,
    setMessage,
    setPageError,
    setSaving,
    setSyllabus
  ]);

  return {
    handleClassChange,
    handleSave
  };
}
