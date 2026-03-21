"use client";

import {
  useCallback,
  type Dispatch,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  CorrectionMutationResponse,
  CreateCorrectionResponse,
  ReviewQueueItem,
  ReviewResultResponse,
  WrongBookItem,
  WrongBookLoadStatus
} from "./types";
import {
  buildWrongBookReviewFeedbackMessage,
  getSelectedWrongBookQuestionIds,
  getWrongBookCompleteTaskRequestMessage,
  getWrongBookCreateTasksRequestMessage,
  getWrongBookReviewSubmitRequestMessage,
  getWrongBookTaskCompletionFeedback,
  getWrongBookTaskGenerationFeedback,
  isMissingWrongBookReviewQuestionError,
  isMissingWrongBookTaskError,
  normalizeWrongBookSkippedReason
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;
type WrongBookLoad = (mode?: "initial" | "refresh") => Promise<WrongBookLoadStatus>;

type WrongBookActionsOptions = {
  list: WrongBookItem[];
  selected: Record<string, boolean>;
  dueDate: string;
  reviewAnswers: Record<string, string>;
  load: WrongBookLoad;
  handleAuthRequired: () => void;
  clearTaskGeneratorFeedback: () => void;
  clearActionNotice: () => void;
  setSelected: Setter<Record<string, boolean>>;
  setReviewAnswers: Setter<Record<string, string>>;
  setReviewSubmitting: Setter<Record<string, boolean>>;
  setReviewMessages: Setter<Record<string, string>>;
  setTaskGeneratorMessage: Setter<string | null>;
  setTaskGeneratorErrors: Setter<string[]>;
  setActionMessage: Setter<string | null>;
  setActionError: Setter<string | null>;
  setCreatingTasks: Setter<boolean>;
  setCompletingTaskIds: Setter<Record<string, boolean>>;
  setAuthRequired: Setter<boolean>;
};

export function useWrongBookActions({
  list,
  selected,
  dueDate,
  reviewAnswers,
  load,
  handleAuthRequired,
  clearTaskGeneratorFeedback,
  clearActionNotice,
  setSelected,
  setReviewAnswers,
  setReviewSubmitting,
  setReviewMessages,
  setTaskGeneratorMessage,
  setTaskGeneratorErrors,
  setActionMessage,
  setActionError,
  setCreatingTasks,
  setCompletingTaskIds,
  setAuthRequired
}: WrongBookActionsOptions) {
  const handleCreateTasks = useCallback(async () => {
    clearTaskGeneratorFeedback();
    clearActionNotice();

    const ids = getSelectedWrongBookQuestionIds(list, selected);
    if (!ids.length) {
      setTaskGeneratorErrors(["请先选择要订正的错题。"]);
      return;
    }

    setCreatingTasks(true);

    try {
      const payload = await requestJson<CreateCorrectionResponse>("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: ids, dueDate })
      });
      const failed = payload.skipped ?? [];
      const createdCount = payload.created?.length ?? 0;

      setTaskGeneratorErrors(
        failed.map((item) => `${item.questionId}：${normalizeWrongBookSkippedReason(item.reason)}`)
      );
      setSelected({});

      const refreshStatus = await load("refresh");
      if (refreshStatus === "auth") {
        return;
      }

      setTaskGeneratorMessage(getWrongBookTaskGenerationFeedback(createdCount, refreshStatus));
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        setTaskGeneratorErrors([getWrongBookCreateTasksRequestMessage(nextError, "创建任务失败")]);
      }
    } finally {
      setCreatingTasks(false);
    }
  }, [
    clearActionNotice,
    clearTaskGeneratorFeedback,
    dueDate,
    handleAuthRequired,
    list,
    load,
    selected,
    setAuthRequired,
    setCreatingTasks,
    setSelected,
    setTaskGeneratorErrors,
    setTaskGeneratorMessage
  ]);

  const handleComplete = useCallback(async (id: string) => {
    clearActionNotice();
    setCompletingTaskIds((prev) => ({ ...prev, [id]: true }));

    try {
      await requestJson<CorrectionMutationResponse>(`/api/corrections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" })
      });

      const refreshStatus = await load("refresh");
      if (refreshStatus === "auth") {
        return;
      }

      setActionMessage(getWrongBookTaskCompletionFeedback(refreshStatus));
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        const nextErrorMessage = getWrongBookCompleteTaskRequestMessage(nextError, "更新订正任务失败");
        if (isMissingWrongBookTaskError(nextError)) {
          const refreshStatus = await load("refresh");
          if (refreshStatus === "auth") {
            return;
          }
        }
        setAuthRequired(false);
        setActionError(nextErrorMessage);
      }
    } finally {
      setCompletingTaskIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [
    clearActionNotice,
    handleAuthRequired,
    load,
    setActionError,
    setActionMessage,
    setAuthRequired,
    setCompletingTaskIds
  ]);

  const submitReview = useCallback(async (item: ReviewQueueItem) => {
    const answer = reviewAnswers[item.questionId];
    if (!answer) {
      setReviewMessages((prev) => ({ ...prev, [item.questionId]: "请先选择答案。" }));
      return;
    }

    clearActionNotice();
    setReviewSubmitting((prev) => ({ ...prev, [item.questionId]: true }));
    setReviewMessages((prev) => ({ ...prev, [item.questionId]: "" }));

    try {
      const payload = await requestJson<ReviewResultResponse>("/api/wrong-book/review-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: item.questionId, answer })
      });
      const refreshStatus = await load("refresh");
      if (refreshStatus === "auth") {
        return;
      }

      setReviewMessages((prev) => ({
        ...prev,
        [item.questionId]: buildWrongBookReviewFeedbackMessage({
          correct: payload.correct,
          intervalLabel: payload.review?.intervalLabel,
          nextReviewAt: payload.nextReviewAt,
          refreshStatus
        })
      }));
      setReviewAnswers((prev) => {
        const next = { ...prev };
        delete next[item.questionId];
        return next;
      });
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        const nextErrorMessage = getWrongBookReviewSubmitRequestMessage(nextError, "提交失败");

        if (isMissingWrongBookReviewQuestionError(nextError)) {
          const refreshStatus = await load("refresh");
          if (refreshStatus === "auth") {
            return;
          }
          setActionError(nextErrorMessage);
        } else {
          setReviewMessages((prev) => ({ ...prev, [item.questionId]: nextErrorMessage }));
        }
        setAuthRequired(false);
      }
    } finally {
      setReviewSubmitting((prev) => {
        const next = { ...prev };
        delete next[item.questionId];
        return next;
      });
    }
  }, [
    clearActionNotice,
    handleAuthRequired,
    load,
    reviewAnswers,
    setActionError,
    setAuthRequired,
    setReviewAnswers,
    setReviewMessages,
    setReviewSubmitting
  ]);

  return {
    handleCreateTasks,
    handleComplete,
    submitReview
  };
}
