import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BatchImportSummary,
  ClassItem,
  LibraryAiFormState,
  LibraryBatchPreview,
  LibraryContentFilter,
  LibraryFacets,
  LibraryImportFormState,
  LibraryItem,
  LibraryMeta,
  LibrarySummary,
  LibraryUser,
  LibraryViewMode
} from "./types";
import {
  DEFAULT_FACETS,
  DEFAULT_META,
  DEFAULT_SUMMARY,
  buildLibraryExpandedTypeKeys,
  getLibraryPageDerivedState,
  normalizeLibraryImportForm,
  pruneExpandedLibrarySubjects,
  pruneExpandedLibraryTypeKeys,
  removeLibraryItemSnapshot
} from "./utils";

export function useLibraryPageState() {
  const userRequestIdRef = useRef(0);
  const listRequestIdRef = useRef(0);
  const classesRequestIdRef = useRef(0);
  const hasListSnapshotRef = useRef(false);
  const pageRef = useRef(1);
  const pageSizeRef = useRef(16);
  const subjectFilterRef = useRef("all");
  const contentFilterRef = useRef<LibraryContentFilter>("all");
  const keywordRef = useRef("");
  const itemsRef = useRef<LibraryItem[]>([]);
  const metaRef = useRef<LibraryMeta>(DEFAULT_META);
  const facetsRef = useRef<LibraryFacets>(DEFAULT_FACETS);
  const summaryRef = useRef<LibrarySummary>(DEFAULT_SUMMARY);

  const [user, setUser] = useState<LibraryUser>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageReady, setPageReady] = useState(false);
  const [bootstrapNotice, setBootstrapNotice] = useState<string | null>(null);
  const [classesNotice, setClassesNotice] = useState<string | null>(null);
  const [listNotice, setListNotice] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [importForm, setImportForm] = useState<LibraryImportFormState>({
    title: "",
    description: "",
    subject: "math",
    grade: "4",
    contentType: "textbook",
    sourceType: "file",
    textContent: "",
    linkUrl: ""
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchPreview, setBatchPreview] = useState<LibraryBatchPreview | null>(null);
  const [batchSummary, setBatchSummary] = useState<BatchImportSummary | null>(null);
  const [batchFailedPreview, setBatchFailedPreview] = useState<string[]>([]);

  const [aiForm, setAiForm] = useState<LibraryAiFormState>({
    classId: "",
    topic: "",
    contentType: "lesson_plan"
  });
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [contentFilter, setContentFilter] = useState<LibraryContentFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(16);
  const [meta, setMeta] = useState<LibraryMeta>(DEFAULT_META);
  const [facets, setFacets] = useState<LibraryFacets>(DEFAULT_FACETS);
  const [summary, setSummary] = useState<LibrarySummary>(DEFAULT_SUMMARY);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const [expandedTypeKeys, setExpandedTypeKeys] = useState<string[]>([]);
  const [libraryViewMode, setLibraryViewMode] = useState<LibraryViewMode>("compact");

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  useEffect(() => {
    subjectFilterRef.current = subjectFilter;
  }, [subjectFilter]);

  useEffect(() => {
    contentFilterRef.current = contentFilter;
  }, [contentFilter]);

  useEffect(() => {
    keywordRef.current = keyword;
  }, [keyword]);

  const syncUser = useCallback((nextUser: LibraryUser) => {
    setUser(nextUser);
  }, []);

  const syncItems = useCallback((nextItems: LibraryItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  const syncClasses = useCallback((nextClasses: ClassItem[]) => {
    setClasses(nextClasses);
  }, []);

  const syncMeta = useCallback((nextMeta: LibraryMeta) => {
    metaRef.current = nextMeta;
    setMeta(nextMeta);
  }, []);

  const syncFacets = useCallback((nextFacets: LibraryFacets) => {
    facetsRef.current = nextFacets;
    setFacets(nextFacets);
  }, []);

  const syncSummary = useCallback((nextSummary: LibrarySummary) => {
    summaryRef.current = nextSummary;
    setSummary(nextSummary);
  }, []);

  const removeItemFromSnapshot = useCallback(
    (item: LibraryItem) => {
      const nextSnapshot = removeLibraryItemSnapshot(
        itemsRef.current,
        metaRef.current,
        facetsRef.current,
        summaryRef.current,
        item
      );
      syncItems(nextSnapshot.items);
      syncMeta(nextSnapshot.meta);
      syncFacets(nextSnapshot.facets);
      syncSummary(nextSnapshot.summary);
      if (nextSnapshot.meta.page !== pageRef.current) {
        setPage(nextSnapshot.meta.page);
      }
    },
    [syncFacets, syncItems, syncMeta, syncSummary]
  );

  const derivedState = useMemo(
    () => getLibraryPageDerivedState({ facets, items }),
    [facets, items]
  );

  useEffect(() => {
    const nextImportForm = normalizeLibraryImportForm(importForm);
    if (nextImportForm !== importForm) {
      setImportForm(nextImportForm);
    }
  }, [importForm]);

  useEffect(() => {
    setPage(1);
  }, [subjectFilter, contentFilter, keyword, pageSize]);

  useEffect(() => {
    setExpandedSubjects((prev) =>
      pruneExpandedLibrarySubjects(prev, derivedState.groupedBySubject)
    );
  }, [derivedState.groupedBySubject]);

  useEffect(() => {
    setExpandedTypeKeys((prev) =>
      pruneExpandedLibraryTypeKeys(prev, derivedState.groupedBySubject)
    );
  }, [derivedState.groupedBySubject]);

  const toggleExpandedSubject = useCallback((subject: string) => {
    setExpandedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((item) => item !== subject) : [...prev, subject]
    );
  }, []);

  const toggleExpandedType = useCallback((typeKey: string) => {
    setExpandedTypeKeys((prev) =>
      prev.includes(typeKey) ? prev.filter((item) => item !== typeKey) : [...prev, typeKey]
    );
  }, []);

  const setAllSubjectsExpanded = useCallback(
    (expanded: boolean) => {
      if (!expanded) {
        setExpandedSubjects([]);
        return;
      }
      setExpandedSubjects(derivedState.groupedBySubject.map((group) => group.subject));
    },
    [derivedState.groupedBySubject]
  );

  const setAllTypesExpanded = useCallback(
    (expanded: boolean) => {
      if (!expanded) {
        setExpandedTypeKeys([]);
        return;
      }
      setExpandedTypeKeys(buildLibraryExpandedTypeKeys(derivedState.groupedBySubject));
    },
    [derivedState.groupedBySubject]
  );

  return {
    userRequestIdRef,
    listRequestIdRef,
    classesRequestIdRef,
    hasListSnapshotRef,
    pageRef,
    pageSizeRef,
    subjectFilterRef,
    contentFilterRef,
    keywordRef,
    user,
    items,
    classes,
    loading,
    authRequired,
    pageError,
    pageReady,
    bootstrapNotice,
    classesNotice,
    listNotice,
    message,
    error,
    importForm,
    importFile,
    batchFile,
    batchPreview,
    batchSummary,
    batchFailedPreview,
    aiForm,
    subjectFilter,
    contentFilter,
    keyword,
    page,
    pageSize,
    meta,
    facets,
    summary,
    deletingId,
    expandedSubjects,
    expandedTypeKeys,
    libraryViewMode,
    subjectList: derivedState.subjectList,
    groupedBySubject: derivedState.groupedBySubject,
    setUser,
    setItems,
    setClasses,
    setLoading,
    setAuthRequired,
    setPageError,
    setPageReady,
    setBootstrapNotice,
    setClassesNotice,
    setListNotice,
    setMessage,
    setError,
    setImportForm,
    setImportFile,
    setBatchFile,
    setBatchPreview,
    setBatchSummary,
    setBatchFailedPreview,
    setAiForm,
    setSubjectFilter,
    setContentFilter,
    setKeyword,
    setPage,
    setPageSize,
    setMeta,
    setFacets,
    setSummary,
    setDeletingId,
    setExpandedSubjects,
    setExpandedTypeKeys,
    setLibraryViewMode,
    syncUser,
    syncItems,
    syncClasses,
    syncMeta,
    syncFacets,
    syncSummary,
    removeItemFromSnapshot,
    toggleExpandedSubject,
    toggleExpandedType,
    setAllSubjectsExpanded,
    setAllTypesExpanded
  };
}
