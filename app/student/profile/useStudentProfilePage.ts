"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import { calculateStudentPersonaCompleteness } from "@/lib/student-persona-options";
import type {
  ObserverCodeMutationResponse,
  ObserverCodeResponse,
  ProfileResponse,
  StudentProfileFormState
} from "./types";
import {
  buildProfileFormState,
  buildProfileSavePayload,
  getStudentObserverCodeRequestMessage,
  getStudentProfileRequestMessage,
  INITIAL_FORM,
  mergeSavedProfileForm
} from "./utils";

type ObserverCodeLoadResult = "ok" | "failed" | "auth";

export function useStudentProfilePage() {
  const profileRequestIdRef = useRef(0);
  const observerRequestIdRef = useRef(0);
  const hasProfileSnapshotRef = useRef(false);
  const hasObserverSnapshotRef = useRef(false);
  const [form, setForm] = useState<StudentProfileFormState>(INITIAL_FORM);
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
  const observerCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setForm({
      ...INITIAL_FORM,
      subjects: [...INITIAL_FORM.subjects]
    });
    setObserverCode("");
    setObserverCopied(false);
    setObserverMessage(null);
    setObserverError(null);
    setMessage(null);
    setError(null);
    setPageError(null);
    setProfileReady(false);
  }, []);

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

  const loadObserverCode = useCallback(async (options?: { showBusy?: boolean }): Promise<ObserverCodeLoadResult> => {
    const requestId = observerRequestIdRef.current + 1;
    observerRequestIdRef.current = requestId;
    if (options?.showBusy) {
      setLoadingObserverCode(true);
    }

    try {
      const payload = await requestJson<ObserverCodeResponse>("/api/student/observer-code");
      if (requestId !== observerRequestIdRef.current) {
        return "failed";
      }
      hasObserverSnapshotRef.current = true;
      setObserverCode(payload.data?.code ?? "");
      setObserverError(null);
      return "ok";
    } catch (nextError) {
      if (requestId !== observerRequestIdRef.current) {
        return "failed";
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return "auth";
      } else {
        if (!hasObserverSnapshotRef.current) {
          setObserverCode("");
        }
        setObserverError(getStudentObserverCodeRequestMessage(nextError, "加载家长绑定码失败"));
      }
      return "failed";
    } finally {
      if (options?.showBusy && requestId === observerRequestIdRef.current) {
        setLoadingObserverCode(false);
      }
    }
  }, [handleAuthRequired]);

  const loadProfile = useCallback(async () => {
    const requestId = profileRequestIdRef.current + 1;
    profileRequestIdRef.current = requestId;
    setLoading(true);
    setPageError(null);
    setObserverError(null);

    try {
      const [profileResult, observerResult] = await Promise.allSettled([
        requestJson<ProfileResponse>("/api/student/profile"),
        requestJson<ObserverCodeResponse>("/api/student/observer-code")
      ]);

      if (requestId !== profileRequestIdRef.current) {
        return;
      }

      const profileAuthError = profileResult.status === "rejected" && isAuthError(profileResult.reason);
      const observerAuthError = observerResult.status === "rejected" && isAuthError(observerResult.reason);
      if (profileAuthError || observerAuthError) {
        handleAuthRequired();
        return;
      }

      if (profileResult.status === "rejected") {
        if (!hasProfileSnapshotRef.current) {
          clearProfileState();
        }
        setAuthRequired(false);
        setPageError(getStudentProfileRequestMessage(profileResult.reason, "加载学生资料失败"));
        return;
      }

      hasProfileSnapshotRef.current = true;
      setForm(buildProfileFormState(profileResult.value.data));
      setProfileReady(true);
      setAuthRequired(false);

      if (observerResult.status === "fulfilled") {
        hasObserverSnapshotRef.current = true;
        setObserverCode(observerResult.value.data?.code ?? "");
        setObserverError(null);
      } else {
        if (!hasObserverSnapshotRef.current) {
          setObserverCode("");
        }
        setObserverError(getStudentObserverCodeRequestMessage(observerResult.reason, "加载家长绑定码失败"));
      }
    } catch (nextError) {
      if (requestId !== profileRequestIdRef.current) {
        return;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        if (!hasProfileSnapshotRef.current) {
          clearProfileState();
        }
        setAuthRequired(false);
        setPageError(getStudentProfileRequestMessage(nextError, "加载学生资料失败"));
      }
    } finally {
      if (requestId === profileRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [clearProfileState, handleAuthRequired]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const updateForm = useCallback(<K extends keyof StudentProfileFormState>(key: K, value: StudentProfileFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSubject = useCallback((subject: string) => {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((item) => item !== subject)
        : [...prev.subjects, subject]
    }));
  }, []);

  const handleSave = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSaving(true);
      setMessage(null);
      setError(null);

      try {
        const payload = await requestJson<ProfileResponse>("/api/student/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildProfileSavePayload(form))
        });

        hasProfileSnapshotRef.current = true;
        setForm((prev) => mergeSavedProfileForm(prev, payload.data));
        setProfileReady(true);
        setAuthRequired(false);
        setPageError(null);
        if (!observerCode) {
          const observerLoadResult = await loadObserverCode();
          if (observerLoadResult === "auth") {
            return;
          }
          setMessage(
            observerLoadResult === "ok"
              ? "已保存，老师端学期排座配置与个性化推荐会同步使用这些信息。"
              : "已保存，但家长绑定码同步失败，请稍后重试。"
          );
          return;
        }
        setMessage("已保存，老师端学期排座配置与个性化推荐会同步使用这些信息。");
      } catch (nextError) {
        if (isAuthError(nextError)) {
          handleAuthRequired();
        } else {
          setError(getStudentProfileRequestMessage(nextError, "保存失败"));
        }
      } finally {
        setSaving(false);
      }
    },
    [form, handleAuthRequired, loadObserverCode, observerCode]
  );

  const copyObserverCode = useCallback(async () => {
    if (!observerCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(observerCode);
      clearObserverCopyTimeout();
      setObserverCopied(true);
      setObserverMessage("已复制绑定码");
      observerCopyTimeoutRef.current = setTimeout(() => {
        setObserverCopied(false);
        observerCopyTimeoutRef.current = null;
      }, 2000);
    } catch {
      setObserverCopied(false);
      setObserverMessage("复制失败，请手动复制");
    }
  }, [clearObserverCopyTimeout, observerCode]);

  const refreshObserverCode = useCallback(async () => {
    setObserverMessage(null);
    setObserverError(null);
    await loadObserverCode({ showBusy: true });
  }, [loadObserverCode]);

  const regenerateObserverCode = useCallback(async () => {
    setObserverMessage(null);
    setObserverError(null);
    setRegeneratingObserverCode(true);

    try {
      const payload = await requestJson<ObserverCodeMutationResponse>("/api/student/observer-code", { method: "POST" });
      if (payload.data?.code) {
        hasObserverSnapshotRef.current = true;
        setObserverCode(payload.data.code);
        setObserverCopied(false);
        setObserverError(null);
        setObserverMessage("已生成新绑定码");
      } else {
        setObserverError("请先保存基础资料后再生成绑定码");
      }
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        setObserverError(getStudentObserverCodeRequestMessage(nextError, "生成绑定码失败"));
      }
    } finally {
      setRegeneratingObserverCode(false);
    }
  }, [handleAuthRequired]);

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
