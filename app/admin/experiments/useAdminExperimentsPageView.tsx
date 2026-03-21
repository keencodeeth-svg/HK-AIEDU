"use client";

import { useMemo } from "react";
import { useAdminExperimentsPage } from "./useAdminExperimentsPage";

export function useAdminExperimentsPageView() {
  const page = useAdminExperimentsPage();

  const reportWindowLabel = useMemo(() => {
    if (!page.report) return null;
    return `近 ${page.report.window.days} 天（${new Date(page.report.window.from).toLocaleDateString("zh-CN")} - ${new Date(page.report.window.to).toLocaleDateString("zh-CN")}）`;
  }, [page.report]);

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    message: page.message,
    error: page.error,
    flags: page.flags,
    report: page.report,
    hasFlags: page.flags.length > 0,
    reportWindowLabel,
    onSaveFlag: (flagKey: string, patch: { enabled?: boolean; rollout?: number }) => {
      const currentFlag = page.flags.find((item) => item.key === flagKey);
      if (!currentFlag) return;
      void page.saveFlag(currentFlag, patch);
    },
    onFlagRolloutChange: (flagKey: string, rollout: number) => {
      page.updateFlagRollout(flagKey, rollout);
    },
    stepUpDialog: page.stepUpDialog
  };
}
