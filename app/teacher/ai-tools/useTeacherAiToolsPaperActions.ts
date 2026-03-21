"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useCallback } from "react";
import {
  getRequestErrorPayload,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  PaperFormState,
  PaperGenerationResult,
  PaperQuickFixAction
} from "./types";
import {
  applyTeacherPaperQuickFix,
  getTeacherAiToolsRequestMessage,
  isMissingTeacherAiToolsClassError
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type PaperGenerateResponse = {
  data?: PaperGenerationResult;
};

type PaperGenerateErrorPayload = {
  details?: {
    suggestions?: string[];
  };
};

type TeacherAiToolsPaperActionsOptions = {
  paperForm: PaperFormState;
  loading: boolean;
  paperAutoFixing: boolean;
  handleAuthRequired: () => void;
  resetPaperScope: (nextClassId?: string) => void;
  loadBootstrapData: () => Promise<void>;
  setLoading: Setter<boolean>;
  setPaperForm: Setter<PaperFormState>;
  setPaperResult: Setter<PaperGenerationResult | null>;
  setPaperError: Setter<string | null>;
  setPaperErrorSuggestions: Setter<string[]>;
  setPaperAutoFixHint: Setter<string | null>;
  setPaperAutoFixing: Setter<boolean>;
};

export function useTeacherAiToolsPaperActions({
  paperForm,
  loading,
  paperAutoFixing,
  handleAuthRequired,
  resetPaperScope,
  loadBootstrapData,
  setLoading,
  setPaperForm,
  setPaperResult,
  setPaperError,
  setPaperErrorSuggestions,
  setPaperAutoFixHint,
  setPaperAutoFixing
}: TeacherAiToolsPaperActionsOptions) {
  const requestGeneratePaper = useCallback(async (nextForm: PaperFormState) => {
    setLoading(true);
    setPaperError(null);
    setPaperErrorSuggestions([]);
    try {
      const payload = await requestJson<PaperGenerateResponse>("/api/teacher/paper/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextForm)
      });
      setPaperResult(payload.data ?? null);
      return true;
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return false;
      }
      setPaperResult(null);
      setPaperError(getTeacherAiToolsRequestMessage(nextError, "组卷失败，请稍后重试", "paper"));
      const payload = getRequestErrorPayload<PaperGenerateErrorPayload>(nextError);
      if (isMissingTeacherAiToolsClassError(nextError)) {
        resetPaperScope("");
        void loadBootstrapData();
      }
      setPaperErrorSuggestions(Array.isArray(payload?.details?.suggestions) ? payload.details.suggestions : []);
      return false;
    } finally {
      setLoading(false);
    }
  }, [
    handleAuthRequired,
    loadBootstrapData,
    resetPaperScope,
    setLoading,
    setPaperError,
    setPaperErrorSuggestions,
    setPaperResult
  ]);

  const handleGeneratePaper = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (!paperForm.classId) return;
    setPaperAutoFixHint(null);
    await requestGeneratePaper(paperForm);
  }, [paperForm, requestGeneratePaper, setPaperAutoFixHint]);

  const applyPaperQuickFix = useCallback(async (action: PaperQuickFixAction) => {
    if (!paperForm.classId || paperAutoFixing || loading) return;
    const { nextForm, hint } = applyTeacherPaperQuickFix(paperForm, action);
    setPaperForm(nextForm);
    setPaperAutoFixHint(hint);
    setPaperAutoFixing(true);
    try {
      await requestGeneratePaper(nextForm);
    } finally {
      setPaperAutoFixing(false);
    }
  }, [
    loading,
    paperAutoFixing,
    paperForm,
    requestGeneratePaper,
    setPaperAutoFixHint,
    setPaperAutoFixing,
    setPaperForm
  ]);

  return {
    handleGeneratePaper,
    applyPaperQuickFix
  };
}
