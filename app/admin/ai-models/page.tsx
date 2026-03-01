"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";

type ProviderOption = {
  key: string;
  label: string;
  description: string;
};

type ProviderCapabilityHealth = {
  configured: boolean;
  missingEnv: string[];
  model?: string;
  baseUrl?: string;
  chatPath?: string;
};

type ProviderHealth = {
  provider: string;
  chat: ProviderCapabilityHealth;
  vision: ProviderCapabilityHealth;
};

type ConfigData = {
  availableProviders: ProviderOption[];
  runtimeProviderChain: string[];
  envProviderChain: string[];
  effectiveProviderChain: string[];
  providerHealth?: ProviderHealth[];
  updatedAt?: string;
  updatedBy?: string;
};

type ProbeResult = {
  provider: string;
  ok: boolean;
  latencyMs: number;
  message: string;
};

type ProbeResponse = {
  capability: "chat" | "vision";
  testedAt: string;
  results: ProbeResult[];
};

type TaskOption = {
  taskType: string;
  label: string;
  description: string;
};

type TaskPolicy = {
  taskType: string;
  label: string;
  description: string;
  providerChain: string[];
  timeoutMs: number;
  maxRetries: number;
  budgetLimit: number;
  minQualityScore: number;
  source: "default" | "runtime";
  updatedAt?: string;
  updatedBy?: string;
};

type PoliciesPayload = {
  tasks: TaskOption[];
  policies: TaskPolicy[];
};

type MetricsRow = {
  key: string;
  taskType: string;
  provider: string;
  calls: number;
  successRate: number;
  timeoutRate: number;
  avgFallback: number;
  qualityRejectRate: number;
  budgetRejectRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
};

type AiMetrics = {
  generatedAt: string;
  totalCalls: number;
  successRate: number;
  fallbackRate: number;
  timeoutRate: number;
  qualityRejectRate: number;
  budgetRejectRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  rows: MetricsRow[];
};

type EvalDatasetName =
  | "explanation"
  | "homework_review"
  | "knowledge_points_generate"
  | "writing_feedback"
  | "lesson_outline"
  | "question_check";

type EvalKind = "assist" | "coach" | "explanation" | "writing" | "assignment_review";

type CalibrationSuggestion = {
  sampleCount: number;
  recommendedGlobalBias: number;
  providerAdjustments: Record<string, number>;
  kindAdjustments: Record<EvalKind, number>;
  note: string;
};

type EvalDatasetReport = {
  dataset: EvalDatasetName;
  total: number;
  passed: number;
  passRate: number;
  averageScore: number;
  highRiskCount: number;
};

type EvalReport = {
  generatedAt: string;
  datasets: EvalDatasetReport[];
  summary: {
    totalCases: number;
    passedCases: number;
    passRate: number;
    averageScore: number;
    highRiskCount: number;
    calibrationSuggestion: CalibrationSuggestion;
  };
};

type QualityCalibrationConfig = {
  globalBias: number;
  providerAdjustments: Record<string, number>;
  kindAdjustments: Record<EvalKind, number>;
  enabled: boolean;
  rolloutPercent: number;
  rolloutSalt: string;
  updatedAt: string;
  updatedBy?: string;
};

type QualityCalibrationSnapshot = {
  id: string;
  reason: string;
  createdAt: string;
  createdBy?: string;
  config: QualityCalibrationConfig;
};

type QualityCalibrationPayload = QualityCalibrationConfig & {
  snapshots?: QualityCalibrationSnapshot[];
};

type EvalGateConfig = {
  enabled: boolean;
  datasets: EvalDatasetName[];
  minPassRate: number;
  minAverageScore: number;
  maxHighRiskCount: number;
  autoRollbackOnFail: boolean;
  updatedAt: string;
  updatedBy?: string;
};

type EvalGateRun = {
  id: string;
  executedAt: string;
  config: EvalGateConfig;
  reportSummary: {
    totalCases: number;
    passRate: number;
    averageScore: number;
    highRiskCount: number;
  };
  passed: boolean;
  failedRules: string[];
  rollback: {
    attempted: boolean;
    snapshotId: string | null;
    success: boolean;
    message: string;
  };
};

type EvalGatePayload = {
  config: EvalGateConfig;
  recentRuns: EvalGateRun[];
  lastRun?: EvalGateRun;
};

type PolicyDraft = {
  providerChain: string;
  timeoutMs: number;
  maxRetries: number;
  budgetLimit: number;
  minQualityScore: number;
};

const EMPTY_DRAFT: PolicyDraft = {
  providerChain: "",
  timeoutMs: 8000,
  maxRetries: 1,
  budgetLimit: 1800,
  minQualityScore: 70
};

const EVAL_DATASET_OPTIONS: Array<{ key: EvalDatasetName; label: string }> = [
  { key: "explanation", label: "题目讲解" },
  { key: "homework_review", label: "作业评语" },
  { key: "knowledge_points_generate", label: "知识点生成" },
  { key: "writing_feedback", label: "写作反馈" },
  { key: "lesson_outline", label: "教案提纲" },
  { key: "question_check", label: "题目质检" }
];
const EVAL_DATASET_LABELS = new Map(EVAL_DATASET_OPTIONS.map((item) => [item.key, item.label]));

function toChainInput(value: string[]) {
  return value.join(", ");
}

function parseChainInput(value: string) {
  return value
    .split(/[\s,，|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminAiModelsPage() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [draftChain, setDraftChain] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testCapability, setTestCapability] = useState<"chat" | "vision">("chat");
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
  const [calibrationDraft, setCalibrationDraft] = useState({
    enabled: true,
    rolloutPercent: 100,
    rolloutSalt: "default"
  });
  const [selectedEvalDatasets, setSelectedEvalDatasets] = useState<EvalDatasetName[]>(
    EVAL_DATASET_OPTIONS.map((item) => item.key)
  );
  const [evalGateConfig, setEvalGateConfig] = useState<EvalGateConfig | null>(null);
  const [evalGateRuns, setEvalGateRuns] = useState<EvalGateRun[]>([]);
  const [evalGateLastRun, setEvalGateLastRun] = useState<EvalGateRun | null>(null);
  const [evalGateLoading, setEvalGateLoading] = useState(false);
  const [evalGateSaving, setEvalGateSaving] = useState(false);
  const [evalGateRunning, setEvalGateRunning] = useState(false);
  const [evalGateDraft, setEvalGateDraft] = useState({
    enabled: true,
    datasets: EVAL_DATASET_OPTIONS.map((item) => item.key as EvalDatasetName),
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
        typeof payload.rolloutPercent === "number" && Number.isFinite(payload.rolloutPercent)
          ? payload.rolloutPercent
          : 100,
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
      const res = await fetch("/api/admin/ai/evals/gate", {
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
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "保存评测门禁失败");
        return;
      }
      syncEvalGatePayload((payload?.data ?? null) as EvalGatePayload | null);
      setMessage("评测门禁配置已保存");
    } finally {
      setEvalGateSaving(false);
    }
  }

  async function runEvalGate() {
    setEvalGateRunning(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/ai/evals/gate", {
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
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "执行评测门禁失败");
        return;
      }
      syncEvalGatePayload((payload?.data ?? null) as EvalGatePayload | null);
      const passed = Boolean(payload?.data?.lastRun?.passed);
      setMessage(passed ? "评测门禁通过" : "评测门禁未通过，请根据失败规则调整");
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
      const res = await fetch("/api/admin/ai/quality-calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          globalBias: suggestion.recommendedGlobalBias,
          providerAdjustments: suggestion.providerAdjustments,
          kindAdjustments: suggestion.kindAdjustments,
          reason: "apply_eval_suggestion"
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "应用校准建议失败");
        return;
      }
      syncCalibrationPayload((payload?.data ?? null) as QualityCalibrationPayload | null);
      setMessage("已应用离线评测校准建议");
    } finally {
      setSaving(false);
    }
  }

  async function saveCalibrationRollout() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/ai/quality-calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: calibrationDraft.enabled,
          rolloutPercent: calibrationDraft.rolloutPercent,
          rolloutSalt: calibrationDraft.rolloutSalt,
          reason: "update_rollout_control"
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "保存灰度配置失败");
        return;
      }
      syncCalibrationPayload((payload?.data ?? null) as QualityCalibrationPayload | null);
      setMessage("灰度开关配置已保存");
    } finally {
      setSaving(false);
    }
  }

  async function rollbackCalibration(snapshotId: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/ai/quality-calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rollback",
          snapshotId,
          reason: "manual_rollback"
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "回滚失败");
        return;
      }
      syncCalibrationPayload((payload?.data ?? null) as QualityCalibrationPayload | null);
      setMessage("已完成校准回滚");
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
      const next = prev.datasets.includes(dataset)
        ? prev.datasets.filter((item) => item !== dataset)
        : [...prev.datasets, dataset];
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

  const selectedTaskPolicy = useMemo(
    () => policies.find((item) => item.taskType === selectedTaskType) ?? null,
    [policies, selectedTaskType]
  );

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

  const chainChatHealthIssues = useMemo(() => {
    return effectivePreview
      .map((provider) => ({
        provider,
        health: providerHealthMap.get(provider)
      }))
      .filter((item) => item.provider !== "mock" && item.health && !item.health.chat.configured);
  }, [effectivePreview, providerHealthMap]);

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
      const res = await fetch("/api/admin/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerChain: draftChain })
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "保存失败");
        return;
      }
      const data: ConfigData = payload?.data ?? null;
      setConfig(data);
      setDraftChain(data?.runtimeProviderChain ?? []);
      setMessage("AI 模型链已保存");
    } finally {
      setSaving(false);
    }
  }

  async function resetToEnv() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true })
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "重置失败");
        return;
      }
      const data: ConfigData = payload?.data ?? null;
      setConfig(data);
      setDraftChain(data?.runtimeProviderChain ?? []);
      setMessage("已切回环境变量配置");
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
      const res = await fetch("/api/admin/ai/policies", {
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
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "保存任务策略失败");
        return;
      }
      const data: PoliciesPayload = payload?.data ?? { tasks: [], policies: [] };
      setTaskOptions(data.tasks ?? []);
      setPolicies(data.policies ?? []);
      setMessage(`任务策略已保存：${selectedTaskType}`);
      await loadMetrics();
    } finally {
      setSaving(false);
    }
  }

  async function resetTaskPolicy() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/ai/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: selectedTaskType,
          reset: true
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "重置任务策略失败");
        return;
      }
      const data: PoliciesPayload = payload?.data ?? { tasks: [], policies: [] };
      setTaskOptions(data.tasks ?? []);
      setPolicies(data.policies ?? []);
      setMessage(`任务策略已重置：${selectedTaskType}`);
      await loadMetrics();
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

      <Card title="当前配置" tag="模型">
        {loading ? <p>加载中...</p> : null}
        {error ? <div style={{ color: "#b42318", fontSize: 13 }}>{error}</div> : null}
        {message ? <div style={{ color: "#027a48", fontSize: 13 }}>{message}</div> : null}
        {!loading && config ? (
          <div className="grid" style={{ gap: 10, marginTop: 8 }}>
            <div className="card" style={{ fontSize: 12, color: "var(--ink-1)" }}>
              环境链：{config.envProviderChain.join(" -> ")}
            </div>
            <div className="card" style={{ fontSize: 12, color: "var(--ink-1)" }}>
              运行链：{config.runtimeProviderChain.length ? config.runtimeProviderChain.join(" -> ") : "未覆盖（跟随环境链）"}
            </div>
            <div className="card" style={{ fontSize: 12, color: "var(--ink-1)" }}>
              生效链：{config.effectiveProviderChain.join(" -> ")}
            </div>
            {chainChatHealthIssues.length ? (
              <div className="card" style={{ fontSize: 12, color: "#b42318" }}>
                当前生效链存在未完成配置的模型：
                {chainChatHealthIssues
                  .map((item) =>
                    `${item.provider}${item.health?.chat.missingEnv?.length ? `（缺少 ${item.health.chat.missingEnv.join(" / ")}）` : ""}`
                  )
                  .join("、")}
              </div>
            ) : null}
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
              更新时间：{config.updatedAt ? new Date(config.updatedAt).toLocaleString("zh-CN") : "-"} · 操作人：
              {config.updatedBy ?? "-"}
            </div>
          </div>
        ) : null}
      </Card>

      <Card title="模型链编辑" tag="切换">
        <div className="grid" style={{ gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
            选择并排序模型。系统会按顺序调用，失败后自动降级。
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {(config?.availableProviders ?? []).map((provider) => {
              const selected = draftChain.includes(provider.key);
              const health = providerHealthMap.get(provider.key);
              return (
                <div className="card" key={provider.key}>
                  <div className="section-title">{provider.label}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>{provider.description}</div>
                  {health ? (
                    <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 6 }}>
                      文本能力：{health.chat.configured ? "已配置" : "未配置"} · 视觉能力：
                      {health.vision.configured ? "已配置" : "未配置"}
                      {health.chat.model ? ` · chat模型 ${health.chat.model}` : ""}
                    </div>
                  ) : null}
                  {health && !health.chat.configured && health.chat.missingEnv.length ? (
                    <div style={{ fontSize: 12, color: "#b42318", marginTop: 4 }}>
                      缺少：{health.chat.missingEnv.join(" / ")}
                    </div>
                  ) : null}
                  <div className="cta-row" style={{ marginTop: 8 }}>
                    {!selected ? (
                      <button className="button secondary" type="button" onClick={() => addProvider(provider.key)}>
                        加入链路
                      </button>
                    ) : (
                      <button className="button ghost" type="button" onClick={() => removeProvider(provider.key)}>
                        移除
                      </button>
                    )}
                    <button className="button ghost" type="button" onClick={() => runProbe([provider.key])} disabled={testing}>
                      测试该模型
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card">
            <div className="section-title">链路顺序预览</div>
            <div className="grid" style={{ gap: 8, marginTop: 8 }}>
              {effectivePreview.map((provider, index) => (
                <div
                  key={`${provider}-${index}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid var(--stroke)"
                  }}
                >
                  <div style={{ fontSize: 13 }}>
                    #{index + 1} · {provider}
                  </div>
                  <div className="cta-row">
                    <button className="button ghost" type="button" onClick={() => moveProvider(provider, -1)}>
                      上移
                    </button>
                    <button className="button ghost" type="button" onClick={() => moveProvider(provider, 1)}>
                      下移
                    </button>
                    <button className="button ghost" type="button" onClick={() => removeProvider(provider)}>
                      移除
                    </button>
                  </div>
                </div>
              ))}
              {!effectivePreview.length ? <div style={{ fontSize: 12, color: "var(--ink-1)" }}>当前为空，将回退到 mock。</div> : null}
            </div>
          </div>
          <div className="cta-row">
            <button className="button primary" type="button" onClick={saveChain} disabled={saving}>
              {saving ? "保存中..." : "保存模型链"}
            </button>
            <button className="button ghost" type="button" onClick={resetToEnv} disabled={saving}>
              切回环境变量
            </button>
            <Link className="button secondary" href="/admin">
              返回管理首页
            </Link>
          </div>
        </div>
      </Card>

      <Card title="任务策略" tag="Policy">
        <div className="grid" style={{ gap: 10 }}>
          <div className="grid grid-3">
            <label>
              <div className="section-title">任务类型</div>
              <select
                value={selectedTaskType}
                onChange={(event) => setSelectedTaskType(event.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {taskOptions.map((item) => (
                  <option key={item.taskType} value={item.taskType}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">超时(ms)</div>
              <input
                type="number"
                min={500}
                max={30000}
                value={policyDraft.timeoutMs}
                onChange={(event) =>
                  setPolicyDraft((prev) => ({ ...prev, timeoutMs: Number(event.target.value || 0) }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label>
              <div className="section-title">重试次数</div>
              <input
                type="number"
                min={0}
                max={5}
                value={policyDraft.maxRetries}
                onChange={(event) =>
                  setPolicyDraft((prev) => ({ ...prev, maxRetries: Number(event.target.value || 0) }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
          </div>
          <div className="grid grid-2">
            <label>
              <div className="section-title">预算阈值（字符）</div>
              <input
                type="number"
                min={100}
                max={100000}
                value={policyDraft.budgetLimit}
                onChange={(event) =>
                  setPolicyDraft((prev) => ({ ...prev, budgetLimit: Number(event.target.value || 0) }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label>
              <div className="section-title">最低质量分</div>
              <input
                type="number"
                min={0}
                max={100}
                value={policyDraft.minQualityScore}
                onChange={(event) =>
                  setPolicyDraft((prev) => ({ ...prev, minQualityScore: Number(event.target.value || 0) }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
          </div>
          <label>
            <div className="section-title">任务模型链（逗号分隔，空值=跟随全局模型链）</div>
            <input
              value={policyDraft.providerChain}
              onChange={(event) => setPolicyDraft((prev) => ({ ...prev, providerChain: event.target.value }))}
              placeholder="zhipu,deepseek,kimi"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          {selectedTaskPolicy ? (
            <div className="card" style={{ fontSize: 12, color: "var(--ink-1)" }}>
              当前策略来源：{selectedTaskPolicy.source === "runtime" ? "运行时覆盖" : "默认策略"} · 生效链：
              {selectedTaskPolicy.providerChain.join(" -> ")} · 更新时间：
              {selectedTaskPolicy.updatedAt ? new Date(selectedTaskPolicy.updatedAt).toLocaleString("zh-CN") : "-"}
            </div>
          ) : null}
          <div className="cta-row">
            <button className="button primary" type="button" onClick={saveTaskPolicy} disabled={saving}>
              保存任务策略
            </button>
            <button className="button ghost" type="button" onClick={resetTaskPolicy} disabled={saving}>
              重置当前任务
            </button>
          </div>
        </div>
      </Card>

      <Card title="连通性测试" tag="诊断">
        <div className="cta-row" style={{ marginBottom: 10 }}>
          <label>
            <div className="section-title">测试能力</div>
            <select
              value={testCapability}
              onChange={(event) => setTestCapability(event.target.value as "chat" | "vision")}
              style={{ width: 180, padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="chat">文本模型</option>
              <option value="vision">视觉模型</option>
            </select>
          </label>
          <button className="button secondary" type="button" onClick={() => runProbe()} disabled={testing}>
            {testing ? "测试中..." : "测试当前生效链"}
          </button>
        </div>
        {probe ? (
          <div className="grid" style={{ gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
              测试时间：{new Date(probe.testedAt).toLocaleString("zh-CN")} · 能力：{probe.capability}
            </div>
            {probe.results.map((item) => (
              <div className="card" key={`${item.provider}-${item.latencyMs}`}>
                <div className="section-title">
                  {item.provider} · {item.ok ? "成功" : "失败"}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  延迟 {item.latencyMs}ms · {item.message}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--ink-1)" }}>尚未执行连通性测试。</p>
        )}
      </Card>

      <Card title="离线评测与质量校准" tag="Eval">
        <div className="grid" style={{ gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
            选择数据集运行离线评测，系统会输出质量校准建议，可直接一键应用。
          </div>
          <div className="grid grid-3">
            {EVAL_DATASET_OPTIONS.map((dataset) => (
              <label
                key={dataset.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid var(--stroke)",
                  fontSize: 12
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedEvalDatasets.includes(dataset.key)}
                  onChange={() => toggleEvalDataset(dataset.key)}
                />
                <span>{dataset.label}</span>
              </label>
            ))}
          </div>
          <div className="cta-row">
            <button className="button secondary" type="button" onClick={runOfflineEval} disabled={evalLoading}>
              {evalLoading ? "评测中..." : "运行离线评测"}
            </button>
            <button
              className="button primary"
              type="button"
              onClick={applyEvalCalibrationSuggestion}
              disabled={saving || !evalReport}
            >
              应用评测校准建议
            </button>
            <button className="button ghost" type="button" onClick={loadCalibration} disabled={calibrationLoading}>
              {calibrationLoading ? "加载中..." : "刷新校准配置"}
            </button>
          </div>

          {calibrationConfig ? (
            <div className="grid" style={{ gap: 8 }}>
              <div className="card">
                <div className="section-title">当前质量校准</div>
                <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 6 }}>
                  全局偏置 {calibrationConfig.globalBias} · 开关 {calibrationConfig.enabled ? "开启" : "关闭"} · 灰度{" "}
                  {calibrationConfig.rolloutPercent}% · 更新时间{" "}
                  {calibrationConfig.updatedAt ? new Date(calibrationConfig.updatedAt).toLocaleString("zh-CN") : "-"}
                </div>
                <div className="pill-list" style={{ marginTop: 8 }}>
                  {Object.entries(calibrationConfig.providerAdjustments ?? {}).map(([provider, bias]) => (
                    <span className="pill" key={`provider-${provider}`}>
                      {provider}: {bias}
                    </span>
                  ))}
                  {!Object.keys(calibrationConfig.providerAdjustments ?? {}).length ? (
                    <span className="pill">provider 无额外校准</span>
                  ) : null}
                </div>
                <div className="pill-list" style={{ marginTop: 8 }}>
                  {Object.entries(calibrationConfig.kindAdjustments ?? {}).map(([kind, bias]) => (
                    <span className="pill" key={`kind-${kind}`}>
                      {kind}: {bias}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="section-title">灰度开关与回滚保护</div>
                <div className="grid grid-3" style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 12 }}>
                    <div className="section-title">校准开关</div>
                    <select
                      value={calibrationDraft.enabled ? "enabled" : "disabled"}
                      onChange={(event) =>
                        setCalibrationDraft((prev) => ({ ...prev, enabled: event.target.value === "enabled" }))
                      }
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                    >
                      <option value="enabled">开启</option>
                      <option value="disabled">关闭</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 12 }}>
                    <div className="section-title">灰度比例（%）</div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={calibrationDraft.rolloutPercent}
                      onChange={(event) =>
                        setCalibrationDraft((prev) => ({
                          ...prev,
                          rolloutPercent: Number(event.target.value || 0)
                        }))
                      }
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                    />
                  </label>
                  <label style={{ fontSize: 12 }}>
                    <div className="section-title">灰度盐值</div>
                    <input
                      value={calibrationDraft.rolloutSalt}
                      onChange={(event) =>
                        setCalibrationDraft((prev) => ({
                          ...prev,
                          rolloutSalt: event.target.value
                        }))
                      }
                      placeholder="default"
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                    />
                  </label>
                </div>
                <div className="cta-row" style={{ marginTop: 10 }}>
                  <button className="button secondary" type="button" onClick={saveCalibrationRollout} disabled={saving}>
                    保存灰度配置
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="section-title">最近快照（可回滚）</div>
                {calibrationSnapshots.length ? (
                  <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                    {calibrationSnapshots.slice(0, 6).map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          padding: 10,
                          borderRadius: 10,
                          border: "1px solid var(--stroke)"
                        }}
                      >
                        <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                          {new Date(item.createdAt).toLocaleString("zh-CN")} · {item.reason} · 偏置{" "}
                          {item.config.globalBias} · 灰度 {item.config.rolloutPercent}%
                        </div>
                        <button
                          className="button ghost"
                          type="button"
                          onClick={() => rollbackCalibration(item.id)}
                          disabled={saving}
                        >
                          回滚到此版本
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 8 }}>暂无快照记录。</div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>尚未加载校准配置。</div>
          )}

          {evalReport ? (
            <div className="grid" style={{ gap: 8 }}>
              <div className="pill-list">
                <span className="pill">样本 {evalReport.summary.totalCases}</span>
                <span className="pill">通过率 {evalReport.summary.passRate}%</span>
                <span className="pill">均分 {evalReport.summary.averageScore}</span>
                <span className="pill">高风险 {evalReport.summary.highRiskCount}</span>
                <span className="pill">建议偏置 {evalReport.summary.calibrationSuggestion.recommendedGlobalBias}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                评测时间：{new Date(evalReport.generatedAt).toLocaleString("zh-CN")} · 建议说明：
                {evalReport.summary.calibrationSuggestion.note}
              </div>
              <div className="grid" style={{ gap: 8 }}>
                {evalReport.datasets.map((dataset) => (
                  <div className="card" key={dataset.dataset}>
                    <div className="section-title">{dataset.dataset}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                      样本 {dataset.total} · 通过 {dataset.passed} · 通过率 {dataset.passRate}% · 均分 {dataset.averageScore} ·
                      高风险 {dataset.highRiskCount}
                    </div>
                  </div>
                ))}
              </div>
              <div className="card" style={{ fontSize: 12, color: "var(--ink-1)" }}>
                <div>建议 provider 校准：{JSON.stringify(evalReport.summary.calibrationSuggestion.providerAdjustments)}</div>
                <div style={{ marginTop: 4 }}>
                  建议 kind 校准：{JSON.stringify(evalReport.summary.calibrationSuggestion.kindAdjustments)}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>尚未运行离线评测。</div>
          )}
        </div>
      </Card>

      <Card title="离线评测门禁" tag="Gate">
        <div className="grid" style={{ gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
            用于发布前自动判断 AI 质量是否达标。未达标时可自动回滚到最近稳定校准快照。
          </div>

          {evalGateLoading ? <div style={{ fontSize: 12, color: "var(--ink-1)" }}>加载门禁配置中...</div> : null}

          <div className="grid grid-3">
            <label style={{ fontSize: 12 }}>
              <div className="section-title">门禁开关</div>
              <select
                value={evalGateDraft.enabled ? "enabled" : "disabled"}
                onChange={(event) =>
                  setEvalGateDraft((prev) => ({ ...prev, enabled: event.target.value === "enabled" }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                <option value="enabled">开启</option>
                <option value="disabled">关闭</option>
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              <div className="section-title">最低通过率（%）</div>
              <input
                type="number"
                min={0}
                max={100}
                value={evalGateDraft.minPassRate}
                onChange={(event) =>
                  setEvalGateDraft((prev) => ({ ...prev, minPassRate: Number(event.target.value || 0) }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              <div className="section-title">最低均分</div>
              <input
                type="number"
                min={0}
                max={100}
                value={evalGateDraft.minAverageScore}
                onChange={(event) =>
                  setEvalGateDraft((prev) => ({ ...prev, minAverageScore: Number(event.target.value || 0) }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
          </div>

          <div className="grid grid-2">
            <label style={{ fontSize: 12 }}>
              <div className="section-title">最高高风险样本数</div>
              <input
                type="number"
                min={0}
                max={9999}
                value={evalGateDraft.maxHighRiskCount}
                onChange={(event) =>
                  setEvalGateDraft((prev) => ({ ...prev, maxHighRiskCount: Number(event.target.value || 0) }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8, marginTop: 22 }}>
              <input
                type="checkbox"
                checked={evalGateDraft.autoRollbackOnFail}
                onChange={(event) =>
                  setEvalGateDraft((prev) => ({ ...prev, autoRollbackOnFail: event.target.checked }))
                }
              />
              <span>门禁失败自动回滚校准快照</span>
            </label>
          </div>

          <div className="grid grid-3">
            {EVAL_DATASET_OPTIONS.map((dataset) => (
              <label
                key={`gate-dataset-${dataset.key}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid var(--stroke)",
                  fontSize: 12
                }}
              >
                <input
                  type="checkbox"
                  checked={evalGateDraft.datasets.includes(dataset.key)}
                  onChange={() => toggleEvalGateDataset(dataset.key)}
                />
                <span>{dataset.label}</span>
              </label>
            ))}
          </div>

          <div className="cta-row">
            <button className="button secondary" type="button" onClick={saveEvalGateConfig} disabled={evalGateSaving}>
              {evalGateSaving ? "保存中..." : "保存门禁配置"}
            </button>
            <button className="button primary" type="button" onClick={runEvalGate} disabled={evalGateRunning}>
              {evalGateRunning ? "执行中..." : "立即执行门禁"}
            </button>
            <button className="button ghost" type="button" onClick={loadEvalGate} disabled={evalGateLoading}>
              刷新门禁状态
            </button>
          </div>

          {evalGateConfig ? (
            <div className="card" style={{ fontSize: 12, color: "var(--ink-1)" }}>
              当前配置：{evalGateConfig.enabled ? "启用" : "停用"} · 数据集{" "}
              {(evalGateConfig.datasets ?? []).map((item) => EVAL_DATASET_LABELS.get(item) ?? item).join("、") || "-"} ·
              更新时间 {evalGateConfig.updatedAt ? new Date(evalGateConfig.updatedAt).toLocaleString("zh-CN") : "-"} ·
              操作人 {evalGateConfig.updatedBy ?? "-"}
            </div>
          ) : null}

          {evalGateLastRun ? (
            <div className="card">
              <div className="section-title">
                最近执行：{evalGateLastRun.passed ? "通过" : "未通过"} ·{" "}
                {new Date(evalGateLastRun.executedAt).toLocaleString("zh-CN")}
              </div>
              <div className="pill-list" style={{ marginTop: 8 }}>
                <span className="pill">样本 {evalGateLastRun.reportSummary.totalCases}</span>
                <span className="pill">通过率 {evalGateLastRun.reportSummary.passRate}%</span>
                <span className="pill">均分 {evalGateLastRun.reportSummary.averageScore}</span>
                <span className="pill">高风险 {evalGateLastRun.reportSummary.highRiskCount}</span>
              </div>
              {evalGateLastRun.failedRules?.length ? (
                <ul style={{ margin: "8px 0 0 16px", fontSize: 12 }}>
                  {evalGateLastRun.failedRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>本次门禁无失败规则。</div>
              )}
              {evalGateLastRun.rollback.attempted ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>
                  自动回滚：{evalGateLastRun.rollback.success ? "成功" : "失败"} · 快照{" "}
                  {evalGateLastRun.rollback.snapshotId ?? "-"} · {evalGateLastRun.rollback.message}
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>尚未执行过门禁。</div>
          )}

          {evalGateRuns.length ? (
            <div className="card">
              <div className="section-title">最近门禁记录</div>
              <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                {evalGateRuns.slice(0, 6).map((run) => (
                  <div
                    key={run.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid var(--stroke)"
                    }}
                  >
                    <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                      {new Date(run.executedAt).toLocaleString("zh-CN")} · {run.passed ? "通过" : "未通过"} · 通过率{" "}
                      {run.reportSummary.passRate}% · 高风险 {run.reportSummary.highRiskCount}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                      {(run.config.datasets ?? [])
                        .map((dataset) => EVAL_DATASET_LABELS.get(dataset) ?? dataset)
                        .join("、")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card title="AI 调用指标" tag="Metrics">
        <div className="cta-row" style={{ marginBottom: 10 }}>
          <button className="button secondary" type="button" onClick={loadMetrics} disabled={metricsLoading}>
            {metricsLoading ? "刷新中..." : "刷新指标"}
          </button>
        </div>
        {metrics ? (
          <div className="grid" style={{ gap: 8 }}>
            <div className="pill-list">
              <span className="pill">调用量 {metrics.totalCalls}</span>
              <span className="pill">成功率 {metrics.successRate}%</span>
              <span className="pill">回退率 {metrics.fallbackRate}%</span>
              <span className="pill">超时率 {metrics.timeoutRate}%</span>
              <span className="pill">质量拦截率 {metrics.qualityRejectRate}%</span>
              <span className="pill">预算拦截率 {metrics.budgetRejectRate}%</span>
              <span className="pill">P95 {metrics.p95LatencyMs}ms</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
              更新时间：{new Date(metrics.generatedAt).toLocaleString("zh-CN")}
            </div>
            <div className="grid" style={{ gap: 8 }}>
              {(metrics.rows ?? []).map((row) => (
                <div className="card" key={row.key}>
                  <div className="section-title">
                    {row.taskType} · {row.provider}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                    调用 {row.calls} · 成功率 {row.successRate}% · 超时率 {row.timeoutRate}% · 平均回退{" "}
                    {row.avgFallback} · 质量拦截 {row.qualityRejectRate}% · 预算拦截 {row.budgetRejectRate}% · 平均延迟{" "}
                    {row.avgLatencyMs}ms · P95 {row.p95LatencyMs}ms
                  </div>
                </div>
              ))}
              {!metrics.rows?.length ? <div style={{ color: "var(--ink-1)" }}>暂无调用日志。</div> : null}
            </div>
          </div>
        ) : (
          <p style={{ color: "var(--ink-1)" }}>暂无指标数据。</p>
        )}
      </Card>
    </div>
  );
}
