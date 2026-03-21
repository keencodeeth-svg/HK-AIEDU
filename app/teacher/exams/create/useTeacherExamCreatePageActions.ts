"use client";

import type { FormEvent } from "react";
import {
  useCallback,
  type Dispatch,
  type SetStateAction
} from "react";
import {
  getRequestErrorPayload,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type { FormState, ScheduleStatus, StageTrailItem } from "./types";
import {
  buildTeacherExamCreateSubmitPayload,
  buildTeacherExamCreateSuccessMessage,
  getTeacherExamCreateRequestMessage
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type CreateExamResponse = {
  message?: string;
  data?: {
    id?: string;
    warnings?: string[];
  };
};

type CreateExamErrorPayload = {
  details?: {
    suggestions?: string[];
    stageTrail?: StageTrailItem[];
  };
};

type TeacherExamCreateRouter = {
  push: (href: string) => void;
};

type TeacherExamCreatePageActionsOptions = {
  router: TeacherExamCreateRouter;
  form: FormState;
  scheduleStatus: ScheduleStatus;
  saving: boolean;
  setSaving: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setSubmitError: Setter<string | null>;
  setSubmitMessage: Setter<string | null>;
  setSubmitSuggestions: Setter<string[]>;
  setStageTrail: Setter<StageTrailItem[]>;
};

export function useTeacherExamCreatePageActions({
  router,
  form,
  scheduleStatus,
  saving,
  setSaving,
  setAuthRequired,
  setSubmitError,
  setSubmitMessage,
  setSubmitSuggestions,
  setStageTrail
}: TeacherExamCreatePageActionsOptions) {
  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (saving) {
        return;
      }

      setSaving(true);
      setSubmitError(null);
      setSubmitMessage(null);
      setSubmitSuggestions([]);
      setStageTrail([]);

      if (!scheduleStatus.canSubmit) {
        setSubmitError(scheduleStatus.title);
        setSaving(false);
        return;
      }

      try {
        const payload = await requestJson<CreateExamResponse>("/api/teacher/exams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildTeacherExamCreateSubmitPayload(form))
        });

        setSubmitMessage(
          buildTeacherExamCreateSuccessMessage(payload.message, payload.data?.warnings)
        );
        setAuthRequired(false);

        const examId = payload.data?.id;
        router.push(examId ? `/teacher/exams/${examId}` : "/teacher/exams");
      } catch (nextError) {
        if (isAuthError(nextError)) {
          setAuthRequired(true);
          return;
        }

        const details = getRequestErrorPayload<CreateExamErrorPayload>(nextError)?.details;
        setSubmitError(getTeacherExamCreateRequestMessage(nextError, "发布失败"));
        setSubmitSuggestions(
          Array.isArray(details?.suggestions)
            ? details.suggestions.filter(Boolean)
            : []
        );
        setStageTrail(Array.isArray(details?.stageTrail) ? details.stageTrail : []);
      } finally {
        setSaving(false);
      }
    },
    [
      form,
      router,
      saving,
      scheduleStatus,
      setAuthRequired,
      setSaving,
      setStageTrail,
      setSubmitError,
      setSubmitMessage,
      setSubmitSuggestions
    ]
  );

  return {
    handleSubmit
  };
}
