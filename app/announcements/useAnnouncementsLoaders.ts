"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  AnnouncementClassListResponse,
  AnnouncementClassOption,
  AnnouncementItem,
  AnnouncementListResponse,
  AnnouncementLoadStatus,
  AppUserRole,
  AuthMeResponse
} from "./types";
import {
  getAnnouncementClassListRequestMessage,
  getAnnouncementsListRequestMessage,
  getAnnouncementsNoStoreRequestInit,
  resolveAnnouncementClassId
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type AnnouncementsLoadersOptions = {
  bootstrapRequestIdRef: MutableRefObject<number>;
  announcementsRequestIdRef: MutableRefObject<number>;
  classesRequestIdRef: MutableRefObject<number>;
  hasAnnouncementsSnapshotRef: MutableRefObject<boolean>;
  hasClassesSnapshotRef: MutableRefObject<boolean>;
  clearAnnouncementsState: () => void;
  clearClassesState: () => void;
  clearPageState: () => void;
  handleAuthRequired: () => void;
  setAnnouncements: Setter<AnnouncementItem[]>;
  setUserRole: Setter<AppUserRole>;
  setClasses: Setter<AnnouncementClassOption[]>;
  setClassId: Setter<string>;
  setPageError: Setter<string | null>;
  setClassesError: Setter<string | null>;
  setPageLoading: Setter<boolean>;
  setClassesLoading: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useAnnouncementsLoaders({
  bootstrapRequestIdRef,
  announcementsRequestIdRef,
  classesRequestIdRef,
  hasAnnouncementsSnapshotRef,
  hasClassesSnapshotRef,
  clearAnnouncementsState,
  clearClassesState,
  clearPageState,
  handleAuthRequired,
  setAnnouncements,
  setUserRole,
  setClasses,
  setClassId,
  setPageError,
  setClassesError,
  setPageLoading,
  setClassesLoading,
  setAuthRequired,
  setLastLoadedAt
}: AnnouncementsLoadersOptions) {
  const loadAnnouncements = useCallback(async (): Promise<AnnouncementLoadStatus> => {
    const requestId = announcementsRequestIdRef.current + 1;
    announcementsRequestIdRef.current = requestId;
    setPageError(null);

    try {
      const payload = await requestJson<AnnouncementListResponse>(
        "/api/announcements",
        getAnnouncementsNoStoreRequestInit()
      );
      if (announcementsRequestIdRef.current !== requestId) {
        return "stale";
      }

      hasAnnouncementsSnapshotRef.current = true;
      setAnnouncements(payload.data ?? []);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
      return "loaded";
    } catch (error) {
      if (announcementsRequestIdRef.current !== requestId) {
        return "stale";
      }

      if (isAuthError(error)) {
        handleAuthRequired();
        return "auth";
      }

      if (!hasAnnouncementsSnapshotRef.current) {
        clearAnnouncementsState();
      }
      setAuthRequired(false);
      setPageError(getAnnouncementsListRequestMessage(error, "加载公告列表失败"));
      return "error";
    }
  }, [
    announcementsRequestIdRef,
    clearAnnouncementsState,
    handleAuthRequired,
    hasAnnouncementsSnapshotRef,
    setAnnouncements,
    setAuthRequired,
    setLastLoadedAt,
    setPageError
  ]);

  const loadTeacherClasses = useCallback(async (): Promise<AnnouncementLoadStatus> => {
    const requestId = classesRequestIdRef.current + 1;
    classesRequestIdRef.current = requestId;
    setClassesLoading(true);
    setClassesError(null);

    try {
      const payload = await requestJson<AnnouncementClassListResponse>(
        "/api/teacher/classes",
        getAnnouncementsNoStoreRequestInit()
      );
      if (classesRequestIdRef.current !== requestId) {
        return "stale";
      }

      const nextClasses = payload.data ?? [];
      hasClassesSnapshotRef.current = true;
      setClasses(nextClasses);
      setClassId((currentClassId) => resolveAnnouncementClassId(nextClasses, currentClassId));
      setAuthRequired(false);
      return "loaded";
    } catch (error) {
      if (classesRequestIdRef.current !== requestId) {
        return "stale";
      }

      if (isAuthError(error)) {
        handleAuthRequired();
        return "auth";
      }

      if (!hasClassesSnapshotRef.current) {
        clearClassesState();
      }
      setAuthRequired(false);
      setClassesError(getAnnouncementClassListRequestMessage(error, "加载教师班级失败"));
      return "error";
    } finally {
      if (classesRequestIdRef.current === requestId) {
        setClassesLoading(false);
      }
    }
  }, [
    classesRequestIdRef,
    clearClassesState,
    handleAuthRequired,
    hasClassesSnapshotRef,
    setAuthRequired,
    setClassId,
    setClasses,
    setClassesError,
    setClassesLoading
  ]);

  const loadPage = useCallback(async () => {
    const requestId = bootstrapRequestIdRef.current + 1;
    bootstrapRequestIdRef.current = requestId;
    setPageLoading(true);
    setPageError(null);

    try {
      const noStoreRequestInit = getAnnouncementsNoStoreRequestInit();
      const [authResult, announcementsResult] = await Promise.allSettled([
        requestJson<AuthMeResponse>("/api/auth/me", noStoreRequestInit),
        requestJson<AnnouncementListResponse>("/api/announcements", noStoreRequestInit)
      ]);

      if (bootstrapRequestIdRef.current !== requestId) {
        return;
      }

      const authFailed =
        (authResult.status === "rejected" && isAuthError(authResult.reason)) ||
        (announcementsResult.status === "rejected" && isAuthError(announcementsResult.reason));
      if (authFailed) {
        handleAuthRequired();
        return;
      }

      if (authResult.status === "fulfilled") {
        setUserRole(authResult.value.user?.role ?? null);
      } else {
        clearPageState();
        setAuthRequired(false);
        setPageError(getAnnouncementsListRequestMessage(authResult.reason, "加载公告页失败"));
        return;
      }

      if (announcementsResult.status === "fulfilled") {
        hasAnnouncementsSnapshotRef.current = true;
        setAnnouncements(announcementsResult.value.data ?? []);
        setLastLoadedAt(new Date().toISOString());
      } else {
        if (!hasAnnouncementsSnapshotRef.current) {
          clearAnnouncementsState();
        }
        setPageError(getAnnouncementsListRequestMessage(announcementsResult.reason, "加载公告列表失败"));
      }

      const nextRole = authResult.value.user?.role ?? null;
      setAuthRequired(false);
      if (nextRole === "teacher") {
        void loadTeacherClasses();
      } else {
        classesRequestIdRef.current += 1;
        clearClassesState();
      }
    } catch (error) {
      if (bootstrapRequestIdRef.current !== requestId) {
        return;
      }

      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        clearPageState();
        setAuthRequired(false);
        setPageError(getAnnouncementsListRequestMessage(error, "加载公告页失败"));
      }
    } finally {
      if (bootstrapRequestIdRef.current === requestId) {
        setPageLoading(false);
      }
    }
  }, [
    bootstrapRequestIdRef,
    classesRequestIdRef,
    clearAnnouncementsState,
    clearClassesState,
    clearPageState,
    handleAuthRequired,
    hasAnnouncementsSnapshotRef,
    loadTeacherClasses,
    setAnnouncements,
    setAuthRequired,
    setLastLoadedAt,
    setPageError,
    setPageLoading,
    setUserRole
  ]);

  return {
    loadAnnouncements,
    loadTeacherClasses,
    loadPage
  };
}
