"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import { getRequestErrorMessage, requestJson } from "@/lib/client-request";
import type {
  AiMetrics,
  CalibrationDraft,
  ConfigData,
  EvalDatasetName,
  EvalGateConfig,
  EvalGateDraft,
  EvalGatePayload,
  EvalGateRun,
  EvalReport,
  PoliciesPayload,
  PolicyDraft,
  ProbeCapability,
  ProbeResponse,
  ProviderHealth,
  QualityCalibrationConfig,
  QualityCalibrationPayload,
  QualityCalibrationSnapshot,
  TaskOption,
  TaskPolicy
} from "./types";
import { EMPTY_DRAFT, EVAL_DATASET_OPTIONS, parseChainInput, toChainInput } from "./utils";
import CalibrationPanel from "./_components/CalibrationPanel";
import EvalGatePanel from "./_components/EvalGatePanel";
import HealthProbePanel from "./_components/HealthProbePanel";
import MetricsPanel from "./_components/MetricsPanel";
import ProviderChainPanel from "./_components/ProviderChainPanel";
import TaskPoliciesPanel from "./_components/TaskPoliciesPanel";

export default function AdminAiModelsPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [draftChain, setDraftChain] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testCapability, setTestCapability] = useState<ProbeCapability>("chat");
  const [probe, setProbe] = useState<ProbeResponse | null>(null);

  const [taskOptions, setTaskOptions] = useState<TaskOption[]>([]);
  const [policies, setPolicies] = useState<TaskPolicy[]>([]);
  const [selectedTaskType, setSelectedTaskType] = useState("assist");
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft>(EMPTY_DRAFT);
  const [metrics, setMetrics] = useState<AiMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [evalReport, setEvalReport] = useState<EvalReport | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [calibrationConfig, setCalibrationConfig] = useState<QualityCalibrationConfig | null>(null);
  const [calibrationSnapshots, setCalibrationSnapshots] = useState<QualityCalibrationSnapshot[]>([]);
  const [calibrationLoading, setCalibrationLoading] = useState(false);
  const [calibrationDraft, setCalibrationDraft] = useState<CalibrationDraft>({
    enabled: true,
    rolloutPercent: 100,
    rolloutSalt: "default"
  });
  const [selectedEvalDatasets, setSelectedEvalDatasets] = useState<EvalDatasetName[]>(EVAL_DATASET_OPTIONS.map((item) => item.key));
  const [evalGateConfig, setEvalGateConfig] = useState<EvalGateConfig | null>(null);
  const [evalGateRuns, setEvalGateRuns] = useState<EvalGateRun[]>([]);
  const [evalGateLastRun, setEvalGateLastRun] = useState<EvalGateRun | null>(null);
  const [evalGateLoading, setEvalGateLoading] = useState(false);
  const [evalGateSaving, setEvalGateSaving] = useState(false);
  const [evalGateRunning, setEvalGateRunning] = useState(false);
  const [evalGateDraft, setEvalGateDraft] = useState<EvalGateDraft>({
    enabled: true,
    datasets: EVAL_DATASET_OPTIONS.map((item) => item.key),
    minPassRate: 75,
    minAverageScore: 68,
    maxHighRiskCount: 6,
    autoRollbackOnFail: false
  });

  async function loadConfig() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai/config", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "加载模型配置失败");
        return;
      }
      const data: ConfigData = payload?.data ?? null;
      setConfig(data);
      setDraftChain(data?.runtimeProviderChain ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadPolicies() {
    const res = await fetch("/api/admin/ai/policies", { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload?.error ?? "加载任务策略失败");
      return;
    }
    const data: PoliciesPayload = payload?.data ?? { tasks: [], policies: [] };
    setTaskOptions(data.tasks ?? []);
    setPolicies(data.policies ?? []);
    if (!selectedTaskType && data.tasks?.length) {
      setSelectedTaskType(data.tasks[0].taskType);
    }
  }

  async function loadMetrics() {
    setMetricsLoading(true);
    try {
      const res = await fetch("/api/admin/ai/metrics?limit=12", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "加载 AI 指标失败");
        return;
      }
      setMetrics(payload?.data ?? null);
    } finally {
      setMetricsLoading(false);
    }
  }

  function syncCalibrationPayload(payload: QualityCalibrationPayload | null) {
    if (!payload) {
      setCalibrationConfig(null);
      setCalibrationSnapshots([]);
      return;
    }
    setCalibrationConfig(payload);
    setCalibrationSnapshots(payload.snapshots ?? []);
    setCalibrationDraft({
      enabled: payload.enabled ?? true,
      rolloutPercent:
        typeof payload.rolloutPercent === "number" && Number.isFinite(payload.rolloutPercent) ? payload.rolloutPercent : 100,
      rolloutSalt: payload.rolloutSalt || "default"
    });
  }

  async function loadCalibration() {
    setCalibrationLoading(true);
    try {
      const res = await fetch("/api/admin/ai/quality-calibration?historyLimit=20", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "加载质量校准失败");
        return;
      }
      syncCalibrationPayload((payload?.data ?? null) as QualityCalibrationPayload | null);
    } finally {
      setCalibrationLoading(false);
    }
  }

  function syncEvalGatePayload(payload: EvalGatePayload | null) {
    if (!payload?.config) {
      setEvalGateConfig(null);
      setEvalGateRuns([]);
      setEvalGateLastRun(null);
      return;
    }
    setEvalGateConfig(payload.config);
    setEvalGateRuns(payload.recentRuns ?? []);
    setEvalGateLastRun(payload.lastRun ?? payload.recentRuns?.[0] ?? null);
    setEvalGateDraft({
      enabled: payload.config.enabled,
      datasets: payload.config.datasets?.length ? payload.config.datasets : EVAL_DATASET_OPTIONS.map((item) => item.key),
      minPassRate: payload.config.minPassRate,
      minAverageScore: payload.config.minAverageScore,
      maxHighRiskCount: payload.config.maxHighRiskCount,
      autoRollbackOnFail: payload.config.autoRollbackOnFail
    });
  }

  async function loadEvalGate() {
    setEvalGateLoading(true);
    try {
      const res = await fetch("/api/admin/ai/evals/gate?limit=12", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "加载评测门禁失败");
        return;
      }
      syncEvalGatePayload((payload?.data ?? null) as EvalGatePayload | null);
    } finally {
      setEvalGateLoading(false);
    }
  }

  async function saveEvalGateConfig() {
    setEvalGateSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<{ data?: EvalGatePayload }>("/api/admin/ai/evals/gate", {
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
          syncEvalGatePayload((payload?.data ?? null) as EvalGatePayload | null);
          setMessage("评测门禁配置已保存");
        },
        (error) => {
          setError(getRequestErrorMessage(error, "保存评测门禁失败"));
        }
      );
    } finally {
      setEvalGateSaving(false);
    }
  }

  async function runEvalGate() {
    setEvalGateRunning(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<{ data?: EvalGatePayload }>("/api/admin/ai/evals/gate", {
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
          syncEvalGatePayload((payload?.data ?? null) as EvalGatePayload | null);
          const passed = Boolean(payload?.data?.lastRun?.passed);
          setMessage(passed ? "评测门禁通过" : "评测门禁未通过，请根据失败规则调整");
        },
        (error) => {
          setError(getRequestErrorMessage(error, "执行评测门禁失败"));
        }
      );
    } finally {
      setEvalGateRunning(false);
    }
  }

  async function runOfflineEval() {
    setEvalLoading(true);
    setError(null);
    setMessage(null);
    try {
      const query = selectedEvalDatasets.length ? `?datasets=${selectedEvalDatasets.join(",")}` : "";
      const res = await fetch(`/api/admin/ai/evals${query}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "离线评测失败");
        return;
      }
      setEvalReport(payload?.data ?? null);
      setMessage("离线评测已完成");
    } finally {
      setEvalLoading(false);
    }
  }

  async function applyEvalCalibrationSuggestion() {
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
          const payload = await requestJson<{ data?: QualityCalibrationPayload }>("/api/admin/ai/quality-calibration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              globalBias: suggestion.recommendedGlobalBias,
              providerAdjustments: suggestion.providerAdjustments,
              kindAdjustments: suggestion.kindAdjustments,
              reason: "apply_eval_suggestion"
            })
          });
          syncCalibrationPayload((payload?.data ?? null) as QualityCalibrationPayload | null);
          setMessage("已应用离线评测校准建议");
        },
        (error) => {
          setError(getRequestErrorMessage(error, "应用校准建议失败"));
        }
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveCalibrationRollout() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<{ data?: QualityCalibrationPayload }>("/api/admin/ai/quality-calibration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enabled: calibrationDraft.enabled,
              rolloutPercent: calibrationDraft.rolloutPercent,
              rolloutSalt: calibrationDraft.rolloutSalt,
              reason: "update_rollout_control"
            })
          });
          syncCalibrationPayload((payload?.data ?? null) as QualityCalibrationPayload | null);
          setMessage("灰度开关配置已保存");
        },
        (error) => {
          setError(getRequestErrorMessage(error, "保存灰度配置失败"));
        }
      );
    } finally {
      setSaving(false);
    }
  }

  async function rollbackCalibration(snapshotId: string) {
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
          const payload = await requestJson<{ data?: QualityCalibrationPayload }>("/api/admin/ai/quality-calibration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "rollback",
              snapshotId,
              reason: "manual_rollback",
              confirmAction: true
            })
          });
          syncCalibrationPayload((payload?.data ?? null) as QualityCalibrationPayload | null);
          setMessage("已完成校准回滚");
        },
        (error) => {
          setError(getRequestErrorMessage(error, "回滚失败"));
        }
      );
    } finally {
      setSaving(false);
    }
  }

  function toggleEvalDataset(dataset: EvalDatasetName) {
    setSelectedEvalDatasets((prev) => {
      if (prev.includes(dataset)) {
        return prev.filter((item) => item !== dataset);
      }
      return [...prev, dataset];
    });
  }

  function toggleEvalGateDataset(dataset: EvalDatasetName) {
    setEvalGateDraft((prev) => {
      const next = prev.datasets.includes(dataset) ? prev.datasets.filter((item) => item !== dataset) : [...prev.datasets, dataset];
      return {
        ...prev,
        datasets: next.length ? next : [dataset]
      };
    });
  }

  useEffect(() => {
    Promise.all([loadConfig(), loadPolicies(), loadMetrics(), loadCalibration(), loadEvalGate()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const target = policies.find((item) => item.taskType === selectedTaskType);
    if (!target) return;
    setPolicyDraft({
      providerChain: toChainInput(target.providerChain ?? []),
      timeoutMs: target.timeoutMs,
      maxRetries: target.maxRetries,
      budgetLimit: target.budgetLimit,
      minQualityScore: target.minQualityScore
    });
  }, [policies, selectedTaskType]);

  const selectedTaskPolicy = useMemo(() => policies.find((item) => item.taskType === selectedTaskType) ?? null, [policies, selectedTaskType]);

  const effectivePreview = useMemo(() => {
    if (draftChain.length) return draftChain;
    return config?.envProviderChain ?? ["mock"];
  }, [config?.envProviderChain, draftChain]);

  const providerHealthMap = useMemo(() => {
    const map = new Map<string, ProviderHealth>();
    (config?.providerHealth ?? []).forEach((item) => {
      map.set(item.provider, item);
    });
    return map;
  }, [config?.providerHealth]);

  const chainChatHealthIssues = useMemo(
    () =>
      effectivePreview
        .map((provider) => ({
          provider,
          health: providerHealthMap.get(provider)
        }))
        .filter((item) => item.provider !== "mock" && item.health && !item.health.chat.configured),
    [effectivePreview, providerHealthMap]
  );

  function addProvider(provider: string) {
    setDraftChain((prev) => (prev.includes(provider) ? prev : [...prev, provider]));
  }

  function removeProvider(provider: string) {
    setDraftChain((prev) => prev.filter((item) => item !== provider));
  }

  function moveProvider(provider: string, offset: -1 | 1) {
    setDraftChain((prev) => {
      const index = prev.findIndex((item) => item === provider);
      if (index < 0) return prev;
      const nextIndex = index + offset;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [picked] = next.splice(index, 1);
      next.splice(nextIndex, 0, picked);
      return next;
    });
  }

  async function saveChain() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<{ data?: ConfigData }>("/api/admin/ai/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ providerChain: draftChain })
          });
          const data = payload?.data ?? null;
          setConfig(data);
          setDraftChain(data?.runtimeProviderChain ?? []);
          setMessage("AI 模型链已保存");
        },
        (error) => {
          setError(getRequestErrorMessage(error, "保存失败"));
        }
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetToEnv() {
    const confirmed = window.confirm("确认切回环境变量中的 AI 模型链配置吗？当前运行时链路会被清空。");
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<{ data?: ConfigData }>("/api/admin/ai/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reset: true, confirmAction: true })
          });
          const data = payload?.data ?? null;
          setConfig(data);
          setDraftChain(data?.runtimeProviderChain ?? []);
          setMessage("已切回环境变量配置");
        },
        (error) => {
          setError(getRequestErrorMessage(error, "重置失败"));
        }
      );
    } finally {
      setSaving(false);
    }
  }

  async function runProbe(providers?: string[]) {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providers: providers ?? effectivePreview,
          capability: testCapability
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "连通性测试失败");
        return;
      }
      setProbe(payload?.data ?? null);
      setMessage("连通性测试完成");
    } finally {
      setTesting(false);
    }
  }

  async function saveTaskPolicy() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<{ data?: PoliciesPayload }>("/api/admin/ai/policies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskType: selectedTaskType,
              providerChain: parseChainInput(policyDraft.providerChain),
              timeoutMs: policyDraft.timeoutMs,
              maxRetries: policyDraft.maxRetries,
              budgetLimit: policyDraft.budgetLimit,
              minQualityScore: policyDraft.minQualityScore
            })
          });
          const data: PoliciesPayload = payload?.data ?? { tasks: [], policies: [] };
          setTaskOptions(data.tasks ?? []);
          setPolicies(data.policies ?? []);
          setMessage(`任务策略已保存：${selectedTaskType}`);
          await loadMetrics();
        },
        (error) => {
          setError(getRequestErrorMessage(error, "保存任务策略失败"));
        }
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetTaskPolicy() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<{ data?: PoliciesPayload }>("/api/admin/ai/policies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskType: selectedTaskType,
              reset: true
            })
          });
          const data: PoliciesPayload = payload?.data ?? { tasks: [], policies: [] };
          setTaskOptions(data.tasks ?? []);
          setPolicies(data.policies ?? []);
          setMessage(`任务策略已重置：${selectedTaskType}`);
          await loadMetrics();
        },
        (error) => {
          setError(getRequestErrorMessage(error, "重置任务策略失败"));
        }
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>AI 模型路由中心</h2>
          <div className="section-sub">模型链、任务级策略、调用指标与连通性统一管理。</div>
        </div>
        <span className="chip">管理端</span>
      </div>

      <ProviderChainPanel
        loading={loading}
        error={error}
        message={message}
        config={config}
        draftChain={draftChain}
        effectivePreview={effectivePreview}
        providerHealthMap={providerHealthMap}
        chainChatHealthIssues={chainChatHealthIssues}
        testing={testing}
        saving={saving}
        onAddProvider={addProvider}
        onRemoveProvider={removeProvider}
        onMoveProvider={moveProvider}
        onRunProbe={runProbe}
        onSaveChain={saveChain}
        onResetToEnv={resetToEnv}
      />

      <TaskPoliciesPanel
        taskOptions={taskOptions}
        selectedTaskType={selectedTaskType}
        setSelectedTaskType={setSelectedTaskType}
        policyDraft={policyDraft}
        setPolicyDraft={setPolicyDraft}
        selectedTaskPolicy={selectedTaskPolicy}
        saving={saving}
        onSaveTaskPolicy={saveTaskPolicy}
        onResetTaskPolicy={resetTaskPolicy}
      />

      <HealthProbePanel
        testCapability={testCapability}
        setTestCapability={setTestCapability}
        testing={testing}
        probe={probe}
        onRunProbe={runProbe}
      />

      <CalibrationPanel
        selectedEvalDatasets={selectedEvalDatasets}
        evalLoading={evalLoading}
        saving={saving}
        calibrationLoading={calibrationLoading}
        calibrationConfig={calibrationConfig}
        calibrationSnapshots={calibrationSnapshots}
        calibrationDraft={calibrationDraft}
        setCalibrationDraft={setCalibrationDraft}
        evalReport={evalReport}
        onToggleEvalDataset={toggleEvalDataset}
        onRunOfflineEval={runOfflineEval}
        onApplyEvalCalibrationSuggestion={applyEvalCalibrationSuggestion}
        onLoadCalibration={loadCalibration}
        onSaveCalibrationRollout={saveCalibrationRollout}
        onRollbackCalibration={rollbackCalibration}
      />

      <EvalGatePanel
        evalGateLoading={evalGateLoading}
        evalGateSaving={evalGateSaving}
        evalGateRunning={evalGateRunning}
        evalGateDraft={evalGateDraft}
        setEvalGateDraft={setEvalGateDraft}
        evalGateConfig={evalGateConfig}
        evalGateLastRun={evalGateLastRun}
        evalGateRuns={evalGateRuns}
        onToggleEvalGateDataset={toggleEvalGateDataset}
        onSaveEvalGateConfig={saveEvalGateConfig}
        onRunEvalGate={runEvalGate}
        onLoadEvalGate={loadEvalGate}
      />

      <MetricsPanel metrics={metrics} metricsLoading={metricsLoading} onLoadMetrics={loadMetrics} />
      {stepUpDialog}
    </div>
  );
}
