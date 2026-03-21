"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatLoadedTime } from "@/lib/client-request";
import type { CourseFile, FilesClassItem } from "./types";
import {
  groupCourseFilesByFolder,
  resolveFilesClassId
} from "./utils";
import { useFilesPageActions } from "./useFilesPageActions";
import { useFilesPageLoaders } from "./useFilesPageLoaders";

export function useFilesPage() {
  const bootstrapRequestIdRef = useRef(0);
  const filesRequestIdRef = useRef(0);
  const classIdRef = useRef("");
  const classesRef = useRef<FilesClassItem[]>([]);
  const hasRoleSnapshotRef = useRef(false);
  const hasClassesSnapshotRef = useRef(false);
  const hasFilesSnapshotRef = useRef(false);
  const filesSnapshotClassIdRef = useRef("");
  const previousClassIdRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [classes, setClasses] = useState<FilesClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [folder, setFolder] = useState("");
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [resourceType, setResourceType] = useState<"file" | "link">("file");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  useEffect(() => {
    classIdRef.current = classId;
  }, [classId]);

  useEffect(() => {
    classesRef.current = classes;
  }, [classes]);

  const applyClasses = useCallback((nextClasses: FilesClassItem[], preferredClassId = classIdRef.current) => {
    classesRef.current = nextClasses;
    setClasses(nextClasses);
    const nextClassId = resolveFilesClassId(nextClasses, preferredClassId);
    classIdRef.current = nextClassId;
    setClassId(nextClassId);
    return nextClassId;
  }, []);

  const clearFilesState = useCallback(() => {
    hasFilesSnapshotRef.current = false;
    filesSnapshotClassIdRef.current = "";
    setFiles([]);
  }, []);

  const clearClassesState = useCallback(() => {
    hasClassesSnapshotRef.current = false;
    applyClasses([], "");
  }, [applyClasses]);

  const clearBootstrapState = useCallback(() => {
    hasRoleSnapshotRef.current = false;
    setRole(null);
    clearClassesState();
  }, [clearClassesState]);

  const clearFilesPageState = useCallback(() => {
    clearBootstrapState();
    clearFilesState();
    setMessage(null);
    setError(null);
    setPageError(null);
    setLastLoadedAt(null);
  }, [clearBootstrapState, clearFilesState]);

  const handleAuthRequired = useCallback(() => {
    bootstrapRequestIdRef.current += 1;
    filesRequestIdRef.current += 1;
    clearFilesPageState();
    setLoading(false);
    setFilesLoading(false);
    setAuthRequired(true);
  }, [clearFilesPageState]);

  const { loadBootstrap, loadFiles } = useFilesPageLoaders({
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
  });

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    const previousClassId = previousClassIdRef.current;
    previousClassIdRef.current = classId;

    if (!classId) {
      clearFilesState();
      setFilesLoading(false);
      return;
    }

    const switchingClass = previousClassId.length > 0 && previousClassId !== classId;
    setMessage(null);
    setError(null);
    void loadFiles(classId, {
      clearBeforeLoad: switchingClass,
      preserveSnapshot: !switchingClass
    });
  }, [classId, clearFilesState, loadFiles]);

  const { handleUpload } = useFilesPageActions({
    classId,
    folder,
    title,
    linkUrl,
    resourceType,
    fileInputRef,
    loadBootstrap,
    loadFiles,
    clearFilesState,
    handleAuthRequired,
    setSubmitting,
    setMessage,
    setError,
    setFolder,
    setTitle,
    setLinkUrl
  });

  const groupedFiles = useMemo(() => {
    return groupCourseFilesByFolder(files);
  }, [files]);

  const lastLoadedAtLabel = lastLoadedAt ? formatLoadedTime(lastLoadedAt) : null;

  const updateClassId = useCallback((value: string) => {
    setClassId(value);
  }, []);

  const updateFolder = useCallback((value: string) => {
    setFolder(value);
  }, []);

  const updateTitle = useCallback((value: string) => {
    setTitle(value);
  }, []);

  const updateLinkUrl = useCallback((value: string) => {
    setLinkUrl(value);
  }, []);

  const updateResourceType = useCallback((value: "file" | "link") => {
    setResourceType(value);
  }, []);

  return {
    role,
    classes,
    classId,
    files,
    folder,
    title,
    linkUrl,
    resourceType,
    message,
    error,
    loading,
    filesLoading,
    submitting,
    pageError,
    authRequired,
    lastLoadedAtLabel,
    groupedFiles,
    fileInputRef,
    loadBootstrap,
    loadFiles,
    handleUpload,
    updateClassId,
    updateFolder,
    updateTitle,
    updateLinkUrl,
    updateResourceType
  };
}
