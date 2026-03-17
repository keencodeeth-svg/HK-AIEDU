"use client";

import type { ComponentProps } from "react";
import CalibrationPanel from "./_components/CalibrationPanel";
import EvalGatePanel from "./_components/EvalGatePanel";
import HealthProbePanel from "./_components/HealthProbePanel";
import MetricsPanel from "./_components/MetricsPanel";
import ProviderChainPanel from "./_components/ProviderChainPanel";
import TaskPoliciesPanel from "./_components/TaskPoliciesPanel";
import { useAdminAiModelsPage } from "./useAdminAiModelsPage";

export function useAdminAiModelsPageView() {
  const page = useAdminAiModelsPage();

  const providerChainPanelProps: ComponentProps<typeof ProviderChainPanel> = {
    loading: page.loading,
    error: page.error,
    message: page.message,
    config: page.config,
    draftChain: page.draftChain,
    effectivePreview: page.effectivePreview,
    providerHealthMap: page.providerHealthMap,
    chainChatHealthIssues: page.chainChatHealthIssues,
    testing: page.testing,
    saving: page.saving,
    onAddProvider: page.addProvider,
    onRemoveProvider: page.removeProvider,
    onMoveProvider: page.moveProvider,
    onRunProbe: page.runProbe,
    onSaveChain: page.saveChain,
    onResetToEnv: page.resetToEnv
  };

  const taskPoliciesPanelProps: ComponentProps<typeof TaskPoliciesPanel> = {
    taskOptions: page.taskOptions,
    selectedTaskType: page.selectedTaskType,
    setSelectedTaskType: page.setSelectedTaskType,
    policyDraft: page.policyDraft,
    setPolicyDraft: page.setPolicyDraft,
    selectedTaskPolicy: page.selectedTaskPolicy,
    saving: page.saving,
    onSaveTaskPolicy: page.saveTaskPolicy,
    onResetTaskPolicy: page.resetTaskPolicy
  };

  const healthProbePanelProps: ComponentProps<typeof HealthProbePanel> = {
    testCapability: page.testCapability,
    setTestCapability: page.setTestCapability,
    testing: page.testing,
    probe: page.probe,
    onRunProbe: page.runProbe
  };

  const calibrationPanelProps: ComponentProps<typeof CalibrationPanel> = {
    selectedEvalDatasets: page.selectedEvalDatasets,
    evalLoading: page.evalLoading,
    saving: page.saving,
    calibrationLoading: page.calibrationLoading,
    calibrationConfig: page.calibrationConfig,
    calibrationSnapshots: page.calibrationSnapshots,
    calibrationDraft: page.calibrationDraft,
    setCalibrationDraft: page.setCalibrationDraft,
    evalReport: page.evalReport,
    onToggleEvalDataset: page.toggleEvalDataset,
    onRunOfflineEval: page.runOfflineEval,
    onApplyEvalCalibrationSuggestion: page.applyEvalCalibrationSuggestion,
    onLoadCalibration: page.loadCalibration,
    onSaveCalibrationRollout: page.saveCalibrationRollout,
    onRollbackCalibration: page.rollbackCalibration
  };

  const evalGatePanelProps: ComponentProps<typeof EvalGatePanel> = {
    evalGateLoading: page.evalGateLoading,
    evalGateSaving: page.evalGateSaving,
    evalGateRunning: page.evalGateRunning,
    evalGateDraft: page.evalGateDraft,
    setEvalGateDraft: page.setEvalGateDraft,
    evalGateConfig: page.evalGateConfig,
    evalGateLastRun: page.evalGateLastRun,
    evalGateRuns: page.evalGateRuns,
    onToggleEvalGateDataset: page.toggleEvalGateDataset,
    onSaveEvalGateConfig: page.saveEvalGateConfig,
    onRunEvalGate: page.runEvalGate,
    onLoadEvalGate: page.loadEvalGate
  };

  const metricsPanelProps: ComponentProps<typeof MetricsPanel> = {
    metrics: page.metrics,
    metricsLoading: page.metricsLoading,
    onLoadMetrics: page.loadMetrics
  };

  return {
    authRequired: page.authRequired,
    pageError: page.pageError,
    pageLoading: page.loading && !page.pageReady && !page.authRequired,
    bootstrapNotice: page.bootstrapNotice,
    metricsNotice: page.metricsNotice,
    calibrationNotice: page.calibrationNotice,
    evalGateNotice: page.evalGateNotice,
    reload: page.reload,
    providerChainPanelProps,
    taskPoliciesPanelProps,
    healthProbePanelProps,
    calibrationPanelProps,
    evalGatePanelProps,
    metricsPanelProps,
    stepUpDialog: page.stepUpDialog
  };
}
