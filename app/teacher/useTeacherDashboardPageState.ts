"use client";

import { useCallback, useMemo, useRef, useState, type SetStateAction } from "react";
import type { CourseModule } from "@/lib/modules";
import type {
  AlertImpactData,
  AssignmentFormState,
  AssignmentItem,
  ClassFormState,
  ClassItem,
  KnowledgePoint,
  StudentFormState,
  TeacherInsightsData,
  TeacherJoinRequest
} from "./types";
import {
  getTeacherDashboardDerivedState,
  removeTeacherDashboardAlertImpact,
  removeTeacherDashboardClassSnapshot,
  removeTeacherDashboardJoinRequest
} from "./dashboard-utils";

export function useTeacherDashboardPageState() {
  const classesRef = useRef<ClassItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [insights, setInsights] = useState<TeacherInsightsData | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageReady, setPageReady] = useState(false);
  const [staleDataError, setStaleDataError] = useState<string | null>(null);
  const [knowledgePointsNotice, setKnowledgePointsNotice] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<TeacherJoinRequest[]>([]);
  const [assignmentLoadError, setAssignmentLoadError] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState<string | null>(null);
  const [actingAlertKey, setActingAlertKey] = useState<string | null>(null);
  const [impactByAlertId, setImpactByAlertId] = useState<Record<string, AlertImpactData>>({});
  const [loadingImpactId, setLoadingImpactId] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const [classForm, setClassForm] = useState<ClassFormState>({
    name: "",
    subject: "math",
    grade: "4"
  });
  const [studentForm, setStudentForm] = useState<StudentFormState>({
    classId: "",
    email: ""
  });
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>({
    classId: "",
    moduleId: "",
    title: "",
    description: "",
    dueDate: "",
    questionCount: 10,
    knowledgePointId: "",
    mode: "bank",
    difficulty: "medium",
    questionType: "choice",
    submissionType: "quiz",
    maxUploads: 3,
    gradingFocus: ""
  });

  const applyClasses = useCallback((nextClasses: SetStateAction<ClassItem[]>) => {
    setClasses((previous) => {
      const resolvedClasses =
        typeof nextClasses === "function"
          ? (nextClasses as (previousClasses: ClassItem[]) => ClassItem[])(previous)
          : nextClasses;
      classesRef.current = resolvedClasses;
      return resolvedClasses;
    });
  }, []);

  const handleLoaded = useCallback(() => {
    setLastLoadedAt(new Date().toISOString());
  }, []);

  const updateClassForm = useCallback((patch: Partial<ClassFormState>) => {
    setClassForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateStudentForm = useCallback((patch: Partial<StudentFormState>) => {
    setStudentForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateAssignmentForm = useCallback((patch: Partial<AssignmentFormState>) => {
    setAssignmentForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const removeClassFromDashboard = useCallback((classId: string) => {
    const { classes: nextClasses, nextClassId } = removeTeacherDashboardClassSnapshot(
      classesRef.current,
      classId
    );

    applyClasses(nextClasses);
    setAssignments((prev) => prev.filter((item) => item.classId !== classId));
    setJoinRequests((prev) => prev.filter((item) => item.classId !== classId));
    setModules([]);
    setStudentForm((prev) => (prev.classId === classId ? { ...prev, classId: nextClassId } : prev));
    setAssignmentForm((prev) =>
      prev.classId === classId
        ? {
            ...prev,
            classId: nextClassId,
            moduleId: "",
            knowledgePointId: ""
          }
        : prev
    );
  }, [applyClasses]);

  const removeJoinRequestFromDashboard = useCallback((requestId: string) => {
    setJoinRequests((prev) => removeTeacherDashboardJoinRequest(prev, requestId));
  }, []);

  const removeAlertImpact = useCallback((alertId: string) => {
    setImpactByAlertId((prev) => removeTeacherDashboardAlertImpact(prev, alertId));
  }, []);

  const derivedState = useMemo(
    () =>
      getTeacherDashboardDerivedState({
        classes,
        assignments,
        knowledgePoints,
        assignmentClassId: assignmentForm.classId,
        insights,
        joinRequests
      }),
    [assignmentForm.classId, assignments, classes, insights, joinRequests, knowledgePoints]
  );

  return {
    classesRef,
    classes,
    assignments,
    knowledgePoints,
    modules,
    insights,
    unauthorized,
    loading,
    pageError,
    pageReady,
    staleDataError,
    knowledgePointsNotice,
    message,
    error,
    joinRequests,
    assignmentLoadError,
    assignmentError,
    assignmentMessage,
    acknowledgingAlertId,
    actingAlertKey,
    impactByAlertId,
    loadingImpactId,
    lastLoadedAt,
    classForm,
    studentForm,
    assignmentForm,
    setAssignments,
    setKnowledgePoints,
    setModules,
    setInsights,
    setUnauthorized,
    setLoading,
    setPageError,
    setPageReady,
    setStaleDataError,
    setKnowledgePointsNotice,
    setMessage,
    setError,
    setJoinRequests,
    setAssignmentLoadError,
    setAssignmentError,
    setAssignmentMessage,
    setAcknowledgingAlertId,
    setActingAlertKey,
    setImpactByAlertId,
    setLoadingImpactId,
    setLastLoadedAt,
    setClassForm,
    setStudentForm,
    setAssignmentForm,
    applyClasses,
    handleLoaded,
    updateClassForm,
    updateStudentForm,
    updateAssignmentForm,
    removeClassFromDashboard,
    removeJoinRequestFromDashboard,
    removeAlertImpact,
    ...derivedState
  };
}
