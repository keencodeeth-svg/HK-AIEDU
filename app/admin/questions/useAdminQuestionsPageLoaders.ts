"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  KnowledgePoint,
  Question,
  QuestionFacets,
  QuestionListMeta,
  QuestionListPayload,
  QuestionQualitySummary,
  QuestionQuery,
  QuestionTreeNode
} from "./types";
import {
  buildAdminQuestionsMeta,
  buildAdminQuestionsSearchParams,
  getAdminQuestionsErrorMessage,
  getAdminQuestionsMetaAfterRemoval,
  normalizeAdminQuestionsFacets
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;
type RequestRef = MutableRefObject<number>;

type AdminQuestionsPageLoadersOptions = {
  knowledgePointsRequestIdRef: RequestRef;
  questionsRequestIdRef: RequestRef;
  importRequestIdRef: RequestRef;
  aiRequestIdRef: RequestRef;
  createRequestIdRef: RequestRef;
  listActionRequestIdRef: RequestRef;
  recheckRequestIdRef: RequestRef;
  queryRef: MutableRefObject<QuestionQuery>;
  pageRef: MutableRefObject<number>;
  pageSizeRef: MutableRefObject<number>;
  hasKnowledgePointsSnapshotRef: MutableRefObject<boolean>;
  setList: Setter<Question[]>;
  setKnowledgePoints: Setter<KnowledgePoint[]>;
  setLoading: Setter<boolean>;
  setAiLoading: Setter<boolean>;
  setRecheckLoading: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setMeta: Setter<QuestionListMeta>;
  setTree: Setter<QuestionTreeNode[]>;
  setQualitySummary: Setter<QuestionQualitySummary | null>;
  setFacets: Setter<QuestionFacets>;
  setKnowledgePointsLoadError: Setter<string | null>;
  setQuestionsLoadError: Setter<string | null>;
};

export function useAdminQuestionsPageLoaders({
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
  setList,
  setKnowledgePoints,
  setLoading,
  setAiLoading,
  setRecheckLoading,
  setAuthRequired,
  setMeta,
  setTree,
  setQualitySummary,
  setFacets,
  setKnowledgePointsLoadError,
  setQuestionsLoadError
}: AdminQuestionsPageLoadersOptions) {
  const handleAuthRequired = useCallback(() => {
    knowledgePointsRequestIdRef.current += 1;
    questionsRequestIdRef.current += 1;
    importRequestIdRef.current += 1;
    aiRequestIdRef.current += 1;
    createRequestIdRef.current += 1;
    listActionRequestIdRef.current += 1;
    recheckRequestIdRef.current += 1;
    setLoading(false);
    setAiLoading(false);
    setRecheckLoading(false);
    setAuthRequired(true);
  }, [
    aiRequestIdRef,
    createRequestIdRef,
    importRequestIdRef,
    knowledgePointsRequestIdRef,
    listActionRequestIdRef,
    questionsRequestIdRef,
    recheckRequestIdRef,
    setAiLoading,
    setAuthRequired,
    setLoading,
    setRecheckLoading
  ]);

  const removeQuestionFromCurrentPage = useCallback((questionId: string) => {
    setList((current) => current.filter((item) => item.id !== questionId));
    setMeta((current) => getAdminQuestionsMetaAfterRemoval(current));
  }, [setList, setMeta]);

  const loadKnowledgePoints = useCallback(async () => {
    const requestId = knowledgePointsRequestIdRef.current + 1;
    knowledgePointsRequestIdRef.current = requestId;

    try {
      const data = await requestJson<{ data?: KnowledgePoint[] }>("/api/admin/knowledge-points");
      if (knowledgePointsRequestIdRef.current !== requestId) {
        return;
      }

      hasKnowledgePointsSnapshotRef.current = true;
      setKnowledgePoints(data.data ?? []);
      setAuthRequired(false);
      setKnowledgePointsLoadError(null);
    } catch (error) {
      if (knowledgePointsRequestIdRef.current !== requestId) {
        return;
      }

      if (!hasKnowledgePointsSnapshotRef.current) {
        setKnowledgePoints([]);
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      setKnowledgePointsLoadError(getAdminQuestionsErrorMessage(error, "知识点加载失败"));
    }
  }, [
    handleAuthRequired,
    hasKnowledgePointsSnapshotRef,
    knowledgePointsRequestIdRef,
    setAuthRequired,
    setKnowledgePoints,
    setKnowledgePointsLoadError
  ]);

  const loadQuestions = useCallback(async (options?: {
    query?: QuestionQuery;
    page?: number;
    pageSize?: number;
  }) => {
    const requestId = questionsRequestIdRef.current + 1;
    questionsRequestIdRef.current = requestId;
    const nextQuery = options?.query ?? queryRef.current;
    const nextPage = options?.page ?? pageRef.current;
    const nextPageSize = options?.pageSize ?? pageSizeRef.current;

    setLoading(true);
    const searchParams = buildAdminQuestionsSearchParams(nextQuery, nextPage, nextPageSize);

    try {
      const data = await requestJson<QuestionListPayload>(`/api/admin/questions?${searchParams.toString()}`);
      if (questionsRequestIdRef.current !== requestId) {
        return;
      }

      setList(data.data ?? []);
      setAuthRequired(false);
      setMeta(buildAdminQuestionsMeta(data.meta, data.data?.length ?? 0, nextPage, nextPageSize));
      setTree(data.tree ?? []);
      setQualitySummary(data.qualitySummary ?? null);
      setFacets(normalizeAdminQuestionsFacets(data.facets));
      setQuestionsLoadError(null);
    } catch (error) {
      if (questionsRequestIdRef.current !== requestId) {
        return;
      }

      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      setQuestionsLoadError(getAdminQuestionsErrorMessage(error, "题库列表加载失败"));
    } finally {
      if (questionsRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [
    handleAuthRequired,
    pageRef,
    pageSizeRef,
    queryRef,
    questionsRequestIdRef,
    setAuthRequired,
    setFacets,
    setList,
    setLoading,
    setMeta,
    setQualitySummary,
    setQuestionsLoadError,
    setTree
  ]);

  return {
    handleAuthRequired,
    removeQuestionFromCurrentPage,
    loadKnowledgePoints,
    loadQuestions
  };
}
