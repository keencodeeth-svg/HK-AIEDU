"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";

type ProviderOption = {
  key: string;
  label: string;
  description: string;
};

type ConfigData = {
  availableProviders: ProviderOption[];
  runtimeProviderChain: string[];
  envProviderChain: string[];
  effectiveProviderChain: string[];
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
  avgLatencyMs: number;
  p95LatencyMs: number;
};

type AiMetrics = {
  generatedAt: string;
  totalCalls: number;
  successRate: number;
  fallbackRate: number;
  timeoutRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  rows: MetricsRow[];
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

  useEffect(() => {
    Promise.all([loadConfig(), loadPolicies(), loadMetrics()]);
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
              return (
                <div className="card" key={provider.key}>
                  <div className="section-title">{provider.label}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>{provider.description}</div>
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
                    {row.avgFallback} · 平均延迟 {row.avgLatencyMs}ms · P95 {row.p95LatencyMs}ms
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
