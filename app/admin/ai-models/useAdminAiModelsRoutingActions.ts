import { type Dispatch, type SetStateAction, useCallback } from "react";
import {
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  ConfigData,
  PoliciesPayload,
  PolicyDraft,
  ProbeCapability,
  ProbeResponse
} from "./types";
import {
  addProviderToChain,
  moveProviderInChain,
  parseChainInput,
  removeProviderFromChain
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type SnapshotRef = {
  current: boolean;
};

type RunWithStepUp = (
  action: () => Promise<void>,
  onError?: (error: unknown) => void
) => Promise<void>;

type ConfigResponse = {
  data?: ConfigData | null;
};

type PoliciesResponse = {
  data?: PoliciesPayload;
};

type ProbeApiResponse = {
  data?: ProbeResponse | null;
};

type AdminAiModelsRoutingActionsOptions = {
  runWithStepUp: RunWithStepUp;
  draftChain: string[];
  effectivePreview: string[];
  testCapability: ProbeCapability;
  selectedTaskType: string;
  policyDraft: PolicyDraft;
  loadMetrics: () => Promise<void>;
  syncPoliciesPayload: (payload?: PoliciesPayload) => void;
  hasConfigSnapshotRef: SnapshotRef;
  hasPoliciesSnapshotRef: SnapshotRef;
  setDraftChain: Setter<string[]>;
  setSaving: Setter<boolean>;
  setTesting: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setBootstrapNotice: Setter<string | null>;
  setError: Setter<string | null>;
  setMessage: Setter<string | null>;
  setConfig: Setter<ConfigData | null>;
  setProbe: Setter<ProbeResponse | null>;
};

export function useAdminAiModelsRoutingActions({
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
}: AdminAiModelsRoutingActionsOptions) {
  const addProvider = useCallback(
    (provider: string) => {
      setDraftChain((prev) => addProviderToChain(prev, provider));
    },
    [setDraftChain]
  );

  const removeProvider = useCallback(
    (provider: string) => {
      setDraftChain((prev) => removeProviderFromChain(prev, provider));
    },
    [setDraftChain]
  );

  const moveProvider = useCallback(
    (provider: string, offset: -1 | 1) => {
      setDraftChain((prev) => moveProviderInChain(prev, provider, offset));
    },
    [setDraftChain]
  );

  const saveChain = useCallback(async () => {
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
  }, [
    draftChain,
    hasConfigSnapshotRef,
    runWithStepUp,
    setAuthRequired,
    setBootstrapNotice,
    setConfig,
    setDraftChain,
    setError,
    setMessage,
    setSaving
  ]);

  const resetToEnv = useCallback(async () => {
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
  }, [
    hasConfigSnapshotRef,
    runWithStepUp,
    setAuthRequired,
    setBootstrapNotice,
    setConfig,
    setDraftChain,
    setError,
    setMessage,
    setSaving
  ]);

  const runProbe = useCallback(async (providers?: string[]) => {
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
  }, [
    effectivePreview,
    setAuthRequired,
    setError,
    setMessage,
    setProbe,
    setTesting,
    testCapability
  ]);

  const saveTaskPolicy = useCallback(async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<PoliciesResponse>("/api/admin/ai/policies", {
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
  }, [
    hasPoliciesSnapshotRef,
    loadMetrics,
    policyDraft,
    runWithStepUp,
    selectedTaskType,
    setAuthRequired,
    setBootstrapNotice,
    setError,
    setMessage,
    setSaving,
    syncPoliciesPayload
  ]);

  const resetTaskPolicy = useCallback(async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<PoliciesResponse>("/api/admin/ai/policies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskType: selectedTaskType,
              reset: true
            })
          });
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
  }, [
    hasPoliciesSnapshotRef,
    loadMetrics,
    runWithStepUp,
    selectedTaskType,
    setAuthRequired,
    setBootstrapNotice,
    setError,
    setMessage,
    setSaving,
    syncPoliciesPayload
  ]);

  return {
    addProvider,
    removeProvider,
    moveProvider,
    saveChain,
    resetToEnv,
    runProbe,
    saveTaskPolicy,
    resetTaskPolicy
  };
}
