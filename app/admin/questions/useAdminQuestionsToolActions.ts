"use client";

import { useCallback, type Dispatch, type FormEvent, type MutableRefObject, type SetStateAction } from "react";
import type { QuestionImportItemPayload, QuestionListPayload } from "./types";
import { isAuthError, requestJson } from "@/lib/client-request";
import {
  buildAdminQuestionCreateRequest,
  buildAdminQuestionGenerateRequest,
  buildQuestionImportItems,
  getAdminQuestionsErrorMessage,
  isAdminQuestionKnowledgePointSelectionError,
  isHighRiskQuestionQualityResult,
  parseCsv
} from "./utils";
import type {
  AiQuestionForm,
  KnowledgePoint,
  QuestionForm,
  QuestionGenerateResponse,
  QuestionImportResponse,
  QuestionQuery,
  QuestionProcessFailedItem
} from "./types";

type Setter<T> = Dispatch<SetStateAction<T>>;

type RunWithStepUp = (
  action: () => Promise<void>,
  onError?: (error: unknown) => void
) => Promise<void>;

type RequestRef = MutableRefObject<number>;

type AdminQuestionsToolActionsOptions = {
  aiForm: AiQuestionForm;
  form: QuestionForm;
  knowledgePoints: KnowledgePoint[];
  runWithStepUp: RunWithStepUp;
  handleAuthRequired: () => void;
  loadKnowledgePoints: () => Promise<void>;
  loadQuestions: (options?: { query?: QuestionQuery; page?: number; pageSize?: number }) => Promise<void>;
  importRequestIdRef: RequestRef;
  aiRequestIdRef: RequestRef;
  createRequestIdRef: RequestRef;
  setImportMessage: Setter<string | null>;
  setImportErrors: Setter<string[]>;
  setPageActionError: Setter<string | null>;
  setAiMessage: Setter<string | null>;
  setAiErrors: Setter<string[]>;
  setAiLoading: Setter<boolean>;
  setCreateError: Setter<string | null>;
  setForm: Setter<QuestionForm>;
};

export function useAdminQuestionsToolActions({
  aiForm,
  form,
  knowledgePoints,
  runWithStepUp,
  handleAuthRequired,
  loadKnowledgePoints,
  loadQuestions,
  importRequestIdRef,
  aiRequestIdRef,
  createRequestIdRef,
  setImportMessage,
  setImportErrors,
  setPageActionError,
  setAiMessage,
  setAiErrors,
  setAiLoading,
  setCreateError,
  setForm
}: AdminQuestionsToolActionsOptions) {
  const handleImport = useCallback(async (file?: File | null) => {
    if (!file) return;
    const requestId = importRequestIdRef.current + 1;
    importRequestIdRef.current = requestId;
    setImportMessage(null);
    setImportErrors([]);
    setPageActionError(null);

    const text = await file.text();
    if (importRequestIdRef.current !== requestId) {
      return;
    }

    const rows = parseCsv(text);
    const { items, errors } = buildQuestionImportItems(rows, knowledgePoints);
    if (!items.length) {
      setImportErrors(errors.length ? errors : ["没有可导入的题目"]);
      return;
    }

    await runWithStepUp(
      async () => {
        const data = await requestJson<QuestionImportResponse>("/api/admin/questions/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: items as QuestionImportItemPayload[] })
        });
        if (importRequestIdRef.current !== requestId) {
          return;
        }

        const highRiskCount = (data.items ?? []).filter(isHighRiskQuestionQualityResult).length;
        setImportMessage(`已导入 ${data.created ?? 0} 题，失败 ${data.failed?.length ?? 0} 条，高风险 ${highRiskCount} 题。`);
        setImportErrors(errors);
        await loadQuestions();
      },
      (error) => {
        if (importRequestIdRef.current !== requestId) {
          return;
        }
        if (isAuthError(error)) {
          handleAuthRequired();
          return;
        }
        setImportErrors([getAdminQuestionsErrorMessage(error, "导入失败")]);
      }
    );
  }, [
    handleAuthRequired,
    importRequestIdRef,
    knowledgePoints,
    loadQuestions,
    runWithStepUp,
    setImportErrors,
    setImportMessage,
    setPageActionError
  ]);

  const handleGenerate = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestId = aiRequestIdRef.current + 1;
    aiRequestIdRef.current = requestId;
    setAiMessage(null);
    setAiErrors([]);
    setPageActionError(null);
    setAiLoading(true);

    const { endpoint, payload } = buildAdminQuestionGenerateRequest(aiForm);

    try {
      await runWithStepUp(
        async () => {
          const data = await requestJson<QuestionGenerateResponse>(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (aiRequestIdRef.current !== requestId) {
            return;
          }

          const failed: QuestionProcessFailedItem[] = data.failed ?? [];
          if (failed.length) {
            setAiErrors(failed.map((item) => `第 ${item.index + 1} 题：${item.reason}`));
          }
          const highRiskCount = (data.created ?? []).filter(isHighRiskQuestionQualityResult).length;
          setAiMessage(`已生成 ${data.created?.length ?? 0} 题，高风险 ${highRiskCount} 题。`);
          await loadQuestions();
        },
        (error) => {
          if (aiRequestIdRef.current !== requestId) {
            return;
          }
          if (isAuthError(error)) {
            handleAuthRequired();
            return;
          }
          if (isAdminQuestionKnowledgePointSelectionError(error)) {
            void loadKnowledgePoints();
          }
          setAiErrors([getAdminQuestionsErrorMessage(error, "生成失败")]);
        }
      );
    } finally {
      if (aiRequestIdRef.current === requestId) {
        setAiLoading(false);
      }
    }
  }, [
    aiForm,
    aiRequestIdRef,
    handleAuthRequired,
    loadKnowledgePoints,
    loadQuestions,
    runWithStepUp,
    setAiErrors,
    setAiLoading,
    setAiMessage,
    setPageActionError
  ]);

  const handleCreate = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestId = createRequestIdRef.current + 1;
    createRequestIdRef.current = requestId;
    setCreateError(null);
    setPageActionError(null);
    const { payload, nextForm } = buildAdminQuestionCreateRequest(form);

    await runWithStepUp(
      async () => {
        await requestJson<QuestionListPayload>("/api/admin/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (createRequestIdRef.current !== requestId) {
          return;
        }

        setForm(nextForm);
        await loadQuestions();
      },
      (error) => {
        if (createRequestIdRef.current !== requestId) {
          return;
        }
        if (isAuthError(error)) {
          handleAuthRequired();
          return;
        }
        if (isAdminQuestionKnowledgePointSelectionError(error)) {
          void loadKnowledgePoints();
        }
        setCreateError(getAdminQuestionsErrorMessage(error, "保存失败"));
      }
    );
  }, [
    createRequestIdRef,
    form,
    handleAuthRequired,
    loadKnowledgePoints,
    loadQuestions,
    runWithStepUp,
    setCreateError,
    setForm,
    setPageActionError
  ]);

  return {
    handleImport,
    handleGenerate,
    handleCreate
  };
}
