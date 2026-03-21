"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  AuthMeResponse,
  ClassListResponse,
  CourseFile,
  FilesClassItem,
  FilesListResponse,
  FilesLoadResult
} from "./types";
import {
  getFilesNoStoreRequestInit,
  getFilesBootstrapRequestMessage,
  getFilesListRequestMessage,
  isMissingFilesClassError,
  resolveFilesStateAfterMissingClass
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;
type SyncClassesState = (nextClasses: FilesClassItem[], preferredClassId?: string) => string;

type FilesLoadOptions = {
  clearBeforeLoad?: boolean;
  clearError?: boolean;
  preserveSnapshot?: boolean;
};

type FilesPageLoadersOptions = {
  bootstrapRequestIdRef: MutableRefObject<number>;
  filesRequestIdRef: MutableRefObject<number>;
  classIdRef: MutableRefObject<string>;
  classesRef: MutableRefObject<FilesClassItem[]>;
  hasRoleSnapshotRef: MutableRefObject<boolean>;
  hasClassesSnapshotRef: MutableRefObject<boolean>;
  hasFilesSnapshotRef: MutableRefObject<boolean>;
  filesSnapshotClassIdRef: MutableRefObject<string>;
  applyClasses: SyncClassesState;
  clearFilesState: () => void;
  clearClassesState: () => void;
  handleAuthRequired: () => void;
  setRole: Setter<string | null>;
  setFiles: Setter<CourseFile[]>;
  setLoading: Setter<boolean>;
  setFilesLoading: Setter<boolean>;
  setPageError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useFilesPageLoaders({
  bootstrapRequestIdRef,
  filesRequestIdRef,
  classIdRef,
  classesRef,
  hasRoleSnapshotRef,
  hasClassesSnapshotRef,
  hasFilesSnapshotRef,
  filesSnapshotClassIdRef,
  applyClasses,
  clearFilesState,
  clearClassesState,
  handleAuthRequired,
  setRole,
  setFiles,
  setLoading,
  setFilesLoading,
  setPageError,
  setAuthRequired,
  setLastLoadedAt
}: FilesPageLoadersOptions) {
  const loadBootstrap = useCallback(async (): Promise<FilesLoadResult> => {
    const requestId = bootstrapRequestIdRef.current + 1;
    bootstrapRequestIdRef.current = requestId;
    setLoading(true);
    setPageError(null);

    try {
      const noStoreRequestInit = getFilesNoStoreRequestInit();
      const [authResult, classesResult] = await Promise.allSettled([
        requestJson<AuthMeResponse>("/api/auth/me", noStoreRequestInit),
        requestJson<ClassListResponse>("/api/classes", noStoreRequestInit)
      ]);

      if (bootstrapRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }

      const authFailure = [authResult, classesResult].some(
        (result) => result.status === "rejected" && isAuthError(result.reason)
      );

      if (authFailure) {
        handleAuthRequired();
        return { status: "auth", errorMessage: null, hasSuccess: false };
      }

      let hasSuccess = false;
      const nextErrors: string[] = [];

      if (authResult.status === "fulfilled") {
        hasRoleSnapshotRef.current = true;
        setRole(authResult.value.user?.role ?? null);
        hasSuccess = true;
      } else {
        if (!hasRoleSnapshotRef.current) {
          setRole(null);
        }
        nextErrors.push(
          `账号信息加载失败：${getFilesBootstrapRequestMessage(authResult.reason, "加载账号信息失败")}`
        );
      }

      if (classesResult.status === "fulfilled") {
        hasClassesSnapshotRef.current = true;
        const nextClassId = applyClasses(classesResult.value.data ?? []);
        if (!nextClassId) {
          clearFilesState();
        }
        hasSuccess = true;
      } else {
        if (!hasClassesSnapshotRef.current) {
          clearClassesState();
          clearFilesState();
        }
        nextErrors.push(
          `班级列表加载失败：${getFilesBootstrapRequestMessage(
            classesResult.reason,
            "加载班级列表失败"
          )}`
        );
      }

      setAuthRequired(false);
      if (hasSuccess) {
        setLastLoadedAt(new Date().toISOString());
      }
      if (nextErrors.length) {
        setPageError(nextErrors.join("；"));
      }

      return {
        status: nextErrors.length ? "error" : "loaded",
        errorMessage: nextErrors.length ? nextErrors.join("；") : null,
        hasSuccess
      };
    } catch (nextError) {
      if (bootstrapRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return { status: "auth", errorMessage: null, hasSuccess: false };
      }

      if (!hasRoleSnapshotRef.current) {
        setRole(null);
      }
      if (!hasClassesSnapshotRef.current) {
        clearClassesState();
        clearFilesState();
      }

      const errorMessage = getFilesBootstrapRequestMessage(nextError, "加载课程文件中心失败");
      setAuthRequired(false);
      setPageError(errorMessage);
      return {
        status: "error",
        errorMessage,
        hasSuccess: hasRoleSnapshotRef.current || hasClassesSnapshotRef.current
      };
    } finally {
      if (bootstrapRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [
    applyClasses,
    bootstrapRequestIdRef,
    clearClassesState,
    clearFilesState,
    handleAuthRequired,
    hasClassesSnapshotRef,
    hasRoleSnapshotRef,
    setAuthRequired,
    setLastLoadedAt,
    setLoading,
    setPageError,
    setRole
  ]);

  const loadFiles = useCallback(async (
    selectedClassId: string,
    options?: FilesLoadOptions
  ): Promise<FilesLoadResult> => {
    if (!selectedClassId) {
      clearFilesState();
      setFilesLoading(false);
      return { status: "empty", errorMessage: null, hasSuccess: false };
    }

    const requestId = filesRequestIdRef.current + 1;
    filesRequestIdRef.current = requestId;
    setFilesLoading(true);
    if (options?.clearBeforeLoad) {
      setFiles([]);
    }
    if (options?.clearError !== false) {
      setPageError(null);
    }

    try {
      const noStoreRequestInit = getFilesNoStoreRequestInit();
      const payload = await requestJson<FilesListResponse>(
        `/api/files?classId=${encodeURIComponent(selectedClassId)}`,
        noStoreRequestInit
      );
      if (filesRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }
      hasFilesSnapshotRef.current = true;
      filesSnapshotClassIdRef.current = selectedClassId;
      setFiles(payload.data ?? []);
      setPageError(null);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
      return { status: "loaded", errorMessage: null, hasSuccess: true };
    } catch (nextError) {
      if (filesRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return { status: "auth", errorMessage: null, hasSuccess: false };
      }

      const preserveSnapshot =
        options?.preserveSnapshot === true && filesSnapshotClassIdRef.current === selectedClassId;

      if (isMissingFilesClassError(nextError)) {
        const nextState = resolveFilesStateAfterMissingClass(
          classesRef.current,
          selectedClassId,
          classIdRef.current
        );
        const nextClassId = applyClasses(nextState.nextClasses, nextState.nextClassId);
        if (!nextClassId) {
          clearFilesState();
        } else {
          hasFilesSnapshotRef.current = false;
          filesSnapshotClassIdRef.current = "";
          setFiles([]);
        }
      } else if (!preserveSnapshot || !hasFilesSnapshotRef.current) {
        clearFilesState();
      }

      const errorMessage = getFilesListRequestMessage(nextError, "加载课程资料失败");
      setAuthRequired(false);
      setPageError(errorMessage);
      return {
        status: "error",
        errorMessage,
        hasSuccess: preserveSnapshot && hasFilesSnapshotRef.current
      };
    } finally {
      if (filesRequestIdRef.current === requestId) {
        setFilesLoading(false);
      }
    }
  }, [
    applyClasses,
    classIdRef,
    classesRef,
    clearFilesState,
    filesRequestIdRef,
    filesSnapshotClassIdRef,
    handleAuthRequired,
    hasFilesSnapshotRef,
    setAuthRequired,
    setFiles,
    setFilesLoading,
    setLastLoadedAt,
    setPageError
  ]);

  return {
    loadBootstrap,
    loadFiles
  };
}
