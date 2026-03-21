"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CourseClass, CourseSummary, Syllabus } from "./types";
import {
  createBlankSyllabus,
  normalizeSyllabus,
} from "./utils";
import { useCoursePageActions } from "./useCoursePageActions";
import { useCoursePageLoaders } from "./useCoursePageLoaders";

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

  const { loadCourseDetails, loadPage } = useCoursePageLoaders({
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
  });

  useEffect(() => {
    void loadPage("initial");
  }, [loadPage]);

  const handleFormChange = useCallback((field: keyof Syllabus, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const {
    handleClassChange,
    handleSave
  } = useCoursePageActions({
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
  });

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
