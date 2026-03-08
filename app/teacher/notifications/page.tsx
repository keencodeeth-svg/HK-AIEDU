"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime, requestJson, type RequestError } from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";

type ClassItem = { id: string; name: string; subject: string; grade: string };
type RuleItem = {
  id: string;
  classId: string;
  enabled: boolean;
  dueDays: number;
  overdueDays: number;
  includeParents: boolean;
};

type PreviewAssignment = {
  assignmentId: string;
  title: string;
  dueDate: string;
  stage: "due_soon" | "overdue";
  studentTargets: number;
  parentTargets: number;
};

type PreviewData = {
  generatedAt: string;
  class: ClassItem;
  rule: RuleItem;
  summary: {
    enabled: boolean;
    assignmentTargets: number;
    dueSoonAssignments: number;
    overdueAssignments: number;
    studentTargets: number;
    parentTargets: number;
    uniqueStudents: number;
  };
  sampleAssignments: PreviewAssignment[];
};

type HistoryItem = {
  id: string;
  executedAt: string;
  totals: {
    classes: number;
    assignmentTargets: number;
    dueSoonAssignments: number;
    overdueAssignments: number;
    studentTargets: number;
    parentTargets: number;
    uniqueStudents: number;
  };
  classResults: Array<{
    classId: string;
    className: string;
    subject: string;
    grade: string;
    rule: RuleItem;
    assignmentTargets: number;
    dueSoonAssignments: number;
    overdueAssignments: number;
    studentTargets: number;
    parentTargets: number;
    uniqueStudents: number;
    sampleAssignments: PreviewAssignment[];
  }>;
};

type HistoryResponse = {
  data?: HistoryItem[];
  summary?: {
    totalRuns?: number;
    lastRunAt?: string | null;
    studentTargets?: number;
    parentTargets?: number;
    assignmentTargets?: number;
  };
};

type RuleResponse = { classes?: ClassItem[]; rules?: RuleItem[] };

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

export default function TeacherNotificationRulesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [savedRules, setSavedRules] = useState<RuleItem[]>([]);
  const [classId, setClassId] = useState("");
  const [draftRule, setDraftRule] = useState<RuleItem>({ id: "", classId: "", ...DEFAULT_RULE });
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historySummary, setHistorySummary] = useState<HistoryResponse["summary"] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      return;
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
      setPreview(payload.data ?? null);
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
      return;
    }
    if (!silent) {
      setHistoryLoading(true);
    }
    try {
      const payload = await requestJson<HistoryResponse>(`/api/teacher/notifications/history?classId=${encodeURIComponent(nextClassId)}&limit=8`);
      setHistory(payload.data ?? []);
      setHistorySummary(payload.summary ?? null);
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
      setError(null);

      try {
        const payload = await requestJson<RuleResponse>("/api/teacher/notifications/rules");
        const nextClasses = payload.classes ?? [];
        const nextRules = payload.rules ?? [];
        const nextClassId =
          classId && nextClasses.some((item) => item.id === classId) ? classId : nextClasses[0]?.id ?? "";
        const nextDraft = buildDraftRule(nextClassId, nextRules);

        setAuthRequired(false);
        setClasses(nextClasses);
        setSavedRules(nextRules);
        setClassId(nextClassId);
        setDraftRule(nextDraft);
        setLastLoadedAt(new Date().toISOString());

        await Promise.all([loadPreview(nextDraft, true), loadHistory(nextClassId, true)]);
      } catch (nextError) {
        const requestError = nextError as RequestError;
        if (requestError.status === 401) {
          setAuthRequired(true);
          setClasses([]);
          setSavedRules([]);
          setPreview(null);
          setHistory([]);
          setHistorySummary(null);
        } else {
          setError(requestError.message || "加载失败");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [classId, loadHistory, loadPreview]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selectedClass = classes.find((item) => item.id === classId) ?? null;
  const savedRuleForClass = useMemo(() => buildDraftRule(classId, savedRules), [classId, savedRules]);
  const hasUnsavedChanges = classId ? !isSameRule(draftRule, savedRuleForClass) : false;
  const configuredRuleCount = savedRules.length;
  const enabledRuleCount = savedRules.filter((item) => item.enabled).length;
  const latestHistory = history[0] ?? null;

  function updateDraft(patch: Partial<RuleItem>) {
    setDraftRule((prev) => ({
      ...prev,
      ...patch,
      classId
    }));
  }

  async function handleClassChange(nextClassId: string) {
    setClassId(nextClassId);
    setMessage(null);
    setError(null);
    const nextDraft = buildDraftRule(nextClassId, savedRules);
    setDraftRule(nextDraft);
    await Promise.all([loadPreview(nextDraft, true), loadHistory(nextClassId, true)]);
  }

  async function handleSave() {
    if (!classId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
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
      setMessage("通知规则已保存，后续运行将默认使用该配置。");
      await loadPreview(savedRule ?? draftRule, true);
    } catch (nextError) {
      const requestError = nextError as RequestError;
      setError(requestError.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    if (!classId) return;
    setMessage(null);
    setError(null);
    try {
      await loadPreview(draftRule);
    } catch (nextError) {
      const requestError = nextError as RequestError;
      setError(requestError.message || "预览失败");
    }
  }

  async function handleRun() {
    if (!classId) return;
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      const payload = await requestJson<{ data?: { students?: number; parents?: number; assignments?: number } }>(
        "/api/teacher/notifications/run",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classId,
            enabled: draftRule.enabled,
            dueDays: draftRule.dueDays,
            overdueDays: draftRule.overdueDays,
            includeParents: draftRule.includeParents
          })
        }
      );
      setMessage(
        `已发送提醒：学生 ${payload.data?.students ?? 0} 条，家长 ${payload.data?.parents ?? 0} 条，覆盖作业 ${payload.data?.assignments ?? 0} 份。`
      );
      await Promise.all([loadPreview(draftRule, true), loadHistory(classId, true)]);
    } catch (nextError) {
      const requestError = nextError as RequestError;
      setError(requestError.message || "发送失败");
    } finally {
      setRunning(false);
    }
  }

  function handleReset() {
    const nextDraft = buildDraftRule(classId, savedRules);
    setDraftRule(nextDraft);
    setMessage(null);
    setError(null);
    void loadPreview(nextDraft, true);
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

  if (error && !classes.length) {
    return (
      <StatePanel
        tone="error"
        title="通知规则暂时不可用"
        description={error}
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
          <div className="section-sub">设置截止前/逾期提醒、家长抄送，并通过预览和执行历史形成完整闭环。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">教师端</span>
          <span className="chip">已配置规则 {configuredRuleCount}</span>
          <span className="chip">启用中 {enabledRuleCount}</span>
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

      {error ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${error}`}
          action={
            <button className="button secondary" type="button" onClick={() => void load("refresh")}>
              再试一次
            </button>
          }
        />
      ) : null}

      {hasUnsavedChanges ? (
        <StatePanel
          compact
          tone="info"
          title="当前有未保存修改"
          description="发送预览和立即发送会基于当前表单配置执行；保存规则后可将该配置作为班级默认策略。"
        />
      ) : null}

      <Card title="规则概览" tag="概览">
        <div className="grid grid-2">
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">班级数</div>
            <div className="workflow-summary-value">{classes.length}</div>
            <div className="workflow-summary-helper">当前教师可管理的班级范围</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">启用规则</div>
            <div className="workflow-summary-value">{enabledRuleCount}</div>
            <div className="workflow-summary-helper">已保存且当前开启的班级提醒规则</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">预估学生提醒</div>
            <div className="workflow-summary-value">{preview?.summary.studentTargets ?? 0}</div>
            <div className="workflow-summary-helper">当前表单配置预计发送给学生的提醒条数</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">最近执行</div>
            <div className="workflow-summary-value">{historySummary?.totalRuns ?? 0}</div>
            <div className="workflow-summary-helper">
              {historySummary?.lastRunAt ? `最近于 ${formatLoadedTime(historySummary.lastRunAt)}` : "当前班级还没有执行历史"}
            </div>
          </div>
        </div>
      </Card>

      <Card title="规则配置" tag="规则">
        <div className="feature-card">
          <EduIcon name="rocket" />
          <p>先调整阈值，再点“刷新预览”核对触达范围；确认后可保存为默认规则，或直接按当前表单配置执行一次提醒。</p>
        </div>
        <div className="grid grid-2 teacher-notification-rule-form" style={{ alignItems: "end", marginTop: 12 }}>
          <label>
            <div className="section-title">选择班级</div>
            <select className="select-control" value={classId} onChange={(event) => void handleClassChange(event.target.value)} style={{ width: "100%" }}>
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
              className="select-control"
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
            抄送家长
          </label>
          <div className="workflow-card-meta">
            {selectedClass ? (
              <span className="pill">
                当前班级：{selectedClass.name} · {SUBJECT_LABELS[selectedClass.subject] ?? selectedClass.subject} · {selectedClass.grade} 年级
              </span>
            ) : null}
            <span className="pill">当前配置 {draftRule.enabled ? "已开启" : "已关闭"}</span>
            <span className="pill">抄送家长 {draftRule.includeParents ? "开启" : "关闭"}</span>
          </div>
        </div>
        {message ? <div className="status-note success">{message}</div> : null}
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button ghost" type="button" onClick={handleReset} disabled={!hasUnsavedChanges || saving || running || previewing}>
            重置修改
          </button>
          <button className="button secondary" type="button" onClick={handlePreview} disabled={previewing || saving || running}>
            {previewing ? "预览中..." : "刷新预览"}
          </button>
          <button className="button secondary" type="button" onClick={handleSave} disabled={saving || running || previewing}>
            {saving ? "保存中..." : "保存规则"}
          </button>
          <button className="button primary" type="button" onClick={handleRun} disabled={running || saving || previewing || !draftRule.enabled}>
            {running ? "发送中..." : "立即发送提醒"}
          </button>
        </div>
      </Card>

      <Card title="发送预览" tag="Preview">
        {preview ? (
          <>
            <div className="grid grid-2">
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">匹配作业</div>
                <div className="workflow-summary-value">{preview.summary.assignmentTargets}</div>
                <div className="workflow-summary-helper">即将触发提醒的作业数</div>
              </div>
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">覆盖学生</div>
                <div className="workflow-summary-value">{preview.summary.uniqueStudents}</div>
                <div className="workflow-summary-helper">预计会收到提醒的学生人数</div>
              </div>
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">截止前提醒</div>
                <div className="workflow-summary-value">{preview.summary.dueSoonAssignments}</div>
                <div className="workflow-summary-helper">处于“即将到期”窗口内的作业</div>
              </div>
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">逾期提醒</div>
                <div className="workflow-summary-value">{preview.summary.overdueAssignments}</div>
                <div className="workflow-summary-helper">处于逾期提醒窗口内的作业</div>
              </div>
            </div>

            <div className="workflow-card-meta" style={{ marginTop: 12 }}>
              <span className="pill">学生提醒 {preview.summary.studentTargets} 条</span>
              <span className="pill">家长提醒 {preview.summary.parentTargets} 条</span>
              <span className="pill">预览生成于 {formatLoadedTime(preview.generatedAt)}</span>
            </div>

            {preview.summary.enabled ? null : (
              <StatePanel
                compact
                tone="info"
                title="当前规则处于关闭状态"
                description="开启提醒开关后，才会根据阈值匹配到待发送作业。"
              />
            )}

            {!preview.summary.enabled || !preview.sampleAssignments.length ? (
              <StatePanel
                compact
                tone="empty"
                title="当前配置下暂无待发送提醒"
                description="可以放宽截止前提醒天数、调整逾期窗口，或等待班级出现新的待完成作业。"
              />
            ) : (
              <div className="notification-preview-list">
                {preview.sampleAssignments.map((item) => (
                  <div className="notification-preview-card" key={item.assignmentId}>
                    <div className="notification-preview-header">
                      <div className="section-title">{item.title}</div>
                      <span className="card-tag">{getStageLabel(item.stage)}</span>
                    </div>
                    <div className="notification-preview-meta">
                      <span className="pill">截止 {new Date(item.dueDate).toLocaleDateString("zh-CN")}</span>
                      <span className="pill">学生提醒 {item.studentTargets}</span>
                      <span className="pill">家长提醒 {item.parentTargets}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <StatePanel
            compact
            tone="loading"
            title="预览准备中"
            description="选择班级并刷新预览后，这里会显示预计提醒范围。"
          />
        )}
      </Card>

      <Card title="执行历史" tag="History">
        <div className="workflow-card-meta">
          <span className="pill">历史记录 {historySummary?.totalRuns ?? 0} 次</span>
          <span className="pill">累计学生提醒 {historySummary?.studentTargets ?? 0} 条</span>
          <span className="pill">累计家长提醒 {historySummary?.parentTargets ?? 0} 条</span>
          <span className="pill">累计作业覆盖 {historySummary?.assignmentTargets ?? 0} 份</span>
        </div>

        {historyLoading ? (
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
                    规则快照：{classResult.rule.enabled ? "开启" : "关闭"} · 截止前 {classResult.rule.dueDays} 天 · 逾期 {classResult.rule.overdueDays} 天 · 家长抄送 {classResult.rule.includeParents ? "开启" : "关闭"}
                  </div>
                  {classResult.sampleAssignments.length ? (
                    <div className="notification-history-samples">
                      {classResult.sampleAssignments.map((sample) => (
                        <div className="notification-history-sample" key={`${item.id}-${sample.assignmentId}`}>
                          <div className="section-title" style={{ fontSize: 13 }}>{sample.title}</div>
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
      </Card>
    </div>
  );
}
