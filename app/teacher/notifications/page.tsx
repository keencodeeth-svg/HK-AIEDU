"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import {
  formatLoadedTime,
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";
import NotificationExecutionLoopCard from "./_components/NotificationExecutionLoopCard";
import type {
  ClassItem,
  HistoryItem,
  HistoryResponse,
  PreviewAssignment,
  PreviewData,
  RuleItem,
  RuleResponse
} from "./types";

const DEFAULT_RULE = {
  enabled: true,
  dueDays: 2,
  overdueDays: 0,
  includeParents: true
};

function buildDraftRule(classId: string, rules: RuleItem[]): RuleItem {
  const existing = rules.find((item) => item.classId === classId);
  return (
    existing ?? {
      id: "",
      classId,
      ...DEFAULT_RULE
    }
  );
}

function isSameRule(left: RuleItem, right: RuleItem) {
  return (
    left.classId === right.classId &&
    left.enabled === right.enabled &&
    left.dueDays === right.dueDays &&
    left.overdueDays === right.overdueDays &&
    left.includeParents === right.includeParents
  );
}

function getStageLabel(stage: PreviewAssignment["stage"]) {
  return stage === "overdue" ? "已逾期" : "即将到期";
}

function getStageDescription(stage: PreviewAssignment["stage"]) {
  return stage === "overdue" ? "优先催交，避免继续堆积未完成。"
    : "适合做截止前提醒，减少下一轮逾期。";
}

function getRuleWindowLabel(rule: RuleItem) {
  return `截止前 ${rule.dueDays} 天 · 逾期 ${rule.overdueDays} 天 · 家长抄送 ${rule.includeParents ? "开启" : "关闭"}`;
}

function getSelectedClassLabel(selectedClass: ClassItem | null) {
  if (!selectedClass) return "未选择班级";
  return `${selectedClass.name} · ${SUBJECT_LABELS[selectedClass.subject] ?? selectedClass.subject} · ${selectedClass.grade} 年级`;
}

function getCommandState(params: {
  draftRule: RuleItem;
  preview: PreviewData | null;
  hasUnsavedChanges: boolean;
  isPreviewCurrent: boolean;
}) {
  if (!params.draftRule.enabled) {
    return {
      tone: "info" as const,
      title: "当前规则关闭",
      description: "关闭状态下不会发送任何提醒。先确认今天是否真的要开启这条催交流程。"
    };
  }
  if (!params.isPreviewCurrent) {
    return {
      tone: "info" as const,
      title: "草稿已变更，请先刷新预览",
      description: "发送动作会基于当前草稿执行。先刷新预览，确认最新规则到底会触达谁，再决定是否立即发送。"
    };
  }
  if (!params.preview) {
    return {
      tone: "loading" as const,
      title: "预览准备中",
      description: "正在同步当前班级的提醒范围。"
    };
  }
  if (!params.preview.summary.assignmentTargets) {
    return {
      tone: "empty" as const,
      title: "当前没有待发提醒",
      description: "这套规则现在不会触发任何提醒。可以放宽阈值，或把注意力转到提交箱和成绩册。"
    };
  }
  if (params.preview.summary.overdueAssignments > 0) {
    return {
      tone: "info" as const,
      title: "当前更适合先发逾期催交",
      description: `已逾期 ${params.preview.summary.overdueAssignments} 份作业，建议先看逾期队列，再决定是否立即发送。`
    };
  }
  return {
    tone: params.hasUnsavedChanges ? ("info" as const) : ("success" as const),
    title: params.hasUnsavedChanges ? "草稿已准备好，但还未保存为默认规则" : "当前规则已经准备好执行",
    description: `当前预览会覆盖 ${params.preview.summary.assignmentTargets} 份作业、${params.preview.summary.uniqueStudents} 名学生。`
  };
}

export default function TeacherNotificationRulesPage() {
  const classIdRef = useRef("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [savedRules, setSavedRules] = useState<RuleItem[]>([]);
  const [classId, setClassId] = useState("");
  const [draftRule, setDraftRule] = useState<RuleItem>({ id: "", classId: "", ...DEFAULT_RULE });
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewRuleSnapshot, setPreviewRuleSnapshot] = useState<RuleItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historySummary, setHistorySummary] = useState<HistoryResponse["summary"] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const loadPreview = useCallback(async (nextRule: RuleItem, silent = false) => {
    if (!nextRule.classId) {
      setPreview(null);
      setPreviewRuleSnapshot(null);
      return null;
    }
    if (!silent) {
      setPreviewing(true);
    }
    try {
      const payload = await requestJson<{ data?: PreviewData }>("/api/teacher/notifications/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: nextRule.classId,
          enabled: nextRule.enabled,
          dueDays: nextRule.dueDays,
          overdueDays: nextRule.overdueDays,
          includeParents: nextRule.includeParents
        })
      });
      const nextPreview = payload.data ?? null;
      setPreview(nextPreview);
      setPreviewRuleSnapshot(nextPreview?.rule ?? nextRule);
      return nextPreview;
    } finally {
      if (!silent) {
        setPreviewing(false);
      }
    }
  }, []);

  const loadHistory = useCallback(async (nextClassId: string, silent = false) => {
    if (!nextClassId) {
      setHistory([]);
      setHistorySummary(null);
      return [] as HistoryItem[];
    }
    if (!silent) {
      setHistoryLoading(true);
    }
    try {
      const payload = await requestJson<HistoryResponse>(
        `/api/teacher/notifications/history?classId=${encodeURIComponent(nextClassId)}&limit=8`
      );
      const nextHistory = payload.data ?? [];
      setHistory(nextHistory);
      setHistorySummary(payload.summary ?? null);
      return nextHistory;
    } finally {
      if (!silent) {
        setHistoryLoading(false);
      }
    }
  }, []);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const payload = await requestJson<RuleResponse>("/api/teacher/notifications/rules");
        const nextClasses = payload.classes ?? [];
        const nextRules = payload.rules ?? [];
        const currentClassId = classIdRef.current;
        const nextClassId =
          currentClassId && nextClasses.some((item) => item.id === currentClassId) ? currentClassId : nextClasses[0]?.id ?? "";
        const nextDraft = buildDraftRule(nextClassId, nextRules);

        setAuthRequired(false);
        setClasses(nextClasses);
        setSavedRules(nextRules);
        classIdRef.current = nextClassId;
        setClassId(nextClassId);
        setDraftRule(nextDraft);
        setLastLoadedAt(new Date().toISOString());

        await Promise.all([loadPreview(nextDraft, true), loadHistory(nextClassId, true)]);
      } catch (nextError) {
        if (isAuthError(nextError)) {
          setAuthRequired(true);
          classIdRef.current = "";
          setClasses([]);
          setSavedRules([]);
          setPreview(null);
          setPreviewRuleSnapshot(null);
          setHistory([]);
          setHistorySummary(null);
        } else {
          setLoadError(getRequestErrorMessage(nextError, "加载失败"));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadHistory, loadPreview]
  );

  useEffect(() => {
    classIdRef.current = classId;
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedClass = classes.find((item) => item.id === classId) ?? null;
  const savedRuleForClass = useMemo(() => buildDraftRule(classId, savedRules), [classId, savedRules]);
  const hasUnsavedChanges = classId ? !isSameRule(draftRule, savedRuleForClass) : false;
  const isPreviewCurrent = classId ? Boolean(previewRuleSnapshot && isSameRule(previewRuleSnapshot, draftRule)) : false;
  const configuredRuleCount = savedRules.length;
  const enabledRuleCount = savedRules.filter((item) => item.enabled).length;
  const latestHistory = history[0] ?? null;
  const latestClassResult = latestHistory?.classResults.find((entry) => entry.classId === classId) ?? latestHistory?.classResults[0] ?? null;
  const overdueAssignments = useMemo(
    () => preview?.sampleAssignments.filter((item) => item.stage === "overdue") ?? [],
    [preview?.sampleAssignments]
  );
  const dueSoonAssignments = useMemo(
    () => preview?.sampleAssignments.filter((item) => item.stage === "due_soon") ?? [],
    [preview?.sampleAssignments]
  );
  const commandState = getCommandState({ draftRule, preview, hasUnsavedChanges, isPreviewCurrent });
  const previewTargetDelta =
    latestClassResult && preview ? preview.summary.studentTargets - latestClassResult.studentTargets : null;

  function updateDraft(patch: Partial<RuleItem>) {
    setMessage(null);
    setActionError(null);
    setDraftRule((prev) => ({
      ...prev,
      ...patch,
      classId
    }));
  }

  async function handleClassChange(nextClassId: string) {
    classIdRef.current = nextClassId;
    setClassId(nextClassId);
    setMessage(null);
    setActionError(null);
    const nextDraft = buildDraftRule(nextClassId, savedRules);
    setDraftRule(nextDraft);
    setPreview(null);
    setPreviewRuleSnapshot(null);
    setHistory([]);
    setHistorySummary(null);

    try {
      await Promise.all([loadPreview(nextDraft), loadHistory(nextClassId)]);
    } catch (nextError) {
      setActionError(getRequestErrorMessage(nextError, "提醒上下文切换失败"));
    }
  }

  async function handleSave() {
    if (!classId) return;
    setSaving(true);
    setMessage(null);
    setActionError(null);
    try {
      const payload = await requestJson<{ data?: RuleItem }>("/api/teacher/notifications/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          enabled: draftRule.enabled,
          dueDays: draftRule.dueDays,
          overdueDays: draftRule.overdueDays,
          includeParents: draftRule.includeParents
        })
      });
      const savedRule = payload.data;
      if (savedRule) {
        setSavedRules((prev) => {
          const index = prev.findIndex((item) => item.classId === savedRule.classId);
          if (index >= 0) {
            const next = [...prev];
            next[index] = savedRule;
            return next;
          }
          return [...prev, savedRule];
        });
        setDraftRule(savedRule);
      }
      setMessage("通知规则已保存，后续运行将默认使用这套配置。");
      await loadPreview(savedRule ?? draftRule, true);
    } catch (nextError) {
      setActionError(getRequestErrorMessage(nextError, "保存失败"));
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    if (!classId) return;
    setMessage(null);
    setActionError(null);
    try {
      await loadPreview(draftRule);
    } catch (nextError) {
      setActionError(getRequestErrorMessage(nextError, "预览失败"));
    }
  }

  async function handleRun() {
    if (!classId) return;
    if (!isPreviewCurrent) {
      setActionError("请先刷新预览，确认最新草稿会触达谁，再发送提醒。");
      return;
    }
    setRunning(true);
    setMessage(null);
    setActionError(null);
    try {
      const payload = await requestJson<{
        data?: {
          students?: number;
          parents?: number;
          assignments?: number;
          dueSoonAssignments?: number;
          overdueAssignments?: number;
        };
      }>("/api/teacher/notifications/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          enabled: draftRule.enabled,
          dueDays: draftRule.dueDays,
          overdueDays: draftRule.overdueDays,
          includeParents: draftRule.includeParents
        })
      });
      setMessage(
        `已发送提醒：学生 ${payload.data?.students ?? 0} 条，家长 ${payload.data?.parents ?? 0} 条，覆盖作业 ${
          payload.data?.assignments ?? 0
        } 份。`
      );
      await Promise.all([loadPreview(draftRule, true), loadHistory(classId, true)]);
    } catch (nextError) {
      setActionError(getRequestErrorMessage(nextError, "发送失败"));
    } finally {
      setRunning(false);
    }
  }

  async function handleReset() {
    const nextDraft = buildDraftRule(classId, savedRules);
    setDraftRule(nextDraft);
    setMessage(null);
    setActionError(null);
    try {
      await loadPreview(nextDraft);
    } catch (nextError) {
      setActionError(getRequestErrorMessage(nextError, "预览同步失败"));
    }
  }

  if (loading && !classes.length && !authRequired) {
    return (
      <StatePanel
        tone="loading"
        title="通知规则加载中"
        description="正在同步教师班级、已保存规则、提醒预览和执行历史。"
      />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先使用教师账号登录"
        description="登录后即可配置班级通知规则、预览提醒范围并查看执行历史。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (loadError && !classes.length) {
    return (
      <StatePanel
        tone="error"
        title="通知规则暂时不可用"
        description={loadError}
        action={
          <button className="button secondary" type="button" onClick={() => void load("refresh")}>
            重新加载
          </button>
        }
      />
    );
  }

  if (!classes.length) {
    return (
      <StatePanel
        tone="empty"
        title="当前没有可配置的班级"
        description="创建班级或加入教学关系后，这里会自动出现可用的通知规则配置。"
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>通知规则</h2>
          <div className="section-sub">把提醒阈值、发送预览、历史复盘和后续验收串成一条完整催交链路。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">教师端</span>
          <span className="chip">{getSelectedClassLabel(selectedClass)}</span>
          <span className="chip">已配置规则 {configuredRuleCount}</span>
          <span className="chip">启用中 {enabledRuleCount}</span>
          {preview?.summary.assignmentTargets ? (
            <span className="chip">当前待发 {preview.summary.assignmentTargets} 份作业</span>
          ) : null}
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={() => void load("refresh")}
            disabled={refreshing || saving || running || previewing || historyLoading}
          >
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      <NotificationExecutionLoopCard
        selectedClass={selectedClass}
        draftRule={draftRule}
        preview={preview}
        latestHistory={latestHistory}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {loadError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${loadError}`}
          action={
            <button className="button secondary" type="button" onClick={() => void load("refresh")}>
              再试一次
            </button>
          }
        />
      ) : null}

      {actionError ? (
        <StatePanel compact tone="error" title="本次操作失败" description={actionError} />
      ) : null}

      {message ? <StatePanel compact tone="success" title="执行成功" description={message} /> : null}

      {!isPreviewCurrent && classId ? (
        <StatePanel
          compact
          tone="info"
          title="当前草稿尚未刷新到预览"
          description="你已经修改了提醒窗口或家长抄送设置。先刷新预览，确认最新草稿会覆盖哪些作业和学生，再决定是否发送。"
        />
      ) : null}

      <div className="teacher-notification-top-grid">
        <Card title="规则与执行区" tag="Config">
          <div className="feature-card">
            <EduIcon name="board" />
            <p>先选班级和提醒窗口，再刷新预览核对触达范围；保存解决默认策略，立即发送解决今天这一轮催交。</p>
          </div>

          <div className="teacher-notification-rule-grid" id="teacher-notification-config">
            <label>
              <div className="section-title">选择班级</div>
              <select value={classId} onChange={(event) => void handleClassChange(event.target.value)} style={{ width: "100%" }}>
                {classes.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.name} · {SUBJECT_LABELS[klass.subject] ?? klass.subject} · {klass.grade} 年级
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div className="section-title">提醒开关</div>
              <select
                value={draftRule.enabled ? "on" : "off"}
                onChange={(event) => updateDraft({ enabled: event.target.value === "on" })}
                style={{ width: "100%" }}
              >
                <option value="on">开启</option>
                <option value="off">关闭</option>
              </select>
            </label>

            <label>
              <div className="section-title">截止前提醒（天）</div>
              <input
                className="workflow-search-input"
                type="number"
                min={0}
                value={draftRule.dueDays}
                onChange={(event) => updateDraft({ dueDays: Number(event.target.value || 0) })}
              />
            </label>

            <label>
              <div className="section-title">逾期提醒（天）</div>
              <input
                className="workflow-search-input"
                type="number"
                min={0}
                value={draftRule.overdueDays}
                onChange={(event) => updateDraft({ overdueDays: Number(event.target.value || 0) })}
              />
            </label>

            <label className="teacher-notification-checkbox">
              <input
                type="checkbox"
                checked={draftRule.includeParents}
                onChange={(event) => updateDraft({ includeParents: event.target.checked })}
              />
              <span>抄送家长</span>
            </label>
          </div>

          <div className="workflow-card-meta">
            <span className="pill">{getSelectedClassLabel(selectedClass)}</span>
            <span className="pill">当前草稿 {draftRule.enabled ? "已开启" : "已关闭"}</span>
            <span className="pill">{getRuleWindowLabel(draftRule)}</span>
          </div>

          <div className="meta-text" style={{ marginTop: 12 }}>
            当前班级的默认规则是持久配置，但“立即发送提醒”始终会按当前草稿执行。先预览，再决定是只处理今天，还是顺便把默认策略也更新掉。
          </div>

          <div className="cta-row" id="teacher-notification-actions" style={{ marginTop: 12 }}>
            <button
              className="button ghost"
              type="button"
              onClick={() => void handleReset()}
              disabled={!hasUnsavedChanges || saving || running || previewing}
            >
              重置修改
            </button>
            <button className="button secondary" type="button" onClick={() => void handlePreview()} disabled={previewing || saving || running}>
              {previewing ? "预览中..." : "刷新预览"}
            </button>
            <button className="button secondary" type="button" onClick={() => void handleSave()} disabled={saving || running || previewing || !hasUnsavedChanges}>
              {saving ? "保存中..." : "保存默认规则"}
            </button>
            <button
              className="button primary"
              type="button"
              onClick={() => void handleRun()}
              disabled={running || saving || previewing || !draftRule.enabled || !isPreviewCurrent || !preview?.summary.assignmentTargets}
            >
              {running ? "发送中..." : "立即发送提醒"}
            </button>
          </div>
        </Card>

        <Card title="提醒指挥台" tag="Ops">
          <div className="teacher-notification-command-grid">
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">待触达作业</div>
              <div className="workflow-summary-value">{preview?.summary.assignmentTargets ?? 0}</div>
              <div className="workflow-summary-helper">当前草稿预估会触发提醒的作业数</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">覆盖学生</div>
              <div className="workflow-summary-value">{preview?.summary.uniqueStudents ?? 0}</div>
              <div className="workflow-summary-helper">预计会被提醒到的学生人数</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">逾期优先</div>
              <div className="workflow-summary-value">{preview?.summary.overdueAssignments ?? 0}</div>
              <div className="workflow-summary-helper">需要优先处理的逾期作业数量</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">最近一次发送</div>
              <div className="workflow-summary-value">{historySummary?.totalRuns ?? 0}</div>
              <div className="workflow-summary-helper">
                {historySummary?.lastRunAt ? `最近于 ${formatLoadedTime(historySummary.lastRunAt)}` : "当前班级还没有发送历史"}
              </div>
            </div>
          </div>

          <StatePanel compact tone={commandState.tone} title={commandState.title} description={commandState.description} />

          <div className="pill-list" style={{ marginTop: 12 }}>
            <span className="pill">学生提醒 {preview?.summary.studentTargets ?? 0} 条</span>
            <span className="pill">家长提醒 {preview?.summary.parentTargets ?? 0} 条</span>
            <span className="pill">截止前提醒 {preview?.summary.dueSoonAssignments ?? 0} 份</span>
            {previewTargetDelta !== null ? (
              <span className="pill">
                较上次学生触达 {previewTargetDelta > 0 ? `+${previewTargetDelta}` : previewTargetDelta}
              </span>
            ) : null}
          </div>

          <div className="meta-text" style={{ marginTop: 12 }}>
            {latestClassResult
              ? `最近一次发送覆盖学生 ${latestClassResult.studentTargets} 条、家长 ${latestClassResult.parentTargets} 条。真正的效果，还要回提交箱和成绩册看新增提交与完成率。`
              : "发送历史会告诉你曾经发了多少，但无法替代业务结果验证。第一次发送后，记得回提交箱和成绩册验收。"}
          </div>

          <div className="cta-row" style={{ marginTop: 12 }}>
            <Link className="button secondary" href="/teacher/submissions">
              去提交箱
            </Link>
            <Link className="button secondary" href="/teacher/gradebook">
              去成绩册
            </Link>
            <Link className="button ghost" href="/teacher/analysis">
              去学情分析
            </Link>
          </div>
        </Card>
      </div>

      <Card title="优先提醒队列" tag="Preview">
        <div id="teacher-notification-preview">
          {previewing && !preview ? (
            <StatePanel compact tone="loading" title="预览生成中" description="正在根据当前草稿计算提醒范围。" />
          ) : !preview ? (
            <StatePanel
              compact
              tone="empty"
              title="当前还没有提醒预览"
              description="调整规则后刷新预览，这里会直接告诉你今天先催哪一批作业。"
            />
          ) : !preview.summary.enabled ? (
            <StatePanel
              compact
              tone="info"
              title="当前规则处于关闭状态"
              description="开启提醒开关后，系统才会根据阈值筛出待发送作业。"
            />
          ) : !preview.summary.assignmentTargets ? (
            <StatePanel
              compact
              tone="empty"
              title="当前配置下没有待发送提醒"
              description="可以放宽截止前提醒天数、调整逾期窗口，或等待班级出现新的待完成作业。"
            />
          ) : (
            <div className="teacher-notification-queue-groups">
              <div className="teacher-notification-queue-group">
                <div className="task-queue-group-head">
                  <div>
                    <div className="section-title">逾期优先队列</div>
                    <div className="meta-text">先看已经逾期的作业，这批最影响今天的催交效率。</div>
                  </div>
                  <span className="chip">共 {overdueAssignments.length} 份</span>
                </div>

                {overdueAssignments.length ? (
                  <div className="notification-preview-list">
                    {overdueAssignments.map((item) => (
                      <div className="notification-preview-card overdue" key={item.assignmentId}>
                        <div className="notification-preview-header">
                          <div>
                            <div className="section-title">{item.title}</div>
                            <div className="meta-text">截止 {new Date(item.dueDate).toLocaleDateString("zh-CN")}</div>
                          </div>
                          <span className="card-tag">{getStageLabel(item.stage)}</span>
                        </div>
                        <div className="notification-preview-meta">
                          <span className="pill">学生提醒 {item.studentTargets}</span>
                          <span className="pill">家长提醒 {item.parentTargets}</span>
                        </div>
                        <div className="notification-preview-note">{getStageDescription(item.stage)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <StatePanel
                    compact
                    tone="empty"
                    title="当前没有逾期作业"
                    description="说明这轮提醒更适合用在截止前预防，而不是事后催交。"
                  />
                )}
              </div>

              <div className="teacher-notification-queue-group">
                <div className="task-queue-group-head">
                  <div>
                    <div className="section-title">即将到期队列</div>
                    <div className="meta-text">这批适合做温和提醒，把今天的临期作业拦在逾期前。</div>
                  </div>
                  <span className="chip">共 {dueSoonAssignments.length} 份</span>
                </div>

                {dueSoonAssignments.length ? (
                  <div className="notification-preview-list">
                    {dueSoonAssignments.map((item) => (
                      <div className="notification-preview-card due-soon" key={item.assignmentId}>
                        <div className="notification-preview-header">
                          <div>
                            <div className="section-title">{item.title}</div>
                            <div className="meta-text">截止 {new Date(item.dueDate).toLocaleDateString("zh-CN")}</div>
                          </div>
                          <span className="card-tag">{getStageLabel(item.stage)}</span>
                        </div>
                        <div className="notification-preview-meta">
                          <span className="pill">学生提醒 {item.studentTargets}</span>
                          <span className="pill">家长提醒 {item.parentTargets}</span>
                        </div>
                        <div className="notification-preview-note">{getStageDescription(item.stage)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <StatePanel
                    compact
                    tone="empty"
                    title="当前没有即将到期作业"
                    description="如果当前确实没有临期任务，这一块可以视为今天不需要主动提醒。"
                  />
                )}
              </div>
            </div>
          )}

          {preview ? (
            <div className="workflow-card-meta" style={{ marginTop: 12 }}>
              <span className="pill">预览生成于 {formatLoadedTime(preview.generatedAt)}</span>
              <span className="pill">当前规则 {getRuleWindowLabel(preview.rule)}</span>
            </div>
          ) : null}
        </div>
      </Card>

      <Card title="执行历史与复盘" tag="History">
        <div id="teacher-notification-history">
          <div className="workflow-card-meta">
            <span className="pill">历史记录 {historySummary?.totalRuns ?? 0} 次</span>
            <span className="pill">累计学生提醒 {historySummary?.studentTargets ?? 0} 条</span>
            <span className="pill">累计家长提醒 {historySummary?.parentTargets ?? 0} 条</span>
            <span className="pill">累计作业覆盖 {historySummary?.assignmentTargets ?? 0} 份</span>
          </div>

          <div className="meta-text" style={{ marginTop: 12 }}>
            历史记录负责回答“之前发过多少”，但它不能替代结果页。复盘时要把这里的触达规模，和提交箱、成绩册里的变化放在一起看。
          </div>

          {historyLoading && !history.length ? (
            <StatePanel compact tone="loading" title="历史加载中" description="正在同步当前班级的最近执行记录。" />
          ) : !history.length ? (
            <StatePanel
              compact
              tone="empty"
              title="当前班级还没有执行历史"
              description="执行一次“立即发送提醒”后，这里会记录本次触达范围、规则快照和作业样本。"
            />
          ) : (
            <div className="notification-history-list">
              {history.map((item) => {
                const classResult = item.classResults.find((entry) => entry.classId === classId) ?? item.classResults[0];
                if (!classResult) return null;

                return (
                  <div className="notification-history-card" key={item.id}>
                    <div className="notification-history-header">
                      <div>
                        <div className="section-title">执行于 {formatLoadedTime(item.executedAt)}</div>
                        <div className="workflow-summary-helper">
                          {classResult.className} · {SUBJECT_LABELS[classResult.subject] ?? classResult.subject} · {classResult.grade} 年级
                        </div>
                      </div>
                      {latestHistory?.id === item.id ? <span className="card-tag">最近一次</span> : <span className="pill">历史记录</span>}
                    </div>

                    <div className="notification-history-metrics">
                      <span className="pill">学生提醒 {classResult.studentTargets}</span>
                      <span className="pill">家长提醒 {classResult.parentTargets}</span>
                      <span className="pill">作业覆盖 {classResult.assignmentTargets}</span>
                      <span className="pill">即将到期 {classResult.dueSoonAssignments}</span>
                      <span className="pill">已逾期 {classResult.overdueAssignments}</span>
                    </div>

                    <div className="workflow-summary-helper" style={{ marginTop: 8 }}>
                      规则快照：{classResult.rule.enabled ? "开启" : "关闭"} · 截止前 {classResult.rule.dueDays} 天 · 逾期 {classResult.rule.overdueDays} 天 · 家长抄送{" "}
                      {classResult.rule.includeParents ? "开启" : "关闭"}
                    </div>

                    {classResult.sampleAssignments.length ? (
                      <div className="notification-history-samples">
                        {classResult.sampleAssignments.map((sample) => (
                          <div className="notification-history-sample" key={`${item.id}-${sample.assignmentId}`}>
                            <div className="section-title" style={{ fontSize: 13 }}>
                              {sample.title}
                            </div>
                            <div className="workflow-summary-helper">
                              {getStageLabel(sample.stage)} · 截止 {new Date(sample.dueDate).toLocaleDateString("zh-CN")} · 学生 {sample.studentTargets} · 家长 {sample.parentTargets}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
