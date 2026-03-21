"use client";

import {
  useCallback,
  type FormEvent,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  ObserverCodeLoadResult,
  ObserverCodeMutationResponse,
  ProfileResponse,
  StudentProfileFormState
} from "./types";
import {
  buildProfileSavePayload,
  getStudentObserverCodeRequestMessage,
  getStudentProfileRequestMessage,
  getStudentProfileSaveMessage,
  mergeSavedProfileForm
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type StudentProfileActionsOptions = {
  form: StudentProfileFormState;
  observerCode: string;
  clearObserverCopyTimeout: () => void;
  observerCopyTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  hasProfileSnapshotRef: MutableRefObject<boolean>;
  hasObserverSnapshotRef: MutableRefObject<boolean>;
  handleAuthRequired: () => void;
  loadObserverCode: (options?: { showBusy?: boolean }) => Promise<ObserverCodeLoadResult>;
  setForm: Setter<StudentProfileFormState>;
  setObserverCode: Setter<string>;
  setObserverCopied: Setter<boolean>;
  setObserverMessage: Setter<string | null>;
  setObserverError: Setter<string | null>;
  setSaving: Setter<boolean>;
  setRegeneratingObserverCode: Setter<boolean>;
  setMessage: Setter<string | null>;
  setError: Setter<string | null>;
  setPageError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
  setProfileReady: Setter<boolean>;
};

export function useStudentProfileActions({
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
}: StudentProfileActionsOptions) {
  const handleSave = useCallback(async (event: FormEvent<HTMLFormElement>) => {
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
        const message = getStudentProfileSaveMessage(observerCode, observerLoadResult);
        if (message) {
          setMessage(message);
        }
        return;
      }

      const message = getStudentProfileSaveMessage(observerCode);
      if (message) {
        setMessage(message);
      }
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        setError(getStudentProfileRequestMessage(nextError, "保存失败"));
      }
    } finally {
      setSaving(false);
    }
  }, [
    form,
    handleAuthRequired,
    hasProfileSnapshotRef,
    loadObserverCode,
    observerCode,
    setAuthRequired,
    setError,
    setForm,
    setMessage,
    setPageError,
    setProfileReady,
    setSaving
  ]);

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
  }, [
    clearObserverCopyTimeout,
    observerCode,
    observerCopyTimeoutRef,
    setObserverCopied,
    setObserverMessage
  ]);

  const refreshObserverCode = useCallback(async () => {
    setObserverMessage(null);
    setObserverError(null);
    await loadObserverCode({ showBusy: true });
  }, [loadObserverCode, setObserverError, setObserverMessage]);

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
  }, [
    handleAuthRequired,
    hasObserverSnapshotRef,
    setObserverCode,
    setObserverCopied,
    setObserverError,
    setObserverMessage,
    setRegeneratingObserverCode
  ]);

  return {
    handleSave,
    copyObserverCode,
    refreshObserverCode,
    regenerateObserverCode
  };
}
