import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import {
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";
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
import {
  EMPTY_DRAFT,
  EVAL_DATASET_OPTIONS,
  parseChainInput,
  toChainInput
} from "./utils";

type ConfigResponse = {
  data?: ConfigData | null;
};

type PoliciesResponse = {
  data?: PoliciesPayload;
};

type MetricsResponse = {
  data?: AiMetrics | null;
};

type EvalReportResponse = {
  data?: EvalReport | null;
};

type ProbeApiResponse = {
  data?: ProbeResponse | null;
};

type QualityCalibrationResponse = {
  data?: QualityCalibrationPayload | null;
};

type EvalGateResponse = {
  data?: EvalGatePayload | null;
};

function joinNotices(messages: string[]) {
  return messages.filter(Boolean).join("；") || null;
}

export function useAdminAiModelsPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [draftChain, setDraftChain] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageReady, setPageReady] = useState(false);
  const [bootstrapNotice, setBootstrapNotice] = useState<string | null>(null);
  const [metricsNotice, setMetricsNotice] = useState<string | null>(null);
  const [calibrationNotice, setCalibrationNotice] = useState<string | null>(null);
  const [evalGateNotice, setEvalGateNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testCapability, setTestCapability] =
    useState<ProbeCapability>("chat");
  const [probe, setProbe] = useState<ProbeResponse | null>(null);
  const [taskOptions, setTaskOptions] = useState<TaskOption[]>([]);
  const [policies, setPolicies] = useState<TaskPolicy[]>([]);
  const [selectedTaskType, setSelectedTaskType] = useState("assist");
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft>(EMPTY_DRAFT);
  const [metrics, setMetrics] = useState<AiMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [evalReport, setEvalReport] = useState<EvalReport | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [calibrationConfig, setCalibrationConfig] =
    useState<QualityCalibrationConfig | null>(null);
  const [calibrationSnapshots, setCalibrationSnapshots] = useState<
    QualityCalibrationSnapshot[]
  >([]);
  const [calibrationLoading, setCalibrationLoading] = useState(false);
  const [calibrationDraft, setCalibrationDraft] = useState<CalibrationDraft>({
    enabled: true,
    rolloutPercent: 100,
    rolloutSalt: "default"
  });
  const [selectedEvalDatasets, setSelectedEvalDatasets] = useState<
    EvalDatasetName[]
  >(EVAL_DATASET_OPTIONS.map((item) => item.key));
  const [evalGateConfig, setEvalGateConfig] =
    useState<EvalGateConfig | null>(null);
  const [evalGateRuns, setEvalGateRuns] = useState<EvalGateRun[]>([]);
  const [evalGateLastRun, setEvalGateLastRun] =
    useState<EvalGateRun | null>(null);
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
  const pageRequestIdRef = useRef(0);
  const metricsRequestIdRef = useRef(0);
  const calibrationRequestIdRef = useRef(0);
  const evalGateRequestIdRef = useRef(0);
  const hasConfigSnapshotRef = useRef(false);
  const hasPoliciesSnapshotRef = useRef(false);
  const hasMetricsSnapshotRef = useRef(false);
  const hasCalibrationSnapshotRef = useRef(false);
  const hasEvalGateSnapshotRef = useRef(false);

  const syncPoliciesPayload = useCallback((payload?: PoliciesPayload) => {
    const data = payload ?? { tasks: [], policies: [] };
    const nextTaskOptions = Array.isArray(data.tasks) ? data.tasks : [];
    const nextPolicies = Array.isArray(data.policies) ? data.policies : [];
    setTaskOptions(nextTaskOptions);
    setPolicies(nextPolicies);
    setSelectedTaskType((prev) => {
      if (prev && nextTaskOptions.some((item) => item.taskType === prev)) {
        return prev;
      }
      return nextTaskOptions[0]?.taskType ?? prev;
    });
  }, []);

  const syncCalibrationPayload = useCallback(
    (payload: QualityCalibrationPayload | null) => {
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
          typeof payload.rolloutPercent === "number" &&
          Number.isFinite(payload.rolloutPercent)
            ? payload.rolloutPercent
            : 100,
        rolloutSalt: payload.rolloutSalt || "default"
      });
      setCalibrationNotice(null);
    },
    []
  );

  const syncEvalGatePayload = useCallback((payload: EvalGatePayload | null) => {
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
      datasets: payload.config.datasets?.length
        ? payload.config.datasets
        : EVAL_DATASET_OPTIONS.map((item) => item.key),
      minPassRate: payload.config.minPassRate,
      minAverageScore: payload.config.minAverageScore,
      maxHighRiskCount: payload.config.maxHighRiskCount,
      autoRollbackOnFail: payload.config.autoRollbackOnFail
    });
    setEvalGateNotice(null);
  }, []);

  const loadMetrics = useCallback(async () => {
    const requestId = metricsRequestIdRef.current + 1;
    metricsRequestIdRef.current = requestId;
    setMetricsLoading(true);

    try {
      const payload = await requestJson<MetricsResponse>(
        "/api/admin/ai/metrics?limit=12",
        { cache: "no-store" }
      );
      if (metricsRequestIdRef.current !== requestId) {
        return;
      }
      setMetrics(payload.data ?? null);
      hasMetricsSnapshotRef.current = true;
      setMetricsNotice(null);
    } catch (nextError) {
      if (metricsRequestIdRef.current !== requestId) {
        return;
      }
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        return;
      }
      const nextMessage = getRequestErrorMessage(nextError, "加载 AI 指标失败");
      if (hasMetricsSnapshotRef.current) {
        setMetricsNotice(`已保留最近一次指标：${nextMessage}`);
        return;
      }
      setMetrics(null);
      setMetricsNotice(nextMessage);
    } finally {
      if (metricsRequestIdRef.current === requestId) {
        setMetricsLoading(false);
      }
    }
  }, []);

  const loadCalibration = useCallback(async () => {
    const requestId = calibrationRequestIdRef.current + 1;
    calibrationRequestIdRef.current = requestId;
    setCalibrationLoading(true);

    try {
      const payload = await requestJson<QualityCalibrationResponse>(
        "/api/admin/ai/quality-calibration?historyLimit=20",
        { cache: "no-store" }
      );
      if (calibrationRequestIdRef.current !== requestId) {
        return;
      }
      syncCalibrationPayload(payload.data ?? null);
      hasCalibrationSnapshotRef.current = true;
      setCalibrationNotice(null);
    } catch (nextError) {
      if (calibrationRequestIdRef.current !== requestId) {
        return;
      }
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        return;
      }
      const nextMessage = getRequestErrorMessage(nextError, "加载质量校准失败");
      if (hasCalibrationSnapshotRef.current) {
        setCalibrationNotice(`已保留最近一次校准配置：${nextMessage}`);
        return;
      }
      setCalibrationConfig(null);
      setCalibrationSnapshots([]);
      setCalibrationNotice(nextMessage);
    } finally {
      if (calibrationRequestIdRef.current === requestId) {
        setCalibrationLoading(false);
      }
    }
  }, [syncCalibrationPayload]);

  const loadEvalGate = useCallback(async () => {
    const requestId = evalGateRequestIdRef.current + 1;
    evalGateRequestIdRef.current = requestId;
    setEvalGateLoading(true);

    try {
      const payload = await requestJson<EvalGateResponse>(
        "/api/admin/ai/evals/gate?limit=12",
        { cache: "no-store" }
      );
      if (evalGateRequestIdRef.current !== requestId) {
        return;
      }
      syncEvalGatePayload(payload.data ?? null);
      hasEvalGateSnapshotRef.current = true;
      setEvalGateNotice(null);
    } catch (nextError) {
      if (evalGateRequestIdRef.current !== requestId) {
        return;
      }
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        return;
      }
      const nextMessage = getRequestErrorMessage(nextError, "加载评测门禁失败");
      if (hasEvalGateSnapshotRef.current) {
        setEvalGateNotice(`已保留最近一次门禁配置：${nextMessage}`);
        return;
      }
      setEvalGateConfig(null);
      setEvalGateRuns([]);
      setEvalGateLastRun(null);
      setEvalGateNotice(nextMessage);
    } finally {
      if (evalGateRequestIdRef.current === requestId) {
        setEvalGateLoading(false);
      }
    }
  }, [syncEvalGatePayload]);

  const loadPage = useCallback(async () => {
    const requestId = pageRequestIdRef.current + 1;
    pageRequestIdRef.current = requestId;
    setLoading(true);
    setPageError(null);
    setPageReady(false);
    setBootstrapNotice(null);

    try {
      const [configResult, policiesResult] = await Promise.allSettled([
        requestJson<ConfigResponse>("/api/admin/ai/config", {
          cache: "no-store"
        }),
        requestJson<PoliciesResponse>("/api/admin/ai/policies", {
          cache: "no-store"
        })
      ]);

      if (pageRequestIdRef.current !== requestId) {
        return;
      }

      const configAuthError =
        configResult.status === "rejected" && isAuthError(configResult.reason);
      const policiesAuthError =
        policiesResult.status === "rejected" &&
        isAuthError(policiesResult.reason);

      if (configAuthError || policiesAuthError) {
        setAuthRequired(true);
        return;
      }

      const notices: string[] = [];
      let configReady = false;

      if (configResult.status === "fulfilled") {
        const data = configResult.value.data ?? null;
        setConfig(data);
        setDraftChain(data?.runtimeProviderChain ?? []);
        hasConfigSnapshotRef.current = true;
        setAuthRequired(false);
        configReady = true;
      } else {
        const nextMessage = getRequestErrorMessage(
          configResult.reason,
          "加载模型配置失败"
        );
        if (hasConfigSnapshotRef.current) {
          notices.push(`模型配置刷新失败：${nextMessage}`);
          configReady = true;
        } else {
          setPageError(nextMessage);
          setConfig(null);
          setDraftChain([]);
        }
      }

      if (policiesResult.status === "fulfilled") {
        syncPoliciesPayload(policiesResult.value.data);
        hasPoliciesSnapshotRef.current = true;
      } else {
        const nextMessage = getRequestErrorMessage(
          policiesResult.reason,
          "加载任务策略失败"
        );
        if (hasPoliciesSnapshotRef.current) {
          notices.push(`任务策略刷新失败：${nextMessage}`);
        } else {
          syncPoliciesPayload();
          notices.push(`任务策略加载失败：${nextMessage}`);
        }
      }

      if (configReady) {
        setPageReady(true);
        void loadMetrics();
        void loadCalibration();
        void loadEvalGate();
      }
      setBootstrapNotice(joinNotices(notices));
    } finally {
      if (pageRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [loadCalibration, loadEvalGate, loadMetrics, syncPoliciesPayload]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    const target = policies.find((item) => item.taskType === selectedTaskType);
    if (!target) {
      return;
    }
    setPolicyDraft({
      providerChain: toChainInput(target.providerChain ?? []),
      timeoutMs: target.timeoutMs,
      maxRetries: target.maxRetries,
      budgetLimit: target.budgetLimit,
      minQualityScore: target.minQualityScore
    });
  }, [policies, selectedTaskType]);

  const selectedTaskPolicy = useMemo(
    () => policies.find((item) => item.taskType === selectedTaskType) ?? null,
    [policies, selectedTaskType]
  );

  const effectivePreview = useMemo(() => {
    if (draftChain.length) {
      return draftChain;
    }
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
        .filter(
          (item) =>
            item.provider !== "mock" &&
            item.health &&
            !item.health.chat.configured
        ),
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
      if (index < 0) {
        return prev;
      }
      const nextIndex = index + offset;
      if (nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }
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
          const payload = await requestJson<ConfigResponse>("/api/admin/ai/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ providerChain: draftChain })
          });
          const data = payload.data ?? null;
          setConfig(data);
          setDraftChain(data?.runtimeProviderChain ?? []);
          hasConfigSnapshotRef.current = true;
          setBootstrapNotice(null);
          setMessage("AI 模型链已保存");
        },
        (nextError) => {
          if (isAuthError(nextError)) {
            setAuthRequired(true);
            return;
          }
          setError(getRequestErrorMessage(nextError, "保存失败"));
        }
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetToEnv() {
    const confirmed = window.confirm(
      "确认切回环境变量中的 AI 模型链配置吗？当前运行时链路会被清空。"
    );
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<ConfigResponse>("/api/admin/ai/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reset: true, confirmAction: true })
          });
          const data = payload.data ?? null;
          setConfig(data);
          setDraftChain(data?.runtimeProviderChain ?? []);
          hasConfigSnapshotRef.current = true;
          setBootstrapNotice(null);
          setMessage("已切回环境变量配置");
        },
        (nextError) => {
          if (isAuthError(nextError)) {
            setAuthRequired(true);
            return;
          }
          setError(getRequestErrorMessage(nextError, "重置失败"));
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
      const payload = await requestJson<ProbeApiResponse>("/api/admin/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providers: providers ?? effectivePreview,
          capability: testCapability
        })
      });
      setProbe(payload.data ?? null);
      setMessage("连通性测试完成");
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
      } else {
        setError(getRequestErrorMessage(nextError, "连通性测试失败"));
      }
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
          const payload = await requestJson<PoliciesResponse>(
            "/api/admin/ai/policies",
            {
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
            }
          );
          syncPoliciesPayload(payload.data);
          hasPoliciesSnapshotRef.current = true;
          setBootstrapNotice(null);
          setMessage(`任务策略已保存：${selectedTaskType}`);
          await loadMetrics();
        },
        (nextError) => {
          if (isAuthError(nextError)) {
            setAuthRequired(true);
            return;
          }
          setError(getRequestErrorMessage(nextError, "保存任务策略失败"));
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
          const payload = await requestJson<PoliciesResponse>(
            "/api/admin/ai/policies",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskType: selectedTaskType,
                reset: true
              })
            }
          );
          syncPoliciesPayload(payload.data);
          hasPoliciesSnapshotRef.current = true;
          setBootstrapNotice(null);
          setMessage(`任务策略已重置：${selectedTaskType}`);
          await loadMetrics();
        },
        (nextError) => {
          if (isAuthError(nextError)) {
            setAuthRequired(true);
            return;
          }
          setError(getRequestErrorMessage(nextError, "重置任务策略失败"));
        }
      );
    } finally {
      setSaving(false);
    }
  }

  async function runOfflineEval() {
    setEvalLoading(true);
    setError(null);
    setMessage(null);
    try {
      const query = selectedEvalDatasets.length
        ? `?datasets=${selectedEvalDatasets.join(",")}`
        : "";
      const payload = await requestJson<EvalReportResponse>(
        `/api/admin/ai/evals${query}`,
        { cache: "no-store" }
      );
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
          const payload = await requestJson<QualityCalibrationResponse>(
            "/api/admin/ai/quality-calibration",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                globalBias: suggestion.recommendedGlobalBias,
                providerAdjustments: suggestion.providerAdjustments,
                kindAdjustments: suggestion.kindAdjustments,
                reason: "apply_eval_suggestion"
              })
            }
          );
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
  }

  async function saveCalibrationRollout() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<QualityCalibrationResponse>(
            "/api/admin/ai/quality-calibration",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                enabled: calibrationDraft.enabled,
                rolloutPercent: calibrationDraft.rolloutPercent,
                rolloutSalt: calibrationDraft.rolloutSalt,
                reason: "update_rollout_control"
              })
            }
          );
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
  }

  async function rollbackCalibration(snapshotId: string) {
    const confirmed = window.confirm(
      "确认回滚到这个 AI 质量校准快照吗？当前运行配置会被覆盖。"
    );
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<QualityCalibrationResponse>(
            "/api/admin/ai/quality-calibration",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "rollback",
                snapshotId,
                reason: "manual_rollback",
                confirmAction: true
              })
            }
          );
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
  }

  function toggleEvalDataset(dataset: EvalDatasetName) {
    setSelectedEvalDatasets((prev) =>
      prev.includes(dataset)
        ? prev.filter((item) => item !== dataset)
        : [...prev, dataset]
    );
  }

  function toggleEvalGateDataset(dataset: EvalDatasetName) {
    setEvalGateDraft((prev) => {
      const next = prev.datasets.includes(dataset)
        ? prev.datasets.filter((item) => item !== dataset)
        : [...prev.datasets, dataset];
      return {
        ...prev,
        datasets: next.length ? next : [dataset]
      };
    });
  }

  async function saveEvalGateConfig() {
    setEvalGateSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<EvalGateResponse>(
            "/api/admin/ai/evals/gate",
            {
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
            }
          );
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
  }

  async function runEvalGate() {
    setEvalGateRunning(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<EvalGateResponse>(
            "/api/admin/ai/evals/gate",
            {
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
            }
          );
          syncEvalGatePayload(payload.data ?? null);
          hasEvalGateSnapshotRef.current = true;
          const passed = Boolean(payload.data?.lastRun?.passed);
          setMessage(
            passed ? "评测门禁通过" : "评测门禁未通过，请根据失败规则调整"
          );
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
  }

  const reload = useCallback(async () => {
    setPageError(null);
    await loadPage();
  }, [loadPage]);

  return {
    stepUpDialog,
    loading,
    saving,
    testing,
    authRequired,
    pageError,
    pageReady,
    bootstrapNotice,
    metricsNotice,
    calibrationNotice,
    evalGateNotice,
    error,
    message,
    config,
    draftChain,
    effectivePreview,
    providerHealthMap,
    chainChatHealthIssues,
    taskOptions,
    selectedTaskType,
    setSelectedTaskType,
    policyDraft,
    setPolicyDraft,
    selectedTaskPolicy,
    testCapability,
    setTestCapability,
    probe,
    selectedEvalDatasets,
    evalLoading,
    calibrationLoading,
    calibrationConfig,
    calibrationSnapshots,
    calibrationDraft,
    setCalibrationDraft,
    evalReport,
    evalGateLoading,
    evalGateSaving,
    evalGateRunning,
    evalGateDraft,
    setEvalGateDraft,
    evalGateConfig,
    evalGateLastRun,
    evalGateRuns,
    metrics,
    metricsLoading,
    addProvider,
    removeProvider,
    moveProvider,
    runProbe,
    saveChain,
    resetToEnv,
    saveTaskPolicy,
    resetTaskPolicy,
    toggleEvalDataset,
    runOfflineEval,
    applyEvalCalibrationSuggestion,
    loadCalibration,
    saveCalibrationRollout,
    rollbackCalibration,
    toggleEvalGateDataset,
    saveEvalGateConfig,
    runEvalGate,
    loadEvalGate,
    loadMetrics,
    reload
  };
}
