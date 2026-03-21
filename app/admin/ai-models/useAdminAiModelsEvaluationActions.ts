import { type Dispatch, type SetStateAction, useCallback } from "react";
import {
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  CalibrationDraft,
  EvalDatasetName,
  EvalGateDraft,
  EvalGatePayload,
  EvalReport,
  QualityCalibrationPayload
} from "./types";
import {
  toggleEvalDatasetSelection,
  toggleRequiredEvalDatasetSelection
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type SnapshotRef = {
  current: boolean;
};

type RunWithStepUp = (
  action: () => Promise<void>,
  onError?: (error: unknown) => void
) => Promise<void>;

type EvalReportResponse = {
  data?: EvalReport | null;
};

type QualityCalibrationResponse = {
  data?: QualityCalibrationPayload | null;
};

type EvalGateResponse = {
  data?: EvalGatePayload | null;
};

type AdminAiModelsEvaluationActionsOptions = {
  runWithStepUp: RunWithStepUp;
  selectedEvalDatasets: EvalDatasetName[];
  evalReport: EvalReport | null;
  calibrationDraft: CalibrationDraft;
  evalGateDraft: EvalGateDraft;
  syncCalibrationPayload: (payload: QualityCalibrationPayload | null) => void;
  syncEvalGatePayload: (payload: EvalGatePayload | null) => void;
  hasCalibrationSnapshotRef: SnapshotRef;
  hasEvalGateSnapshotRef: SnapshotRef;
  setSaving: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setError: Setter<string | null>;
  setMessage: Setter<string | null>;
  setEvalLoading: Setter<boolean>;
  setEvalReport: Setter<EvalReport | null>;
  setSelectedEvalDatasets: Setter<EvalDatasetName[]>;
  setEvalGateDraft: Setter<EvalGateDraft>;
  setEvalGateSaving: Setter<boolean>;
  setEvalGateRunning: Setter<boolean>;
};

export function useAdminAiModelsEvaluationActions({
  runWithStepUp,
  selectedEvalDatasets,
  evalReport,
  calibrationDraft,
  evalGateDraft,
  syncCalibrationPayload,
  syncEvalGatePayload,
  hasCalibrationSnapshotRef,
  hasEvalGateSnapshotRef,
  setSaving,
  setAuthRequired,
  setError,
  setMessage,
  setEvalLoading,
  setEvalReport,
  setSelectedEvalDatasets,
  setEvalGateDraft,
  setEvalGateSaving,
  setEvalGateRunning
}: AdminAiModelsEvaluationActionsOptions) {
  const toggleEvalDataset = useCallback(
    (dataset: EvalDatasetName) => {
      setSelectedEvalDatasets((prev) => toggleEvalDatasetSelection(prev, dataset));
    },
    [setSelectedEvalDatasets]
  );

  const runOfflineEval = useCallback(async () => {
    setEvalLoading(true);
    setError(null);
    setMessage(null);
    try {
      const query = selectedEvalDatasets.length ? `?datasets=${selectedEvalDatasets.join(",")}` : "";
      const payload = await requestJson<EvalReportResponse>(`/api/admin/ai/evals${query}`, { cache: "no-store" });
      setEvalReport(payload.data ?? null);
      setMessage("离线评测已完成");
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
      } else {
        setError(getRequestErrorMessage(nextError, "离线评测失败"));
      }
    } finally {
      setEvalLoading(false);
    }
  }, [
    selectedEvalDatasets,
    setAuthRequired,
    setError,
    setEvalLoading,
    setEvalReport,
    setMessage
  ]);

  const applyEvalCalibrationSuggestion = useCallback(async () => {
    if (!evalReport?.summary?.calibrationSuggestion) {
      setError("请先运行离线评测，再应用校准建议");
      return;
    }

    const suggestion = evalReport.summary.calibrationSuggestion;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<QualityCalibrationResponse>("/api/admin/ai/quality-calibration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              globalBias: suggestion.recommendedGlobalBias,
              providerAdjustments: suggestion.providerAdjustments,
              kindAdjustments: suggestion.kindAdjustments,
              reason: "apply_eval_suggestion"
            })
          });
          syncCalibrationPayload(payload.data ?? null);
          hasCalibrationSnapshotRef.current = true;
          setMessage("已应用离线评测校准建议");
        },
        (nextError) => {
          if (isAuthError(nextError)) {
            setAuthRequired(true);
            return;
          }
          setError(getRequestErrorMessage(nextError, "应用校准建议失败"));
        }
      );
    } finally {
      setSaving(false);
    }
  }, [
    evalReport,
    hasCalibrationSnapshotRef,
    runWithStepUp,
    setAuthRequired,
    setError,
    setMessage,
    setSaving,
    syncCalibrationPayload
  ]);

  const saveCalibrationRollout = useCallback(async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<QualityCalibrationResponse>("/api/admin/ai/quality-calibration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enabled: calibrationDraft.enabled,
              rolloutPercent: calibrationDraft.rolloutPercent,
              rolloutSalt: calibrationDraft.rolloutSalt,
              reason: "update_rollout_control"
            })
          });
          syncCalibrationPayload(payload.data ?? null);
          hasCalibrationSnapshotRef.current = true;
          setMessage("灰度开关配置已保存");
        },
        (nextError) => {
          if (isAuthError(nextError)) {
            setAuthRequired(true);
            return;
          }
          setError(getRequestErrorMessage(nextError, "保存灰度配置失败"));
        }
      );
    } finally {
      setSaving(false);
    }
  }, [
    calibrationDraft.enabled,
    calibrationDraft.rolloutPercent,
    calibrationDraft.rolloutSalt,
    hasCalibrationSnapshotRef,
    runWithStepUp,
    setAuthRequired,
    setError,
    setMessage,
    setSaving,
    syncCalibrationPayload
  ]);

  const rollbackCalibration = useCallback(async (snapshotId: string) => {
    const confirmed = window.confirm("确认回滚到这个 AI 质量校准快照吗？当前运行配置会被覆盖。");
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<QualityCalibrationResponse>("/api/admin/ai/quality-calibration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "rollback",
              snapshotId,
              reason: "manual_rollback",
              confirmAction: true
            })
          });
          syncCalibrationPayload(payload.data ?? null);
          hasCalibrationSnapshotRef.current = true;
          setMessage("已完成校准回滚");
        },
        (nextError) => {
          if (isAuthError(nextError)) {
            setAuthRequired(true);
            return;
          }
          setError(getRequestErrorMessage(nextError, "回滚失败"));
        }
      );
    } finally {
      setSaving(false);
    }
  }, [
    hasCalibrationSnapshotRef,
    runWithStepUp,
    setAuthRequired,
    setError,
    setMessage,
    setSaving,
    syncCalibrationPayload
  ]);

  const toggleEvalGateDataset = useCallback(
    (dataset: EvalDatasetName) => {
      setEvalGateDraft((prev) => {
        return {
          ...prev,
          datasets: toggleRequiredEvalDatasetSelection(prev.datasets, dataset)
        };
      });
    },
    [setEvalGateDraft]
  );

  const saveEvalGateConfig = useCallback(async () => {
    setEvalGateSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<EvalGateResponse>("/api/admin/ai/evals/gate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enabled: evalGateDraft.enabled,
              datasets: evalGateDraft.datasets,
              minPassRate: evalGateDraft.minPassRate,
              minAverageScore: evalGateDraft.minAverageScore,
              maxHighRiskCount: evalGateDraft.maxHighRiskCount,
              autoRollbackOnFail: evalGateDraft.autoRollbackOnFail
            })
          });
          syncEvalGatePayload(payload.data ?? null);
          hasEvalGateSnapshotRef.current = true;
          setMessage("评测门禁配置已保存");
        },
        (nextError) => {
          if (isAuthError(nextError)) {
            setAuthRequired(true);
            return;
          }
          setError(getRequestErrorMessage(nextError, "保存评测门禁失败"));
        }
      );
    } finally {
      setEvalGateSaving(false);
    }
  }, [
    evalGateDraft.autoRollbackOnFail,
    evalGateDraft.datasets,
    evalGateDraft.enabled,
    evalGateDraft.maxHighRiskCount,
    evalGateDraft.minAverageScore,
    evalGateDraft.minPassRate,
    hasEvalGateSnapshotRef,
    runWithStepUp,
    setAuthRequired,
    setError,
    setEvalGateSaving,
    setMessage,
    syncEvalGatePayload
  ]);

  const runEvalGate = useCallback(async () => {
    setEvalGateRunning(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<EvalGateResponse>("/api/admin/ai/evals/gate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "run",
              force: true,
              configOverride: {
                enabled: evalGateDraft.enabled,
                datasets: evalGateDraft.datasets,
                minPassRate: evalGateDraft.minPassRate,
                minAverageScore: evalGateDraft.minAverageScore,
                maxHighRiskCount: evalGateDraft.maxHighRiskCount,
                autoRollbackOnFail: evalGateDraft.autoRollbackOnFail
              }
            })
          });
          syncEvalGatePayload(payload.data ?? null);
          hasEvalGateSnapshotRef.current = true;
          const passed = Boolean(payload.data?.lastRun?.passed);
          setMessage(passed ? "评测门禁通过" : "评测门禁未通过，请根据失败规则调整");
        },
        (nextError) => {
          if (isAuthError(nextError)) {
            setAuthRequired(true);
            return;
          }
          setError(getRequestErrorMessage(nextError, "执行评测门禁失败"));
        }
      );
    } finally {
      setEvalGateRunning(false);
    }
  }, [
    evalGateDraft.autoRollbackOnFail,
    evalGateDraft.datasets,
    evalGateDraft.enabled,
    evalGateDraft.maxHighRiskCount,
    evalGateDraft.minAverageScore,
    evalGateDraft.minPassRate,
    hasEvalGateSnapshotRef,
    runWithStepUp,
    setAuthRequired,
    setError,
    setEvalGateRunning,
    setMessage,
    syncEvalGatePayload
  ]);

  return {
    toggleEvalDataset,
    runOfflineEval,
    applyEvalCalibrationSuggestion,
    saveCalibrationRollout,
    rollbackCalibration,
    toggleEvalGateDataset,
    saveEvalGateConfig,
    runEvalGate
  };
}
