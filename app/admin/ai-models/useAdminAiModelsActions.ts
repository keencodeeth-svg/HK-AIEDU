import { type Dispatch, type SetStateAction, useCallback } from "react";
import type {
  CalibrationDraft,
  ConfigData,
  EvalDatasetName,
  EvalGateDraft,
  EvalGatePayload,
  EvalReport,
  PoliciesPayload,
  PolicyDraft,
  ProbeCapability,
  ProbeResponse,
  QualityCalibrationPayload
} from "./types";
import { useAdminAiModelsEvaluationActions } from "./useAdminAiModelsEvaluationActions";
import { useAdminAiModelsRoutingActions } from "./useAdminAiModelsRoutingActions";

type Setter<T> = Dispatch<SetStateAction<T>>;

type SnapshotRef = {
  current: boolean;
};

type RunWithStepUp = (
  action: () => Promise<void>,
  onError?: (error: unknown) => void
) => Promise<void>;

type AdminAiModelsActionsOptions = {
  runWithStepUp: RunWithStepUp;
  draftChain: string[];
  effectivePreview: string[];
  testCapability: ProbeCapability;
  selectedTaskType: string;
  policyDraft: PolicyDraft;
  selectedEvalDatasets: EvalDatasetName[];
  evalReport: EvalReport | null;
  calibrationDraft: CalibrationDraft;
  evalGateDraft: EvalGateDraft;
  loadMetrics: () => Promise<void>;
  loadPage: () => Promise<void>;
  syncPoliciesPayload: (payload?: PoliciesPayload) => void;
  syncCalibrationPayload: (payload: QualityCalibrationPayload | null) => void;
  syncEvalGatePayload: (payload: EvalGatePayload | null) => void;
  hasConfigSnapshotRef: SnapshotRef;
  hasPoliciesSnapshotRef: SnapshotRef;
  hasCalibrationSnapshotRef: SnapshotRef;
  hasEvalGateSnapshotRef: SnapshotRef;
  setDraftChain: Setter<string[]>;
  setSaving: Setter<boolean>;
  setTesting: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setBootstrapNotice: Setter<string | null>;
  setError: Setter<string | null>;
  setMessage: Setter<string | null>;
  setConfig: Setter<ConfigData | null>;
  setProbe: Setter<ProbeResponse | null>;
  setEvalLoading: Setter<boolean>;
  setEvalReport: Setter<EvalReport | null>;
  setSelectedEvalDatasets: Setter<EvalDatasetName[]>;
  setEvalGateDraft: Setter<EvalGateDraft>;
  setEvalGateSaving: Setter<boolean>;
  setEvalGateRunning: Setter<boolean>;
  setPageError: Setter<string | null>;
};

export function useAdminAiModelsActions({
  runWithStepUp,
  draftChain,
  effectivePreview,
  testCapability,
  selectedTaskType,
  policyDraft,
  selectedEvalDatasets,
  evalReport,
  calibrationDraft,
  evalGateDraft,
  loadMetrics,
  loadPage,
  syncPoliciesPayload,
  syncCalibrationPayload,
  syncEvalGatePayload,
  hasConfigSnapshotRef,
  hasPoliciesSnapshotRef,
  hasCalibrationSnapshotRef,
  hasEvalGateSnapshotRef,
  setDraftChain,
  setSaving,
  setTesting,
  setAuthRequired,
  setBootstrapNotice,
  setError,
  setMessage,
  setConfig,
  setProbe,
  setEvalLoading,
  setEvalReport,
  setSelectedEvalDatasets,
  setEvalGateDraft,
  setEvalGateSaving,
  setEvalGateRunning,
  setPageError
}: AdminAiModelsActionsOptions) {
  const routingActions = useAdminAiModelsRoutingActions({
    runWithStepUp,
    draftChain,
    effectivePreview,
    testCapability,
    selectedTaskType,
    policyDraft,
    loadMetrics,
    syncPoliciesPayload,
    hasConfigSnapshotRef,
    hasPoliciesSnapshotRef,
    setDraftChain,
    setSaving,
    setTesting,
    setAuthRequired,
    setBootstrapNotice,
    setError,
    setMessage,
    setConfig,
    setProbe
  });

  const evaluationActions = useAdminAiModelsEvaluationActions({
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
  });

  const reload = useCallback(async () => {
    setPageError(null);
    await loadPage();
  }, [loadPage, setPageError]);

  return {
    ...routingActions,
    ...evaluationActions,
    reload
  };
}
