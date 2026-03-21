"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  ObserverCodeLoadResult,
  ObserverCodeResponse,
  ProfileResponse,
  StudentProfileFormState
} from "./types";
import {
  buildProfileFormState,
  getStudentObserverCodeRequestMessage,
  getStudentProfileRequestMessage
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type StudentProfileLoadersOptions = {
  profileRequestIdRef: MutableRefObject<number>;
  observerRequestIdRef: MutableRefObject<number>;
  hasProfileSnapshotRef: MutableRefObject<boolean>;
  hasObserverSnapshotRef: MutableRefObject<boolean>;
  clearProfileState: () => void;
  handleAuthRequired: () => void;
  setForm: Setter<StudentProfileFormState>;
  setObserverCode: Setter<string>;
  setObserverError: Setter<string | null>;
  setLoading: Setter<boolean>;
  setLoadingObserverCode: Setter<boolean>;
  setPageError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
  setProfileReady: Setter<boolean>;
};

export function useStudentProfileLoaders({
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
}: StudentProfileLoadersOptions) {
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
      }
      if (!hasObserverSnapshotRef.current) {
        setObserverCode("");
      }
      setObserverError(getStudentObserverCodeRequestMessage(nextError, "加载家长绑定码失败"));
      return "failed";
    } finally {
      if (options?.showBusy && requestId === observerRequestIdRef.current) {
        setLoadingObserverCode(false);
      }
    }
  }, [
    handleAuthRequired,
    hasObserverSnapshotRef,
    observerRequestIdRef,
    setLoadingObserverCode,
    setObserverCode,
    setObserverError
  ]);

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
  }, [
    clearProfileState,
    handleAuthRequired,
    hasObserverSnapshotRef,
    hasProfileSnapshotRef,
    profileRequestIdRef,
    setAuthRequired,
    setForm,
    setLoading,
    setObserverCode,
    setObserverError,
    setPageError,
    setProfileReady
  ]);

  return {
    loadObserverCode,
    loadProfile
  };
}
