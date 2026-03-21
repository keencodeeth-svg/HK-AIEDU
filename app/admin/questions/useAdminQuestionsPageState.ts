import { useCallback, useMemo, useRef, useState } from "react";
import type {
  AiQuestionForm,
  KnowledgePoint,
  Question,
  QuestionFacets,
  QuestionForm,
  QuestionListMeta,
  QuestionQualitySummary,
  QuestionQuery,
  QuestionTreeNode
} from "./types";
import {
  getAdminQuestionsPageDerivedState,
  INITIAL_ADMIN_AI_QUESTION_FORM,
  INITIAL_ADMIN_QUESTION_FORM,
  INITIAL_ADMIN_QUESTIONS_FACETS,
  INITIAL_ADMIN_QUESTIONS_META,
  INITIAL_ADMIN_QUESTIONS_QUERY
} from "./utils";

export function useAdminQuestionsPageState() {
  const knowledgePointsRequestIdRef = useRef(0);
  const questionsRequestIdRef = useRef(0);
  const importRequestIdRef = useRef(0);
  const aiRequestIdRef = useRef(0);
  const createRequestIdRef = useRef(0);
  const listActionRequestIdRef = useRef(0);
  const recheckRequestIdRef = useRef(0);
  const queryRef = useRef<QuestionQuery>(INITIAL_ADMIN_QUESTIONS_QUERY);
  const pageRef = useRef(INITIAL_ADMIN_QUESTIONS_META.page);
  const pageSizeRef = useRef(INITIAL_ADMIN_QUESTIONS_META.pageSize);
  const hasKnowledgePointsSnapshotRef = useRef(false);

  const [list, setList] = useState<Question[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [workspace, setWorkspace] = useState<"list" | "tools">("list");
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<QuestionQuery>(INITIAL_ADMIN_QUESTIONS_QUERY);
  const [page, setPage] = useState(INITIAL_ADMIN_QUESTIONS_META.page);
  const [pageSize, setPageSize] = useState(INITIAL_ADMIN_QUESTIONS_META.pageSize);
  const [meta, setMeta] = useState<QuestionListMeta>(INITIAL_ADMIN_QUESTIONS_META);
  const [tree, setTree] = useState<QuestionTreeNode[]>([]);
  const [qualitySummary, setQualitySummary] = useState<QuestionQualitySummary | null>(null);
  const [facets, setFacets] = useState<QuestionFacets>(INITIAL_ADMIN_QUESTIONS_FACETS);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [form, setForm] = useState<QuestionForm>(INITIAL_ADMIN_QUESTION_FORM);
  const [aiForm, setAiForm] = useState<AiQuestionForm>(INITIAL_ADMIN_AI_QUESTION_FORM);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<string[]>([]);
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckMessage, setRecheckMessage] = useState<string | null>(null);
  const [recheckError, setRecheckError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pageActionError, setPageActionError] = useState<string | null>(null);
  const [knowledgePointsLoadError, setKnowledgePointsLoadError] = useState<string | null>(null);
  const [questionsLoadError, setQuestionsLoadError] = useState<string | null>(null);

  const patchQuery = useCallback((next: Partial<QuestionQuery>) => {
    setQuery((prev) => ({ ...prev, ...next }));
    setPage(1);
  }, []);

  const derivedState = useMemo(
    () =>
      getAdminQuestionsPageDerivedState({
        knowledgePoints,
        form,
        aiForm,
        meta,
        knowledgePointsLoadError,
        questionsLoadError
      }),
    [aiForm, form, knowledgePoints, knowledgePointsLoadError, meta, questionsLoadError]
  );

  return {
    knowledgePointsRequestIdRef,
    questionsRequestIdRef,
    importRequestIdRef,
    aiRequestIdRef,
    createRequestIdRef,
    listActionRequestIdRef,
    recheckRequestIdRef,
    queryRef,
    pageRef,
    pageSizeRef,
    hasKnowledgePointsSnapshotRef,
    list,
    knowledgePoints,
    workspace,
    authRequired,
    loading,
    query,
    page,
    pageSize,
    meta,
    tree,
    qualitySummary,
    facets,
    importMessage,
    importErrors,
    form,
    aiForm,
    aiLoading,
    aiMessage,
    aiErrors,
    recheckLoading,
    recheckMessage,
    recheckError,
    createError,
    pageActionError,
    knowledgePointsLoadError,
    questionsLoadError,
    formKnowledgePoints: derivedState.formKnowledgePoints,
    aiKnowledgePoints: derivedState.aiKnowledgePoints,
    chapterOptions: derivedState.chapterOptions,
    loadError: derivedState.loadError,
    pageStart: derivedState.pageStart,
    pageEnd: derivedState.pageEnd,
    setList,
    setKnowledgePoints,
    setWorkspace,
    setAuthRequired,
    setLoading,
    setQuery,
    setPage,
    setPageSize,
    setMeta,
    setTree,
    setQualitySummary,
    setFacets,
    setImportMessage,
    setImportErrors,
    setForm,
    setAiForm,
    setAiLoading,
    setAiMessage,
    setAiErrors,
    setRecheckLoading,
    setRecheckMessage,
    setRecheckError,
    setCreateError,
    setPageActionError,
    setKnowledgePointsLoadError,
    setQuestionsLoadError,
    patchQuery
  };
}
