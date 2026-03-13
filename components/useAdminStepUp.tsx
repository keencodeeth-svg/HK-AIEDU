"use client";

import { useRef, useState } from "react";
import AdminStepUpDialog from "./AdminStepUpDialog";
import { getRequestStatus, requestJson, getRequestErrorMessage } from "@/lib/client-request";

type ProtectedAction = () => Promise<void>;
type ActionErrorHandler = (error: unknown) => void;

export function useAdminStepUp() {
  const pendingActionRef = useRef<ProtectedAction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPending, setDialogPending] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  async function runWithStepUp(action: ProtectedAction, onError?: ActionErrorHandler) {
    try {
      await action();
    } catch (error) {
      if (getRequestStatus(error) === 428) {
        pendingActionRef.current = () => runWithStepUp(action, onError);
        setDialogError(null);
        setDialogOpen(true);
        return;
      }
      if (onError) {
        onError(error);
        return;
      }
      throw error;
    }
  }

  function closeDialog() {
    if (dialogPending) {
      return;
    }
    pendingActionRef.current = null;
    setDialogError(null);
    setDialogOpen(false);
  }

  async function submit(password: string) {
    setDialogPending(true);
    setDialogError(null);

    try {
      await requestJson("/api/admin/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const retry = pendingActionRef.current;
      pendingActionRef.current = null;
      setDialogOpen(false);
      setDialogError(null);
      if (retry) {
        queueMicrotask(() => {
          void retry();
        });
      }
    } catch (error) {
      setDialogError(getRequestErrorMessage(error, "管理员验证失败"));
    } finally {
      setDialogPending(false);
    }
  }

  return {
    runWithStepUp,
    stepUpDialog: (
      <AdminStepUpDialog
        open={dialogOpen}
        pending={dialogPending}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={submit}
      />
    )
  };
}
