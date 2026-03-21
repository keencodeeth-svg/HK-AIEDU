"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useCallback } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  OutlineFormState,
  OutlineResult,
  QuestionCheckFormState,
  QuestionCheckResult,
  ReviewPackDispatchOptions,
  ReviewPackDispatchPayload,
  ReviewPackDispatchQuality,
  ReviewPackDispatchResult,
  ReviewPackFailedItem,
  ReviewPackRelaxedItem,
  ReviewPackResult,
  ReviewPackReviewSheetItem,
  WrongReviewFormState,
  WrongReviewResult
} from "./types";
import {
  buildTeacherReviewPackDispatchMessage,
  getTeacherAiToolsRequestMessage,
  isMissingTeacherAiToolsClassError,
  isMissingTeacherAiToolsQuestionError,
  summarizeTeacherReviewPackFailedItems
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type OutlineResponse = {
  data?: OutlineResult;
};

type WrongReviewResponse = {
  data?: WrongReviewResult;
};

type ReviewPackResponse = {
  data?: ReviewPackResult;
};

type QuestionCheckResponse = {
  data?: QuestionCheckResult;
};

type ReviewPackDispatchResponse = {
  data?: ReviewPackDispatchPayload | null;
};

type TeacherAiToolsWorkflowActionsOptions = {
  outlineForm: OutlineFormState;
  wrongForm: WrongReviewFormState;
  reviewPackResult: ReviewPackResult | null;
  reviewPackFailedItems: ReviewPackFailedItem[];
  reviewPackDispatchIncludeIsolated: boolean;
  checkForm: QuestionCheckFormState;
  handleAuthRequired: () => void;
  resetOutlineScope: (nextClassId?: string) => void;
  resetWrongScope: (nextClassId?: string) => void;
  loadBootstrapData: () => Promise<void>;
  setLoading: Setter<boolean>;
  setOutlineError: Setter<string | null>;
  setOutlineResult: Setter<OutlineResult | null>;
  setWrongError: Setter<string | null>;
  setWrongResult: Setter<WrongReviewResult | null>;
  setReviewPackError: Setter<string | null>;
  setReviewPackResult: Setter<ReviewPackResult | null>;
  setReviewPackAssigningId: Setter<string | null>;
  setReviewPackAssigningAll: Setter<boolean>;
  setReviewPackAssignMessage: Setter<string | null>;
  setReviewPackAssignError: Setter<string | null>;
  setReviewPackDispatchQuality: Setter<ReviewPackDispatchQuality | null>;
  setReviewPackFailedItems: Setter<ReviewPackFailedItem[]>;
  setReviewPackRelaxedItems: Setter<ReviewPackRelaxedItem[]>;
  setReviewPackRetryingFailed: Setter<boolean>;
  setCheckForm: Setter<QuestionCheckFormState>;
  setCheckError: Setter<string | null>;
  setCheckResult: Setter<QuestionCheckResult | null>;
};

export function useTeacherAiToolsWorkflowActions({
  outlineForm,
  wrongForm,
  reviewPackResult,
  reviewPackFailedItems,
  reviewPackDispatchIncludeIsolated,
  checkForm,
  handleAuthRequired,
  resetOutlineScope,
  resetWrongScope,
  loadBootstrapData,
  setLoading,
  setOutlineError,
  setOutlineResult,
  setWrongError,
  setWrongResult,
  setReviewPackError,
  setReviewPackResult,
  setReviewPackAssigningId,
  setReviewPackAssigningAll,
  setReviewPackAssignMessage,
  setReviewPackAssignError,
  setReviewPackDispatchQuality,
  setReviewPackFailedItems,
  setReviewPackRelaxedItems,
  setReviewPackRetryingFailed,
  setCheckForm,
  setCheckError,
  setCheckResult
}: TeacherAiToolsWorkflowActionsOptions) {
  const dispatchReviewPackItems = useCallback(async (
    items: ReviewPackReviewSheetItem[],
    options?: ReviewPackDispatchOptions
  ): Promise<ReviewPackDispatchResult> => {
    try {
      const payload = await requestJson<ReviewPackDispatchResponse>("/api/teacher/lesson/review-pack/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: wrongForm.classId,
          items,
          includeIsolated: options?.includeIsolated ?? reviewPackDispatchIncludeIsolated,
          autoRelaxOnInsufficient: options?.autoRelaxOnInsufficient ?? false
        })
      });
      return {
        ok: true,
        data: payload.data ?? null
      };
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else if (isMissingTeacherAiToolsClassError(nextError)) {
        resetWrongScope("");
        void loadBootstrapData();
      }
      return {
        ok: false,
        error: getTeacherAiToolsRequestMessage(nextError, "下发失败", "review_pack_dispatch")
      };
    }
  }, [
    handleAuthRequired,
    loadBootstrapData,
    resetWrongScope,
    reviewPackDispatchIncludeIsolated,
    wrongForm.classId
  ]);

  const handleGenerateOutline = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (!outlineForm.classId || !outlineForm.topic) return;
    setLoading(true);
    setOutlineError(null);
    try {
      const payload = await requestJson<OutlineResponse>("/api/teacher/lesson/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outlineForm)
      });
      setOutlineResult(payload.data ?? null);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      setOutlineResult(null);
      if (isMissingTeacherAiToolsClassError(nextError)) {
        resetOutlineScope("");
        void loadBootstrapData();
      }
      setOutlineError(getTeacherAiToolsRequestMessage(nextError, "生成讲稿失败，请稍后重试", "outline"));
    } finally {
      setLoading(false);
    }
  }, [
    handleAuthRequired,
    loadBootstrapData,
    outlineForm,
    resetOutlineScope,
    setLoading,
    setOutlineError,
    setOutlineResult
  ]);

  const handleWrongReview = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (!wrongForm.classId) return;
    setLoading(true);
    setWrongError(null);
    try {
      const payload = await requestJson<WrongReviewResponse>("/api/teacher/lesson/wrong-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wrongForm)
      });
      setWrongResult(payload.data ?? null);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      setWrongResult(null);
      if (isMissingTeacherAiToolsClassError(nextError)) {
        resetWrongScope("");
        void loadBootstrapData();
      }
      setWrongError(getTeacherAiToolsRequestMessage(nextError, "生成讲评脚本失败，请稍后重试", "wrong_review"));
    } finally {
      setLoading(false);
    }
  }, [
    handleAuthRequired,
    loadBootstrapData,
    resetWrongScope,
    setLoading,
    setWrongError,
    setWrongResult,
    wrongForm
  ]);

  const handleReviewPack = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (!wrongForm.classId) return;
    setReviewPackError(null);
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);
    setReviewPackDispatchQuality(null);
    setReviewPackFailedItems([]);
    setReviewPackRelaxedItems([]);
    setLoading(true);
    try {
      const payload = await requestJson<ReviewPackResponse>("/api/teacher/lesson/review-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wrongForm)
      });
      setReviewPackResult(payload.data ?? null);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      setReviewPackResult(null);
      if (isMissingTeacherAiToolsClassError(nextError)) {
        resetWrongScope("");
        void loadBootstrapData();
      }
      setReviewPackError(getTeacherAiToolsRequestMessage(nextError, "生成讲评包失败，请稍后重试", "review_pack"));
    } finally {
      setLoading(false);
    }
  }, [
    handleAuthRequired,
    loadBootstrapData,
    resetWrongScope,
    setLoading,
    setReviewPackAssignError,
    setReviewPackAssignMessage,
    setReviewPackDispatchQuality,
    setReviewPackError,
    setReviewPackFailedItems,
    setReviewPackRelaxedItems,
    setReviewPackResult,
    wrongForm
  ]);

  const handleCheckQuestion = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setCheckError(null);
    try {
      const payload = await requestJson<QuestionCheckResponse>("/api/teacher/questions/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: checkForm.questionId || undefined,
          stem: checkForm.stem,
          options: checkForm.options,
          answer: checkForm.answer,
          explanation: checkForm.explanation
        })
      });
      setCheckResult(payload.data ?? null);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      setCheckResult(null);
      if (isMissingTeacherAiToolsQuestionError(nextError)) {
        setCheckForm((prev) => ({ ...prev, questionId: "" }));
      }
      setCheckError(getTeacherAiToolsRequestMessage(nextError, "题目纠错失败，请稍后重试", "question_check"));
    } finally {
      setLoading(false);
    }
  }, [
    checkForm,
    handleAuthRequired,
    setCheckError,
    setCheckForm,
    setCheckResult,
    setLoading
  ]);

  const handleAssignReviewSheet = useCallback(async (item: ReviewPackReviewSheetItem) => {
    if (!wrongForm.classId) return;
    const assignKey = String(item?.id ?? "");
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);
    setReviewPackFailedItems([]);
    setReviewPackRelaxedItems([]);
    setReviewPackAssigningId(assignKey);

    try {
      const result = await dispatchReviewPackItems([item]);
      if (!result.ok) {
        setReviewPackAssignError(result.error);
        return;
      }
      const summary = result.data?.summary;
      const failed = result.data?.failed ?? [];
      setReviewPackFailedItems(failed);
      setReviewPackRelaxedItems(summary?.relaxed ?? []);
      setReviewPackDispatchQuality(summary?.qualityGovernance ?? null);
      setReviewPackAssignMessage(buildTeacherReviewPackDispatchMessage(summary, "single"));
      if (failed.length > 0) {
        setReviewPackAssignError(failed[0]?.reason ?? "下发失败");
      }
    } catch {
      setReviewPackAssignError("布置失败");
    } finally {
      setReviewPackAssigningId(null);
    }
  }, [
    dispatchReviewPackItems,
    setReviewPackAssignError,
    setReviewPackAssignMessage,
    setReviewPackAssigningId,
    setReviewPackDispatchQuality,
    setReviewPackFailedItems,
    setReviewPackRelaxedItems,
    wrongForm.classId
  ]);

  const handleAssignAllReviewSheets = useCallback(async () => {
    if (!wrongForm.classId) return;
    const items = reviewPackResult?.afterClassReviewSheet ?? [];
    if (!items.length) {
      setReviewPackAssignMessage(null);
      setReviewPackAssignError("暂无可布置的复练单");
      return;
    }
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);
    setReviewPackFailedItems([]);
    setReviewPackRelaxedItems([]);
    setReviewPackAssigningAll(true);

    let summary = null;
    let failedItems: ReviewPackFailedItem[] = [];
    try {
      const result = await dispatchReviewPackItems(items);
      if (!result.ok) {
        setReviewPackAssignError(result.error);
        return;
      }
      summary = result.data?.summary ?? null;
      failedItems = result.data?.failed ?? [];
      setReviewPackFailedItems(failedItems);
      setReviewPackRelaxedItems(summary?.relaxed ?? []);
      setReviewPackDispatchQuality(summary?.qualityGovernance ?? null);
    } catch {
      setReviewPackAssignError("批量下发失败");
      return;
    } finally {
      setReviewPackAssigningAll(false);
    }

    setReviewPackAssignMessage(buildTeacherReviewPackDispatchMessage(summary, "batch"));
    setReviewPackAssignError(summarizeTeacherReviewPackFailedItems(failedItems, "失败"));
  }, [
    dispatchReviewPackItems,
    reviewPackResult,
    setReviewPackAssignError,
    setReviewPackAssignMessage,
    setReviewPackAssigningAll,
    setReviewPackDispatchQuality,
    setReviewPackFailedItems,
    setReviewPackRelaxedItems,
    wrongForm.classId
  ]);

  const handleRetryFailedReviewSheets = useCallback(async () => {
    if (!wrongForm.classId || !reviewPackFailedItems.length) return;
    const retryItems = reviewPackFailedItems
      .map((item) => item?.item)
      .filter((item): item is ReviewPackReviewSheetItem => Boolean(item));

    if (!retryItems.length) {
      setReviewPackAssignError("失败项缺少重试参数，请重新生成讲评包后再试。");
      return;
    }

    setReviewPackRetryingFailed(true);
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);

    let summary = null;
    let failedItems: ReviewPackFailedItem[] = [];
    try {
      const result = await dispatchReviewPackItems(retryItems, {
        autoRelaxOnInsufficient: true
      });
      if (!result.ok) {
        setReviewPackAssignError(result.error);
        return;
      }
      summary = result.data?.summary ?? null;
      failedItems = result.data?.failed ?? [];
      setReviewPackFailedItems(failedItems);
      setReviewPackRelaxedItems(summary?.relaxed ?? []);
      setReviewPackDispatchQuality(summary?.qualityGovernance ?? null);
    } catch {
      setReviewPackAssignError("重试失败，请稍后再试");
      return;
    } finally {
      setReviewPackRetryingFailed(false);
    }

    setReviewPackAssignMessage(buildTeacherReviewPackDispatchMessage(summary, "retry"));
    setReviewPackAssignError(summarizeTeacherReviewPackFailedItems(failedItems, "重试后仍失败"));
  }, [
    dispatchReviewPackItems,
    reviewPackFailedItems,
    setReviewPackAssignError,
    setReviewPackAssignMessage,
    setReviewPackDispatchQuality,
    setReviewPackFailedItems,
    setReviewPackRelaxedItems,
    setReviewPackRetryingFailed,
    wrongForm.classId
  ]);

  return {
    handleGenerateOutline,
    handleWrongReview,
    handleReviewPack,
    handleAssignReviewSheet,
    handleAssignAllReviewSheets,
    handleRetryFailedReviewSheets,
    handleCheckQuestion
  };
}
