"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClassItem,
  KnowledgePoint,
  OutlineFormState,
  OutlineResult,
  PaperFormState,
  PaperGenerationResult,
  QuestionCheckFormState,
  QuestionCheckResult,
  ReviewPackDispatchQuality,
  ReviewPackFailedItem,
  ReviewPackRelaxedItem,
  ReviewPackResult,
  WrongReviewFormState,
  WrongReviewResult
} from "./types";
import {
  getTeacherAiToolsDerivedState,
  hasTeacherAiToolsClassChanged,
  pruneTeacherAiToolsKnowledgePointIds,
  resetTeacherAiToolsOutlineFormScope,
  resetTeacherAiToolsPaperFormScope,
  resetTeacherAiToolsWrongFormScope,
  resolveTeacherAiToolsClassId
} from "./utils";

const TEACHER_AI_TOOLS_GUIDE_KEY = "guide:teacher-ai-tools:v1";

export function useTeacherAiToolsPageState() {
  const bootstrapRequestIdRef = useRef(0);
  const hasClassesSnapshotRef = useRef(false);
  const hasKnowledgePointsSnapshotRef = useRef(false);
  const previousPaperClassIdRef = useRef("");
  const previousOutlineClassIdRef = useRef("");
  const previousWrongClassIdRef = useRef("");

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [bootstrapNotice, setBootstrapNotice] = useState<string | null>(null);
  const [knowledgePointsNotice, setKnowledgePointsNotice] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [paperForm, setPaperForm] = useState<PaperFormState>({
    classId: "",
    knowledgePointIds: [],
    difficulty: "all",
    questionType: "all",
    durationMinutes: 40,
    questionCount: 0,
    mode: "ai",
    includeIsolated: false
  });
  const [paperResult, setPaperResult] = useState<PaperGenerationResult | null>(null);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [paperErrorSuggestions, setPaperErrorSuggestions] = useState<string[]>([]);
  const [outlineForm, setOutlineForm] = useState<OutlineFormState>({
    classId: "",
    topic: "",
    knowledgePointIds: []
  });
  const [outlineResult, setOutlineResult] = useState<OutlineResult | null>(null);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [wrongForm, setWrongForm] = useState<WrongReviewFormState>({
    classId: "",
    rangeDays: 7
  });
  const [wrongResult, setWrongResult] = useState<WrongReviewResult | null>(null);
  const [wrongError, setWrongError] = useState<string | null>(null);
  const [reviewPackResult, setReviewPackResult] = useState<ReviewPackResult | null>(null);
  const [reviewPackError, setReviewPackError] = useState<string | null>(null);
  const [reviewPackAssigningId, setReviewPackAssigningId] = useState<string | null>(null);
  const [reviewPackAssigningAll, setReviewPackAssigningAll] = useState(false);
  const [reviewPackAssignMessage, setReviewPackAssignMessage] = useState<string | null>(null);
  const [reviewPackAssignError, setReviewPackAssignError] = useState<string | null>(null);
  const [reviewPackDispatchIncludeIsolated, setReviewPackDispatchIncludeIsolated] = useState(false);
  const [reviewPackDispatchQuality, setReviewPackDispatchQuality] =
    useState<ReviewPackDispatchQuality | null>(null);
  const [reviewPackFailedItems, setReviewPackFailedItems] = useState<ReviewPackFailedItem[]>([]);
  const [reviewPackRelaxedItems, setReviewPackRelaxedItems] = useState<ReviewPackRelaxedItem[]>([]);
  const [reviewPackRetryingFailed, setReviewPackRetryingFailed] = useState(false);
  const [showGuideCard, setShowGuideCard] = useState(true);
  const [paperAutoFixing, setPaperAutoFixing] = useState(false);
  const [paperAutoFixHint, setPaperAutoFixHint] = useState<string | null>(null);
  const [checkForm, setCheckForm] = useState<QuestionCheckFormState>({
    questionId: "",
    stem: "",
    options: ["", "", "", ""],
    answer: "",
    explanation: ""
  });
  const [checkResult, setCheckResult] = useState<QuestionCheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetPaperScope = useCallback((nextClassId = "") => {
    setPaperForm((prev) => resetTeacherAiToolsPaperFormScope(prev, nextClassId));
    setPaperResult(null);
    setPaperError(null);
    setPaperErrorSuggestions([]);
    setPaperAutoFixHint(null);
  }, []);

  const resetOutlineScope = useCallback((nextClassId = "") => {
    setOutlineForm((prev) => resetTeacherAiToolsOutlineFormScope(prev, nextClassId));
    setOutlineResult(null);
    setOutlineError(null);
  }, []);

  const resetWrongScope = useCallback((nextClassId = "") => {
    setWrongForm((prev) => resetTeacherAiToolsWrongFormScope(prev, nextClassId));
    setWrongResult(null);
    setWrongError(null);
    setReviewPackResult(null);
    setReviewPackError(null);
    setReviewPackAssigningId(null);
    setReviewPackAssigningAll(false);
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);
    setReviewPackDispatchQuality(null);
    setReviewPackFailedItems([]);
    setReviewPackRelaxedItems([]);
    setReviewPackRetryingFailed(false);
  }, []);

  const handleAuthRequired = useCallback(() => {
    hasClassesSnapshotRef.current = false;
    hasKnowledgePointsSnapshotRef.current = false;
    previousPaperClassIdRef.current = "";
    previousOutlineClassIdRef.current = "";
    previousWrongClassIdRef.current = "";

    setClasses([]);
    setKnowledgePoints([]);
    resetPaperScope("");
    resetOutlineScope("");
    resetWrongScope("");
    setCheckResult(null);
    setCheckError(null);
    setPageReady(false);
    setPageError(null);
    setBootstrapNotice(null);
    setKnowledgePointsNotice(null);
    setLastLoadedAt(null);
    setAuthRequired(true);
  }, [resetOutlineScope, resetPaperScope, resetWrongScope]);

  const derivedState = useMemo(
    () =>
      getTeacherAiToolsDerivedState({
        classes,
        knowledgePoints,
        paperForm,
        outlineForm,
        checkForm
      }),
    [checkForm, classes, knowledgePoints, outlineForm, paperForm]
  );

  useEffect(() => {
    try {
      const hidden = window.localStorage.getItem(TEACHER_AI_TOOLS_GUIDE_KEY) === "hidden";
      setShowGuideCard(!hidden);
    } catch {
      setShowGuideCard(true);
    }
  }, []);

  useEffect(() => {
    const nextPaperClassId = resolveTeacherAiToolsClassId(paperForm.classId, classes);
    if (nextPaperClassId !== paperForm.classId) {
      resetPaperScope(nextPaperClassId);
    }

    const nextOutlineClassId = resolveTeacherAiToolsClassId(outlineForm.classId, classes);
    if (nextOutlineClassId !== outlineForm.classId) {
      resetOutlineScope(nextOutlineClassId);
    }

    const nextWrongClassId = resolveTeacherAiToolsClassId(wrongForm.classId, classes);
    if (nextWrongClassId !== wrongForm.classId) {
      resetWrongScope(nextWrongClassId);
    }
  }, [
    classes,
    outlineForm.classId,
    paperForm.classId,
    resetOutlineScope,
    resetPaperScope,
    resetWrongScope,
    wrongForm.classId
  ]);

  useEffect(() => {
    if (hasTeacherAiToolsClassChanged(previousPaperClassIdRef.current, paperForm.classId)) {
      resetPaperScope(paperForm.classId);
    }
    previousPaperClassIdRef.current = paperForm.classId;
  }, [paperForm.classId, resetPaperScope]);

  useEffect(() => {
    setPaperForm((prev) => {
      const nextKnowledgePointIds = pruneTeacherAiToolsKnowledgePointIds(
        prev.knowledgePointIds,
        derivedState.paperPointIdSet
      );
      return nextKnowledgePointIds.length === prev.knowledgePointIds.length
        ? prev
        : { ...prev, knowledgePointIds: nextKnowledgePointIds };
    });
  }, [derivedState.paperPointIdSet]);

  useEffect(() => {
    if (hasTeacherAiToolsClassChanged(previousOutlineClassIdRef.current, outlineForm.classId)) {
      resetOutlineScope(outlineForm.classId);
    }
    previousOutlineClassIdRef.current = outlineForm.classId;
  }, [outlineForm.classId, resetOutlineScope]);

  useEffect(() => {
    setOutlineForm((prev) => {
      const nextKnowledgePointIds = pruneTeacherAiToolsKnowledgePointIds(
        prev.knowledgePointIds,
        derivedState.outlinePointIdSet
      );
      return nextKnowledgePointIds.length === prev.knowledgePointIds.length
        ? prev
        : { ...prev, knowledgePointIds: nextKnowledgePointIds };
    });
  }, [derivedState.outlinePointIdSet]);

  useEffect(() => {
    if (hasTeacherAiToolsClassChanged(previousWrongClassIdRef.current, wrongForm.classId)) {
      resetWrongScope(wrongForm.classId);
    }
    previousWrongClassIdRef.current = wrongForm.classId;
  }, [resetWrongScope, wrongForm.classId]);

  const hideGuideCard = useCallback(() => {
    setShowGuideCard(false);
    try {
      window.localStorage.setItem(TEACHER_AI_TOOLS_GUIDE_KEY, "hidden");
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const showGuideAgain = useCallback(() => {
    setShowGuideCard(true);
    try {
      window.localStorage.removeItem(TEACHER_AI_TOOLS_GUIDE_KEY);
    } catch {
      // ignore localStorage errors
    }
  }, []);

  return {
    bootstrapRequestIdRef,
    hasClassesSnapshotRef,
    hasKnowledgePointsSnapshotRef,
    classes,
    knowledgePoints,
    authRequired,
    pageLoading,
    pageReady,
    pageError,
    bootstrapNotice,
    knowledgePointsNotice,
    lastLoadedAt,
    paperForm,
    paperResult,
    paperError,
    paperErrorSuggestions,
    outlineForm,
    outlineResult,
    outlineError,
    wrongForm,
    wrongResult,
    wrongError,
    reviewPackResult,
    reviewPackError,
    reviewPackAssigningId,
    reviewPackAssigningAll,
    reviewPackAssignMessage,
    reviewPackAssignError,
    reviewPackDispatchIncludeIsolated,
    reviewPackDispatchQuality,
    reviewPackFailedItems,
    reviewPackRelaxedItems,
    reviewPackRetryingFailed,
    showGuideCard,
    paperAutoFixing,
    paperAutoFixHint,
    checkForm,
    checkResult,
    checkError,
    loading,
    paperPoints: derivedState.paperPoints,
    outlinePoints: derivedState.outlinePoints,
    checkPreviewOptions: derivedState.checkPreviewOptions,
    hasCheckPreview: derivedState.hasCheckPreview,
    setClasses,
    setKnowledgePoints,
    setAuthRequired,
    setPageLoading,
    setPageReady,
    setPageError,
    setBootstrapNotice,
    setKnowledgePointsNotice,
    setLastLoadedAt,
    setPaperForm,
    setPaperResult,
    setPaperError,
    setPaperErrorSuggestions,
    setOutlineForm,
    setOutlineResult,
    setOutlineError,
    setWrongForm,
    setWrongResult,
    setWrongError,
    setReviewPackResult,
    setReviewPackError,
    setReviewPackAssigningId,
    setReviewPackAssigningAll,
    setReviewPackAssignMessage,
    setReviewPackAssignError,
    setReviewPackDispatchIncludeIsolated,
    setReviewPackDispatchQuality,
    setReviewPackFailedItems,
    setReviewPackRelaxedItems,
    setReviewPackRetryingFailed,
    setShowGuideCard,
    setPaperAutoFixing,
    setPaperAutoFixHint,
    setCheckForm,
    setCheckResult,
    setCheckError,
    setLoading,
    resetPaperScope,
    resetOutlineScope,
    resetWrongScope,
    handleAuthRequired,
    hideGuideCard,
    showGuideAgain
  };
}
