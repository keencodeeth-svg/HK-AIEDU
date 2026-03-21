"use client";

import { type Dispatch, type SetStateAction, useCallback } from "react";
import { requestJson } from "@/lib/client-request";
import { isSchoolAdminAuthRequiredError } from "../utils";
import type {
  AiOperationSummary,
  AiRollbackResponse,
  AiScheduleFormState,
  AiScheduleResponse
} from "./types";
import {
  buildAiRequestBodyFromForm,
  DEFAULT_AI_FORM,
  getSchoolSchedulesRequestMessage,
  isMissingSchoolScheduleOperationError,
  isMissingSchoolSchedulePreviewError,
  toggleSortedWeekdaySelection
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type SchoolSchedulesAiActionsOptions = {
  aiForm: AiScheduleFormState;
  aiResult: AiScheduleResponse["data"] | null;
  latestAiOperation: AiOperationSummary | null;
  loadData: (mode?: "initial" | "refresh") => Promise<void>;
  handleAuthRequired: () => void;
  setAiForm: Setter<AiScheduleFormState>;
  setAiGenerating: Setter<boolean>;
  setAiRollingBack: Setter<boolean>;
  setAiMessage: Setter<string | null>;
  setAiError: Setter<string | null>;
  setAiResult: Setter<AiScheduleResponse["data"] | null>;
  setLatestAiOperation: Setter<AiOperationSummary | null>;
};

export function useSchoolSchedulesAiActions({
  aiForm,
  aiResult,
  latestAiOperation,
  loadData,
  handleAuthRequired,
  setAiForm,
  setAiGenerating,
  setAiRollingBack,
  setAiMessage,
  setAiError,
  setAiResult,
  setLatestAiOperation
}: SchoolSchedulesAiActionsOptions) {
  const toggleSelectedAiWeekday = useCallback(
    (weekday: string) => {
      setAiForm((prev) => ({
        ...prev,
        weekdays: toggleSortedWeekdaySelection(prev.weekdays, weekday)
      }));
    },
    [setAiForm]
  );

  const resetAiForm = useCallback(() => {
    setAiForm(DEFAULT_AI_FORM);
    setAiError(null);
    setAiMessage(null);
    setAiResult(null);
  }, [setAiError, setAiForm, setAiMessage, setAiResult]);

  const handleAiPreview = useCallback(async () => {
    try {
      const payload = buildAiRequestBodyFromForm(aiForm);
      setAiGenerating(true);
      setAiError(null);
      setAiMessage(null);
      const result = await requestJson<AiScheduleResponse>("/api/school/schedules/ai-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setAiResult(result.data ?? null);
      setAiMessage(`AI 预演已完成，预计新增 ${result.data?.summary.createdSessions ?? 0} 个节次。`);
    } catch (error) {
      if (isSchoolAdminAuthRequiredError(error)) {
        handleAuthRequired();
      } else {
        setAiError(getSchoolSchedulesRequestMessage(error, "AI 预演失败"));
      }
    } finally {
      setAiGenerating(false);
    }
  }, [aiForm, handleAuthRequired, setAiError, setAiGenerating, setAiMessage, setAiResult]);

  const handleAiApplyPreview = useCallback(async () => {
    if (!aiResult?.previewId) {
      setAiError("请先完成一次 AI 预演。");
      return;
    }
    if (aiForm.mode === "replace_all" && typeof window !== "undefined") {
      const confirmed = window.confirm("确认将本次 AI 预演正式写入课表吗？系统会保留已锁定节次，并支持回滚最近一次 AI 排课。");
      if (!confirmed) return;
    }

    setAiGenerating(true);
    setAiError(null);
    setAiMessage(null);
    try {
      const result = await requestJson<AiScheduleResponse>(`/api/school/schedules/ai-preview/${aiResult.previewId}/apply`, {
        method: "POST"
      });
      setAiResult(result.data ?? null);
      await loadData("refresh");
      setAiMessage(`AI 排课已写入课表，本次新增 ${result.data?.summary.createdSessions ?? 0} 个节次。`);
    } catch (error) {
      if (isSchoolAdminAuthRequiredError(error)) {
        handleAuthRequired();
      } else if (isMissingSchoolSchedulePreviewError(error)) {
        setAiResult(null);
        await loadData("refresh");
        setAiError(getSchoolSchedulesRequestMessage(error, "确认写入 AI 排课失败"));
      } else {
        setAiError(getSchoolSchedulesRequestMessage(error, "确认写入 AI 排课失败"));
      }
    } finally {
      setAiGenerating(false);
    }
  }, [
    aiForm.mode,
    aiResult?.previewId,
    handleAuthRequired,
    loadData,
    setAiError,
    setAiGenerating,
    setAiMessage,
    setAiResult
  ]);

  const handleAiRollback = useCallback(async () => {
    if (!latestAiOperation?.id) {
      setAiError("当前没有可回滚的 AI 排课记录。");
      return;
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("确定回滚最近一次已写入的 AI 排课吗？仅在课表未被后续人工调整时可成功回滚。");
      if (!confirmed) return;
    }

    setAiRollingBack(true);
    setAiError(null);
    setAiMessage(null);
    try {
      const result = await requestJson<AiRollbackResponse>("/api/school/schedules/ai-operations/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId: latestAiOperation.id })
      });
      setAiResult(null);
      await loadData("refresh");
      setAiMessage(`已回滚最近一次 AI 排课，恢复 ${result.data?.restoredSessionCount ?? 0} 个节次。`);
    } catch (error) {
      if (isSchoolAdminAuthRequiredError(error)) {
        handleAuthRequired();
      } else if (isMissingSchoolScheduleOperationError(error)) {
        setLatestAiOperation(null);
        await loadData("refresh");
        setAiError(getSchoolSchedulesRequestMessage(error, "回滚 AI 排课失败"));
      } else {
        setAiError(getSchoolSchedulesRequestMessage(error, "回滚 AI 排课失败"));
      }
    } finally {
      setAiRollingBack(false);
    }
  }, [
    handleAuthRequired,
    latestAiOperation?.id,
    loadData,
    setAiError,
    setAiMessage,
    setAiResult,
    setAiRollingBack,
    setLatestAiOperation
  ]);

  return {
    toggleAiWeekday: toggleSelectedAiWeekday,
    resetAiForm,
    handleAiPreview,
    handleAiApplyPreview,
    handleAiRollback
  };
}
