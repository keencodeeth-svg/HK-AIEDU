import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AssignmentNotifyTarget,
  AssignmentStudentFilter,
  RubricItem,
  TeacherAssignmentDetailData
} from "./types";
import { getTeacherAssignmentDetailDerivedState } from "./utils";

export function useTeacherAssignmentDetailPageState() {
  const loadRequestIdRef = useRef(0);
  const rubricRequestIdRef = useRef(0);
  const notifyRequestIdRef = useRef(0);
  const saveRubricsRequestIdRef = useRef(0);
  const hasDetailSnapshotRef = useRef(false);
  const rubricsReadyRef = useRef(false);

  const [data, setData] = useState<TeacherAssignmentDetailData | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<AssignmentNotifyTarget>("missing");
  const [threshold, setThreshold] = useState(60);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [rubrics, setRubrics] = useState<RubricItem[]>([]);
  const [rubricsLoading, setRubricsLoading] = useState(false);
  const [rubricsReady, setRubricsReady] = useState(false);
  const [rubricLoadError, setRubricLoadError] = useState<string | null>(null);
  const [rubricMessage, setRubricMessage] = useState<string | null>(null);
  const [rubricError, setRubricError] = useState<string | null>(null);
  const [rubricSaving, setRubricSaving] = useState(false);
  const [studentFilter, setStudentFilter] = useState<AssignmentStudentFilter>("all");
  const [studentKeyword, setStudentKeyword] = useState("");
  const now = Date.now();

  useEffect(() => {
    rubricsReadyRef.current = rubricsReady;
  }, [rubricsReady]);

  const clearAssignmentDetailState = useCallback(() => {
    hasDetailSnapshotRef.current = false;
    rubricsReadyRef.current = false;
    setData(null);
    setNotifySuccess(null);
    setNotifyError(null);
    setRubrics([]);
    setRubricsReady(false);
    setRubricLoadError(null);
    setRubricMessage(null);
    setRubricError(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    rubricRequestIdRef.current += 1;
    notifyRequestIdRef.current += 1;
    saveRubricsRequestIdRef.current += 1;
    clearAssignmentDetailState();
    setLoading(false);
    setRubricsLoading(false);
    setNotifyLoading(false);
    setRubricSaving(false);
    setLoadError(null);
    setAuthRequired(true);
  }, [clearAssignmentDetailState]);

  const derivedState = useMemo(
    () =>
      getTeacherAssignmentDetailDerivedState({
        data,
        notifyTarget,
        threshold,
        studentFilter,
        studentKeyword,
        now
      }),
    [data, notifyTarget, now, studentFilter, studentKeyword, threshold]
  );

  return {
    loadRequestIdRef,
    rubricRequestIdRef,
    notifyRequestIdRef,
    saveRubricsRequestIdRef,
    hasDetailSnapshotRef,
    rubricsReadyRef,
    data,
    authRequired,
    loading,
    loadError,
    notifyTarget,
    threshold,
    notifyMessage,
    notifyLoading,
    notifySuccess,
    notifyError,
    rubrics,
    rubricsLoading,
    rubricsReady,
    rubricLoadError,
    rubricMessage,
    rubricError,
    rubricSaving,
    studentFilter,
    studentKeyword,
    now,
    assignmentOverdue: derivedState.assignmentOverdue,
    completedStudents: derivedState.completedStudents,
    pendingStudents: derivedState.pendingStudents,
    reviewReadyStudents: derivedState.reviewReadyStudents,
    scoredStudents: derivedState.scoredStudents,
    lowScoreStudents: derivedState.lowScoreStudents,
    latestCompletedStudent: derivedState.latestCompletedStudent,
    completionRate: derivedState.completionRate,
    averagePercent: derivedState.averagePercent,
    notifyPreviewStudents: derivedState.notifyPreviewStudents,
    hasStudentFilters: derivedState.hasStudentFilters,
    filteredStudents: derivedState.filteredStudents,
    setData,
    setAuthRequired,
    setLoading,
    setLoadError,
    setNotifyTarget,
    setThreshold,
    setNotifyMessage,
    setNotifyLoading,
    setNotifySuccess,
    setNotifyError,
    setRubrics,
    setRubricsLoading,
    setRubricsReady,
    setRubricLoadError,
    setRubricMessage,
    setRubricError,
    setRubricSaving,
    setStudentFilter,
    setStudentKeyword,
    clearAssignmentDetailState,
    handleAuthRequired
  };
}
