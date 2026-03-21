"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateStudentPersonaCompleteness } from "@/lib/student-persona-options";
import type { StudentProfileFormState } from "./types";
import {
  createInitialStudentProfileForm,
  toggleStudentProfileSubject
} from "./utils";
import { useStudentProfileActions } from "./useStudentProfileActions";
import { useStudentProfileLoaders } from "./useStudentProfileLoaders";

export function useStudentProfilePage() {
  const profileRequestIdRef = useRef(0);
  const observerRequestIdRef = useRef(0);
  const hasProfileSnapshotRef = useRef(false);
  const hasObserverSnapshotRef = useRef(false);
  const observerCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState<StudentProfileFormState>(createInitialStudentProfileForm);
  const [observerCode, setObserverCode] = useState("");
  const [observerCopied, setObserverCopied] = useState(false);
  const [observerMessage, setObserverMessage] = useState<string | null>(null);
  const [observerError, setObserverError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingObserverCode, setLoadingObserverCode] = useState(false);
  const [regeneratingObserverCode, setRegeneratingObserverCode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  const clearObserverCopyTimeout = useCallback(() => {
    if (observerCopyTimeoutRef.current !== null) {
      clearTimeout(observerCopyTimeoutRef.current);
      observerCopyTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearObserverCopyTimeout, [clearObserverCopyTimeout]);

  const clearProfileState = useCallback(() => {
    hasProfileSnapshotRef.current = false;
    hasObserverSnapshotRef.current = false;
    clearObserverCopyTimeout();
    setForm(createInitialStudentProfileForm());
    setObserverCode("");
    setObserverCopied(false);
    setObserverMessage(null);
    setObserverError(null);
    setMessage(null);
    setError(null);
    setPageError(null);
    setProfileReady(false);
  }, [clearObserverCopyTimeout]);

  const handleAuthRequired = useCallback(() => {
    clearProfileState();
    setAuthRequired(true);
  }, [clearProfileState]);

  const personaCompleteness = useMemo(
    () =>
      calculateStudentPersonaCompleteness({
        preferredName: form.preferredName,
        gender: form.gender || undefined,
        heightCm: form.heightCm.trim() ? Number(form.heightCm) : undefined,
        eyesightLevel: form.eyesightLevel || undefined,
        seatPreference: form.seatPreference || undefined,
        personality: form.personality || undefined,
        focusSupport: form.focusSupport || undefined,
        peerSupport: form.peerSupport || undefined,
        strengths: form.strengths,
        supportNotes: form.supportNotes
      }),
    [form]
  );

  const { loadObserverCode, loadProfile } = useStudentProfileLoaders({
    profileRequestIdRef,
    observerRequestIdRef,
    hasProfileSnapshotRef,
    hasObserverSnapshotRef,
    clearProfileState,
    handleAuthRequired,
    setForm,
    setObserverCode,
    setObserverError,
    setLoading,
    setLoadingObserverCode,
    setPageError,
    setAuthRequired,
    setProfileReady
  });

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const updateForm = useCallback(<K extends keyof StudentProfileFormState>(key: K, value: StudentProfileFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSubject = useCallback((subject: string) => {
    setForm((prev) => ({
      ...prev,
      subjects: toggleStudentProfileSubject(prev.subjects, subject)
    }));
  }, []);

  const {
    handleSave,
    copyObserverCode,
    refreshObserverCode,
    regenerateObserverCode
  } = useStudentProfileActions({
    form,
    observerCode,
    clearObserverCopyTimeout,
    observerCopyTimeoutRef,
    hasProfileSnapshotRef,
    hasObserverSnapshotRef,
    handleAuthRequired,
    loadObserverCode,
    setForm,
    setObserverCode,
    setObserverCopied,
    setObserverMessage,
    setObserverError,
    setSaving,
    setRegeneratingObserverCode,
    setMessage,
    setError,
    setPageError,
    setAuthRequired,
    setProfileReady
  });

  return {
    form,
    observerCode,
    observerCopied,
    observerMessage,
    observerError,
    loading,
    saving,
    loadingObserverCode,
    regeneratingObserverCode,
    message,
    error,
    pageError,
    authRequired,
    profileReady,
    personaCompleteness,
    updateForm,
    toggleSubject,
    handleSave,
    copyObserverCode,
    reloadPage: loadProfile,
    refreshObserverCode,
    regenerateObserverCode
  };
}
