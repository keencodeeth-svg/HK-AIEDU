"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { QuestionQuery } from "./types";
import {
  buildAdminQuestionsRecheckPayload,
  formatAdminQuestionsRecheckMessage,
  getAdminQuestionsErrorMessage,
  isAdminQuestionMissingError
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type RunWithStepUp = (
  action: () => Promise<void>,
  onError?: (error: unknown) => void
) => Promise<void>;

type RequestRef = MutableRefObject<number>;

type QuestionQualityRecheckResponse = {
  data?: {
    scope?: {
      processedCount?: number;
    };
    summary?: {
      updated?: number;
      newlyTracked?: number;
      highRiskCount?: number;
      isolatedCount?: number;
    };
  };
};

type AdminQuestionsListActionsOptions = {
  query: QuestionQuery;
  runWithStepUp: RunWithStepUp;
  handleAuthRequired: () => void;
  loadQuestions: (options?: { query?: QuestionQuery; page?: number; pageSize?: number }) => Promise<void>;
  removeQuestionFromCurrentPage: (questionId: string) => void;
  listActionRequestIdRef: RequestRef;
  recheckRequestIdRef: RequestRef;
  setPageActionError: Setter<string | null>;
  setRecheckMessage: Setter<string | null>;
  setRecheckError: Setter<string | null>;
  setRecheckLoading: Setter<boolean>;
};

export function useAdminQuestionsListActions({
  query,
  runWithStepUp,
  handleAuthRequired,
  loadQuestions,
  removeQuestionFromCurrentPage,
  listActionRequestIdRef,
  recheckRequestIdRef,
  setPageActionError,
  setRecheckMessage,
  setRecheckError,
  setRecheckLoading
}: AdminQuestionsListActionsOptions) {
  const handleDelete = useCallback(async (id: string) => {
    const requestId = listActionRequestIdRef.current + 1;
    listActionRequestIdRef.current = requestId;
    setPageActionError(null);
    await runWithStepUp(
      async () => {
        await requestJson(`/api/admin/questions/${id}`, { method: "DELETE" });
        if (listActionRequestIdRef.current !== requestId) {
          return;
        }
        await loadQuestions();
      },
      (error) => {
        if (listActionRequestIdRef.current !== requestId) {
          return;
        }
        if (isAuthError(error)) {
          handleAuthRequired();
          return;
        }
        if (isAdminQuestionMissingError(error)) {
          removeQuestionFromCurrentPage(id);
        }
        setPageActionError(
          isAdminQuestionMissingError(error)
            ? "题目不存在，已从当前列表移除。"
            : getAdminQuestionsErrorMessage(error, "删除失败")
        );
      }
    );
  }, [
    handleAuthRequired,
    listActionRequestIdRef,
    loadQuestions,
    removeQuestionFromCurrentPage,
    runWithStepUp,
    setPageActionError
  ]);

  const handleToggleIsolation = useCallback(async (id: string, isolated: boolean) => {
    const requestId = listActionRequestIdRef.current + 1;
    listActionRequestIdRef.current = requestId;
    setPageActionError(null);
    await runWithStepUp(
      async () => {
        await requestJson("/api/admin/questions/quality/isolation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: id,
            isolated,
            reason: isolated ? ["管理员手动加入隔离池"] : ["管理员手动移出隔离池"]
          })
        });
        if (listActionRequestIdRef.current !== requestId) {
          return;
        }
        await loadQuestions();
      },
      (error) => {
        if (listActionRequestIdRef.current !== requestId) {
          return;
        }
        if (isAuthError(error)) {
          handleAuthRequired();
          return;
        }
        if (isAdminQuestionMissingError(error)) {
          removeQuestionFromCurrentPage(id);
        }
        setPageActionError(
          isAdminQuestionMissingError(error)
            ? "题目不存在，已从当前列表移除。"
            : getAdminQuestionsErrorMessage(error, isolated ? "加入隔离池失败" : "移出隔离池失败")
        );
      }
    );
  }, [
    handleAuthRequired,
    listActionRequestIdRef,
    loadQuestions,
    removeQuestionFromCurrentPage,
    runWithStepUp,
    setPageActionError
  ]);

  const handleRecheckQuality = useCallback(async () => {
    const requestId = recheckRequestIdRef.current + 1;
    recheckRequestIdRef.current = requestId;
    setRecheckMessage(null);
    setRecheckError(null);
    setPageActionError(null);
    setRecheckLoading(true);
    try {
      await runWithStepUp(
        async () => {
          const data = await requestJson<QuestionQualityRecheckResponse>("/api/admin/questions/quality/recheck", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildAdminQuestionsRecheckPayload(query))
          });

          if (recheckRequestIdRef.current !== requestId) {
            return;
          }

          setRecheckMessage(formatAdminQuestionsRecheckMessage(data?.data));
          await loadQuestions();
        },
        (error) => {
          if (recheckRequestIdRef.current !== requestId) {
            return;
          }
          if (isAuthError(error)) {
            handleAuthRequired();
            return;
          }
          setRecheckError(getAdminQuestionsErrorMessage(error, "批量重算失败"));
        }
      );
    } finally {
      if (recheckRequestIdRef.current === requestId) {
        setRecheckLoading(false);
      }
    }
  }, [
    handleAuthRequired,
    loadQuestions,
    query,
    recheckRequestIdRef,
    runWithStepUp,
    setPageActionError,
    setRecheckError,
    setRecheckLoading,
    setRecheckMessage
  ]);

  return {
    handleDelete,
    handleToggleIsolation,
    handleRecheckQuality
  };
}
