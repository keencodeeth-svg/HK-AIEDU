"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatLoadedTime } from "@/lib/client-request";
import type {
  AnnouncementClassOption,
  AnnouncementItem,
  AppUserRole
} from "./types";
import { hasAnnouncementsPageData } from "./utils";
import { useAnnouncementsActions } from "./useAnnouncementsActions";
import { useAnnouncementsLoaders } from "./useAnnouncementsLoaders";

export function useAnnouncementsPage() {
  const bootstrapRequestIdRef = useRef(0);
  const announcementsRequestIdRef = useRef(0);
  const classesRequestIdRef = useRef(0);
  const hasAnnouncementsSnapshotRef = useRef(false);
  const hasClassesSnapshotRef = useRef(false);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [userRole, setUserRole] = useState<AppUserRole>(null);
  const [classes, setClasses] = useState<AnnouncementClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearSubmitNotice = useCallback(() => {
    setMessage(null);
    setSubmitError(null);
  }, []);

  const clearAnnouncementsState = useCallback(() => {
    hasAnnouncementsSnapshotRef.current = false;
    setAnnouncements([]);
  }, []);

  const clearClassesState = useCallback(() => {
    hasClassesSnapshotRef.current = false;
    setClasses([]);
    setClassId("");
    setClassesError(null);
    setClassesLoading(false);
  }, []);

  const clearPageState = useCallback(() => {
    clearAnnouncementsState();
    clearClassesState();
    clearSubmitNotice();
    setUserRole(null);
    setPageError(null);
    setLastLoadedAt(null);
  }, [clearAnnouncementsState, clearClassesState, clearSubmitNotice]);

  const handleAuthRequired = useCallback(() => {
    bootstrapRequestIdRef.current += 1;
    announcementsRequestIdRef.current += 1;
    classesRequestIdRef.current += 1;
    clearPageState();
    setPageLoading(false);
    setSubmitting(false);
    setAuthRequired(true);
  }, [clearPageState]);

  const {
    loadAnnouncements,
    loadTeacherClasses,
    loadPage
  } = useAnnouncementsLoaders({
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
  });

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const updateClassId = useCallback((value: string) => {
    clearSubmitNotice();
    setClassId(value);
  }, [clearSubmitNotice]);

  const updateTitle = useCallback((value: string) => {
    clearSubmitNotice();
    setTitle(value);
  }, [clearSubmitNotice]);

  const updateContent = useCallback((value: string) => {
    clearSubmitNotice();
    setContent(value);
  }, [clearSubmitNotice]);

  const { handleSubmit } = useAnnouncementsActions({
    classId,
    title,
    content,
    clearSubmitNotice,
    handleAuthRequired,
    loadAnnouncements,
    loadTeacherClasses,
    setTitle,
    setContent,
    setSubmitting,
    setMessage,
    setSubmitError,
    setAuthRequired
  });

  const hasPageData = hasAnnouncementsPageData(announcements.length, userRole, classes.length);
  const lastLoadedAtLabel = lastLoadedAt ? formatLoadedTime(lastLoadedAt) : null;
  const canSubmit = Boolean(classId && title.trim() && content.trim());

  return {
    announcements,
    userRole,
    classes,
    classId,
    title,
    content,
    message,
    submitError,
    pageError,
    classesError,
    pageLoading,
    submitting,
    classesLoading,
    authRequired,
    hasPageData,
    lastLoadedAtLabel,
    canSubmit,
    loadAnnouncements,
    loadTeacherClasses,
    loadPage,
    updateClassId,
    updateTitle,
    updateContent,
    handleSubmit
  };
}
