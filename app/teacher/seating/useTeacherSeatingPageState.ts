"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AiPreviewResponse, AiOptions, SeatPlan, TeacherClassItem, TeacherSeatingStudent } from "./types";
import {
  DEFAULT_AI_OPTIONS,
  getTeacherSeatingDerivedState,
  pruneTeacherSeatingLockedSeatIds,
  removeTeacherSeatingClassSnapshot,
  toggleTeacherSeatingLockedSeatIds,
  updateTeacherSeatingPlanLayout,
  updateTeacherSeatingSeatAssignment
} from "./utils";

export function useTeacherSeatingPageState() {
  const initialLoadStartedRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const classesRef = useRef<TeacherClassItem[]>([]);
  const classIdRef = useRef("");

  const [classes, setClasses] = useState<TeacherClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<TeacherSeatingStudent[]>([]);
  const [draftPlan, setDraftPlan] = useState<SeatPlan | null>(null);
  const [savedPlan, setSavedPlan] = useState<SeatPlan | null>(null);
  const [preview, setPreview] = useState<AiPreviewResponse["data"] | null>(null);
  const [aiOptions, setAiOptions] = useState<AiOptions>(DEFAULT_AI_OPTIONS);
  const [keepLockedSeats, setKeepLockedSeats] = useState(true);
  const [lockedSeatIds, setLockedSeatIds] = useState<string[]>([]);
  const [layoutRows, setLayoutRows] = useState(4);
  const [layoutColumns, setLayoutColumns] = useState(6);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [followUpMessage, setFollowUpMessage] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [includeParentsInReminder, setIncludeParentsInReminder] = useState(false);
  const [followUpActing, setFollowUpActing] = useState<null | "remind" | "copy">(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const syncClasses = useCallback((nextClasses: TeacherClassItem[]) => {
    classesRef.current = nextClasses;
    setClasses(nextClasses);
  }, []);

  const applyClassId = useCallback((nextClassId: string) => {
    classIdRef.current = nextClassId;
    setClassId(nextClassId);
  }, []);

  const clearSeatingState = useCallback(() => {
    setStudents([]);
    setDraftPlan(null);
    setSavedPlan(null);
    setPreview(null);
    setLockedSeatIds([]);
    setLayoutRows(4);
    setLayoutColumns(6);
    setSaveMessage(null);
    setSaveError(null);
    setFollowUpMessage(null);
    setFollowUpError(null);
  }, []);

  const clearCurrentClassState = useCallback(
    (nextClasses: TeacherClassItem[], nextClassId: string) => {
      clearSeatingState();
      syncClasses(nextClasses);
      applyClassId(nextClassId);
      setAuthRequired(false);
    },
    [applyClassId, clearSeatingState, syncClasses]
  );

  const handleAuthRequired = useCallback(() => {
    clearSeatingState();
    syncClasses([]);
    applyClassId("");
    setLastLoadedAt(null);
    setAuthRequired(true);
  }, [applyClassId, clearSeatingState, syncClasses]);

  const handleMissingClassSelection = useCallback(
    (missingClassId: string) => {
      const nextState = removeTeacherSeatingClassSnapshot(
        classesRef.current,
        missingClassId
      );
      clearCurrentClassState(nextState.classes, nextState.classId);
      return nextState.classId;
    },
    [clearCurrentClassState]
  );

  useEffect(() => {
    setLockedSeatIds((previous) =>
      pruneTeacherSeatingLockedSeatIds(previous, draftPlan)
    );
  }, [draftPlan]);

  const derivedState = useMemo(
    () =>
      getTeacherSeatingDerivedState({
        classes,
        classId,
        students,
        draftPlan,
        savedPlan,
        preview,
        lockedSeatIds
      }),
    [classId, classes, draftPlan, lockedSeatIds, preview, savedPlan, students]
  );

  const toggleLockedSeat = useCallback((seatId: string) => {
    setLockedSeatIds((previous) =>
      toggleTeacherSeatingLockedSeatIds(previous, seatId)
    );
    setSaveMessage(null);
  }, []);

  const handleLayoutChange = useCallback(
    (type: "rows" | "columns", value: number) => {
      if (!draftPlan) {
        return;
      }

      const nextRows = type === "rows" ? value : layoutRows;
      const nextColumns = type === "columns" ? value : layoutColumns;
      setLayoutRows(nextRows);
      setLayoutColumns(nextColumns);
      setDraftPlan((previous) =>
        updateTeacherSeatingPlanLayout(previous, nextRows, nextColumns)
      );
      setPreview(null);
      setSaveMessage(null);
    },
    [draftPlan, layoutColumns, layoutRows]
  );

  const handleSeatAssignmentChange = useCallback(
    (seatId: string, nextStudentId?: string) => {
      setDraftPlan((previous) =>
        updateTeacherSeatingSeatAssignment(previous, seatId, nextStudentId)
      );
      if (!nextStudentId) {
        setLockedSeatIds((previous) =>
          previous.filter((item) => item !== seatId)
        );
      }
      setSaveMessage(null);
    },
    []
  );

  return {
    initialLoadStartedRef,
    loadRequestIdRef,
    classesRef,
    classIdRef,
    classes,
    classId,
    students,
    draftPlan,
    savedPlan,
    preview,
    aiOptions,
    keepLockedSeats,
    lockedSeatIds,
    layoutRows,
    layoutColumns,
    loading,
    refreshing,
    previewing,
    saving,
    authRequired,
    pageError,
    saveMessage,
    saveError,
    followUpMessage,
    followUpError,
    includeParentsInReminder,
    followUpActing,
    lastLoadedAt,
    setStudents,
    setDraftPlan,
    setSavedPlan,
    setPreview,
    setAiOptions,
    setKeepLockedSeats,
    setLockedSeatIds,
    setLayoutRows,
    setLayoutColumns,
    setLoading,
    setRefreshing,
    setPreviewing,
    setSaving,
    setAuthRequired,
    setPageError,
    setSaveMessage,
    setSaveError,
    setFollowUpMessage,
    setFollowUpError,
    setIncludeParentsInReminder,
    setFollowUpActing,
    setLastLoadedAt,
    syncClasses,
    applyClassId,
    clearSeatingState,
    clearCurrentClassState,
    handleAuthRequired,
    handleMissingClassSelection,
    toggleLockedSeat,
    handleLayoutChange,
    handleSeatAssignmentChange,
    ...derivedState
  };
}
