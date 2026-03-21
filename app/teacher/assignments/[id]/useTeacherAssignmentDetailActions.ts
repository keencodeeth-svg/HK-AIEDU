"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  AssignmentNotifyTarget,
  AssignmentStudentFilter,
  RubricItem,
  RubricLevel,
  TeacherAssignmentDetailData
} from "./types";
import {
  appendTeacherAssignmentRubricItem,
  appendTeacherAssignmentRubricLevel,
  getTeacherAssignmentDetailRequestMessage,
  isMissingTeacherAssignmentDetailError,
  normalizeRubricItems,
  patchTeacherAssignmentRubricItem,
  patchTeacherAssignmentRubricLevel,
  removeTeacherAssignmentRubricItem,
  removeTeacherAssignmentRubricLevel
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type AssignmentRubricsResponse = {
  data?: RubricItem[];
};

type AssignmentNotifyResponse = {
  data?: {
    students?: number;
    parents?: number;
  };
};

type TeacherAssignmentDetailActionsOptions = {
  data: TeacherAssignmentDetailData | null;
  notifyTarget: AssignmentNotifyTarget;
  threshold: number;
  notifyMessage: string;
  notifyLoading: boolean;
  rubrics: RubricItem[];
  rubricsReady: boolean;
  rubricSaving: boolean;
  notifyRequestIdRef: MutableRefObject<number>;
  saveRubricsRequestIdRef: MutableRefObject<number>;
  clearAssignmentDetailState: () => void;
  handleAuthRequired: () => void;
  setAuthRequired: Setter<boolean>;
  setLoadError: Setter<string | null>;
  setNotifyLoading: Setter<boolean>;
  setNotifySuccess: Setter<string | null>;
  setNotifyError: Setter<string | null>;
  setRubrics: Setter<RubricItem[]>;
  setRubricsReady: Setter<boolean>;
  setRubricLoadError: Setter<string | null>;
  setRubricMessage: Setter<string | null>;
  setRubricError: Setter<string | null>;
  setRubricSaving: Setter<boolean>;
  setStudentFilter: Setter<AssignmentStudentFilter>;
  setStudentKeyword: Setter<string>;
};

export function useTeacherAssignmentDetailActions({
  data,
  notifyTarget,
  threshold,
  notifyMessage,
  notifyLoading,
  rubrics,
  rubricsReady,
  rubricSaving,
  notifyRequestIdRef,
  saveRubricsRequestIdRef,
  clearAssignmentDetailState,
  handleAuthRequired,
  setAuthRequired,
  setLoadError,
  setNotifyLoading,
  setNotifySuccess,
  setNotifyError,
  setRubrics,
  setRubricsReady,
  setRubricLoadError,
  setRubricMessage,
  setRubricError,
  setRubricSaving,
  setStudentFilter,
  setStudentKeyword
}: TeacherAssignmentDetailActionsOptions) {
  const updateRubric = useCallback((index: number, patch: Partial<RubricItem>) => {
    setRubrics((current) => patchTeacherAssignmentRubricItem(current, index, patch));
  }, [setRubrics]);

  const updateLevel = useCallback((rubricIndex: number, levelIndex: number, patch: Partial<RubricLevel>) => {
    setRubrics((current) => patchTeacherAssignmentRubricLevel(current, rubricIndex, levelIndex, patch));
  }, [setRubrics]);

  const addRubric = useCallback(() => {
    setRubrics((current) => appendTeacherAssignmentRubricItem(current));
  }, [setRubrics]);

  const removeRubric = useCallback((index: number) => {
    setRubrics((current) => removeTeacherAssignmentRubricItem(current, index));
  }, [setRubrics]);

  const addLevel = useCallback((index: number) => {
    setRubrics((current) => appendTeacherAssignmentRubricLevel(current, index));
  }, [setRubrics]);

  const removeLevel = useCallback((rubricIndex: number, levelIndex: number) => {
    setRubrics((current) => removeTeacherAssignmentRubricLevel(current, rubricIndex, levelIndex));
  }, [setRubrics]);

  const clearStudentFilters = useCallback(() => {
    setStudentFilter("all");
    setStudentKeyword("");
  }, [setStudentFilter, setStudentKeyword]);

  const handleNotify = useCallback(async () => {
    if (!data || notifyLoading) {
      return;
    }

    const requestId = notifyRequestIdRef.current + 1;
    notifyRequestIdRef.current = requestId;
    setNotifyLoading(true);
    setNotifySuccess(null);
    setNotifyError(null);

    try {
      const payload = await requestJson<AssignmentNotifyResponse>(`/api/teacher/assignments/${data.assignment.id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: notifyTarget,
          threshold,
          message: notifyMessage
        })
      });
      if (requestId !== notifyRequestIdRef.current) {
        return;
      }
      setNotifySuccess(`已通知学生 ${payload.data?.students ?? 0} 人，家长 ${payload.data?.parents ?? 0} 人。`);
      setAuthRequired(false);
    } catch (nextError) {
      if (requestId !== notifyRequestIdRef.current) {
        return;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      if (isMissingTeacherAssignmentDetailError(nextError)) {
        clearAssignmentDetailState();
        setLoadError(getTeacherAssignmentDetailRequestMessage(nextError, "加载失败"));
        return;
      }
      setNotifyError(getTeacherAssignmentDetailRequestMessage(nextError, "提醒失败"));
    } finally {
      if (requestId === notifyRequestIdRef.current) {
        setNotifyLoading(false);
      }
    }
  }, [
    clearAssignmentDetailState,
    data,
    handleAuthRequired,
    notifyLoading,
    notifyMessage,
    notifyRequestIdRef,
    notifyTarget,
    setAuthRequired,
    setLoadError,
    setNotifyError,
    setNotifyLoading,
    setNotifySuccess,
    threshold
  ]);

  const handleSaveRubrics = useCallback(async () => {
    if (!data || rubricSaving || !rubricsReady) {
      return;
    }

    const requestId = saveRubricsRequestIdRef.current + 1;
    saveRubricsRequestIdRef.current = requestId;
    setRubricSaving(true);
    setRubricMessage(null);
    setRubricError(null);

    try {
      const payload = await requestJson<AssignmentRubricsResponse>(`/api/teacher/assignments/${data.assignment.id}/rubrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rubrics })
      });
      if (requestId !== saveRubricsRequestIdRef.current) {
        return;
      }
      setRubricMessage("评分细则已保存");
      setRubrics(normalizeRubricItems(payload.data ?? []));
      setRubricsReady(true);
      setRubricLoadError(null);
      setAuthRequired(false);
    } catch (nextError) {
      if (requestId !== saveRubricsRequestIdRef.current) {
        return;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      if (isMissingTeacherAssignmentDetailError(nextError)) {
        clearAssignmentDetailState();
        setLoadError(getTeacherAssignmentDetailRequestMessage(nextError, "加载失败"));
        return;
      }
      setRubricError(getTeacherAssignmentDetailRequestMessage(nextError, "保存失败"));
    } finally {
      if (requestId === saveRubricsRequestIdRef.current) {
        setRubricSaving(false);
      }
    }
  }, [
    clearAssignmentDetailState,
    data,
    handleAuthRequired,
    rubricSaving,
    rubrics,
    rubricsReady,
    saveRubricsRequestIdRef,
    setAuthRequired,
    setLoadError,
    setRubricError,
    setRubricLoadError,
    setRubricMessage,
    setRubricSaving,
    setRubrics,
    setRubricsReady
  ]);

  return {
    updateRubric,
    updateLevel,
    addRubric,
    removeRubric,
    addLevel,
    removeLevel,
    clearStudentFilters,
    handleNotify,
    handleSaveRubrics
  };
}
