import { useCallback, useRef, useState } from "react";
import { useMathViewSettings } from "@/lib/math-view-settings";
import type { ExamDetail, LocalDraft, ReviewPack, SubmitResult } from "./types";
import { LOCAL_DRAFT_PREFIX } from "./utils";

type ExamEventCounters = {
  blurCountDelta: number;
  visibilityHiddenCountDelta: number;
};

export function useStudentExamDetailPageState(examId: string) {
  const [data, setData] = useState<ExamDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [clientStartedAt, setClientStartedAt] = useState<string | null>(null);
  const [pendingLocalSync, setPendingLocalSync] = useState(false);
  const [reviewPack, setReviewPack] = useState<ReviewPack | null>(null);
  const [reviewPackLoading, setReviewPackLoading] = useState(false);
  const [reviewPackError, setReviewPackError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [timeupTriggered, setTimeupTriggered] = useState(false);
  const mathView = useMathViewSettings("student-exam");
  const examEventRef = useRef<ExamEventCounters>({
    blurCountDelta: 0,
    visibilityHiddenCountDelta: 0
  });
  const hasReviewPackSnapshotRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultSectionRef = useRef<HTMLDivElement | null>(null);

  const localDraftKey = `${LOCAL_DRAFT_PREFIX}${examId}`;

  const readLocalDraft = useCallback((): LocalDraft | null => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(localDraftKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as LocalDraft;
      if (!parsed || typeof parsed !== "object" || !parsed.answers || typeof parsed.answers !== "object") {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [localDraftKey]);

  const writeLocalDraft = useCallback(
    (draft: LocalDraft) => {
      if (typeof window === "undefined") {
        return;
      }
      try {
        window.localStorage.setItem(localDraftKey, JSON.stringify(draft));
      } catch {
        // ignore localStorage write errors
      }
    },
    [localDraftKey]
  );

  const clearLocalDraft = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.removeItem(localDraftKey);
    } catch {
      // ignore localStorage removal errors
    }
  }, [localDraftKey]);

  const clearExamState = useCallback(() => {
    hasReviewPackSnapshotRef.current = false;
    examEventRef.current = { blurCountDelta: 0, visibilityHiddenCountDelta: 0 };
    clearLocalDraft();
    setData(null);
    setAnswers({});
    setDirty(false);
    setSavedAt(null);
    setResult(null);
    setLoadError(null);
    setActionError(null);
    setActionMessage(null);
    setSyncNotice(null);
    setClientStartedAt(null);
    setPendingLocalSync(false);
    setReviewPack(null);
    setReviewPackError(null);
    setTimeupTriggered(false);
  }, [clearLocalDraft]);

  const handleAuthRequired = useCallback(() => {
    clearExamState();
    setAuthRequired(true);
  }, [clearExamState]);

  return {
    data,
    answers,
    dirty,
    saving,
    savedAt,
    submitting,
    result,
    authRequired,
    pageLoading,
    loadError,
    actionError,
    actionMessage,
    online,
    syncNotice,
    clientStartedAt,
    pendingLocalSync,
    reviewPack,
    reviewPackLoading,
    reviewPackError,
    clock,
    timeupTriggered,
    mathView,
    examEventRef,
    hasReviewPackSnapshotRef,
    flushTimerRef,
    resultSectionRef,
    setData,
    setAnswers,
    setDirty,
    setSaving,
    setSavedAt,
    setSubmitting,
    setResult,
    setAuthRequired,
    setPageLoading,
    setLoadError,
    setActionError,
    setActionMessage,
    setOnline,
    setSyncNotice,
    setClientStartedAt,
    setPendingLocalSync,
    setReviewPack,
    setReviewPackLoading,
    setReviewPackError,
    setClock,
    setTimeupTriggered,
    readLocalDraft,
    writeLocalDraft,
    clearLocalDraft,
    clearExamState,
    handleAuthRequired
  };
}
