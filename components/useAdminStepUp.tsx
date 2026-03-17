"use client";

import { useRef, useState } from "react";
import AdminStepUpDialog from "./AdminStepUpDialog";
import { getRequestStatus, requestJson, getRequestErrorMessage } from "@/lib/client-request";

type ProtectedAction = () => Promise<void>;
type ActionErrorHandler = (error: unknown) => void;

function getAdminStepUpErrorMessage(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (requestMessage === "current password incorrect") {
    return "当前密码不正确，请重新输入后再验证。";
  }
  if (status === 401 || status === 403) {
    return "管理员会话已失效，请刷新页面后重新登录。";
  }
  return getRequestErrorMessage(error, "管理员验证失败");
}

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
      setDialogError(getAdminStepUpErrorMessage(error));
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
