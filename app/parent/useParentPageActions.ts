"use client";

import {
  useCallback,
  type Dispatch,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { ParentActionItem, ReceiptSource, ReceiptStatus } from "./types";
import type { ParentLoadResult } from "./useParentPageLoaders";
import {
  getParentReceiptSubmitRequestMessage,
  isParentMissingActionItemError,
  isParentMissingStudentContextError
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type ParentActionReceiptPayload = {
  data?: unknown;
};

type ParentPageActionsOptions = {
  receiptNotes: Record<string, string>;
  loadAll: (mode?: "initial" | "refresh") => Promise<ParentLoadResult>;
  handleAuthRequired: () => void;
  clearParentPageState: () => void;
  setReceiptLoadingKey: Setter<string | null>;
  setReceiptError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
  setReminderCopied: Setter<boolean>;
  setAssignmentCopied: Setter<boolean>;
};

export function useParentPageActions({
  receiptNotes,
  loadAll,
  handleAuthRequired,
  clearParentPageState,
  setReceiptLoadingKey,
  setReceiptError,
  setAuthRequired,
  setReminderCopied,
  setAssignmentCopied
}: ParentPageActionsOptions) {
  const submitReceipt = useCallback(async (
    source: ReceiptSource,
    item: ParentActionItem,
    status: ReceiptStatus
  ) => {
    const key = `${source}:${item.id}`;
    const note = (receiptNotes[key] ?? "").trim();
    if (status === "skipped" && note.length < 2) {
      setReceiptError("如选择“暂时跳过”，请填写至少 2 个字的原因。");
      return;
    }

    setReceiptError(null);
    setReceiptLoadingKey(key);
    try {
      await requestJson<ParentActionReceiptPayload>("/api/parent/action-items/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          actionItemId: item.id,
          status,
          note: note || undefined,
          estimatedMinutes: item.estimatedMinutes ?? 0
        })
      });
      await loadAll("refresh");
    } catch (nextError) {
      if (isParentMissingStudentContextError(nextError)) {
        clearParentPageState();
        setAuthRequired(false);
        setReceiptError(getParentReceiptSubmitRequestMessage(nextError, "回执提交失败"));
        return;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      const nextReceiptError = getParentReceiptSubmitRequestMessage(nextError, "回执提交失败");
      setReceiptError(nextReceiptError);
      if (isParentMissingActionItemError(nextError)) {
        await loadAll("refresh");
      }
    } finally {
      setReceiptLoadingKey(null);
    }
  }, [
    clearParentPageState,
    handleAuthRequired,
    loadAll,
    receiptNotes,
    setAuthRequired,
    setReceiptError,
    setReceiptLoadingKey
  ]);

  const copyText = useCallback(async (text: string, setCopied: Setter<boolean>) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, []);

  const copyCorrectionsReminder = useCallback(async (text: string) => {
    await copyText(text, setReminderCopied);
  }, [copyText, setReminderCopied]);

  const copyAssignmentsReminder = useCallback(async (text: string) => {
    await copyText(text, setAssignmentCopied);
  }, [copyText, setAssignmentCopied]);

  return {
    submitReceipt,
    copyCorrectionsReminder,
    copyAssignmentsReminder
  };
}
