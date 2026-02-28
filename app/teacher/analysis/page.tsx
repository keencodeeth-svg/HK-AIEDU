"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import { SUBJECT_LABELS } from "@/lib/constants";

type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

type HeatItem = {
  id: string;
  title: string;
  chapter: string;
  unit: string;
  subject: string;
  grade: string;
  ratio: number;
  total: number;
};

type StudentItem = {
  id: string;
  name: string;
  email: string;
  grade?: string;
};

type FavoriteItem = {
  id: string;
  tags: string[];
  question?: {
    stem: string;
    knowledgePointTitle: string;
    grade: string;
  } | null;
};

type AlertItem = {
  id: string;
  type: "student-risk" | "knowledge-risk";
  classId: string;
  className: string;
  subject: string;
  grade: string;
  riskScore: number;
  riskReason: string;
  recommendedAction: string;
  status: "active" | "acknowledged";
  lastActionType?: "assign_review" | "notify_student" | "auto_chain" | "mark_done" | null;
  lastActionAt?: string | null;
};

type AlertSummary = {
  classRiskScore: number;
  totalAlerts: number;
  activeAlerts: number;
  acknowledgedAlerts: number;
  highRiskAlerts: number;
};

type AlertImpactWindow = {
  hours: number;
  ready: boolean;
  dueAt: string | null;
  remainingHours: number;
  riskDelta: number | null;
  riskDeltaRate: number | null;
  improved: boolean | null;
};

type AlertImpactData = {
  alertId: string;
  impact: {
    tracked: boolean;
    actionId: string | null;
    trackedAt: string | null;
    elapsedHours: number;
    deltas: {
      riskScore: number | null;
      metricDeltas: Record<string, number>;
    };
    windows: {
      h24: AlertImpactWindow;
      h72: AlertImpactWindow;
    };
  };
};

export default function TeacherAnalysisPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [heatmap, setHeatmap] = useState<HeatItem[]>([]);
  const [report, setReport] = useState<any>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [studentId, setStudentId] = useState("");
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState<string | null>(null);
  const [actingAlertKey, setActingAlertKey] = useState<string | null>(null);
  const [alertActionMessage, setAlertActionMessage] = useState<string | null>(null);
  const [impactByAlertId, setImpactByAlertId] = useState<Record<string, AlertImpactData>>({});
  const [loadingImpactId, setLoadingImpactId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((res) => res.json())
      .then((data) => setClasses(data.data ?? []));
  }, []);

  useEffect(() => {
    if (!classId && classes.length) {
      setClassId(classes[0].id);
    }
  }, [classes, classId]);

  async function loadHeatmap(targetId: string) {
    setHeatmapLoading(true);
    const res = await fetch(`/api/teacher/insights/heatmap?classId=${targetId}`);
    const data = await res.json();
    setHeatmap(data?.data?.items ?? []);
    setHeatmapLoading(false);
  }

  async function loadAlerts(targetId: string) {
    const res = await fetch(`/api/teacher/alerts?classId=${targetId}&includeAcknowledged=true`);
    const data = await res.json();
    setAlerts(data?.data?.alerts ?? []);
    setAlertSummary(data?.data?.summary ?? null);
  }

  useEffect(() => {
    if (classId) {
      loadHeatmap(classId);
      loadAlerts(classId);
    }
  }, [classId]);

  async function acknowledgeAlert(alertId: string) {
    setAcknowledgingAlertId(alertId);
    const res = await fetch(`/api/teacher/alerts/${alertId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionType: "mark_done" })
    });
    if (res.ok && classId) {
      await loadAlerts(classId);
    }
    setAcknowledgingAlertId(null);
  }

  async function runAlertAction(alertId: string, actionType: "assign_review" | "notify_student" | "auto_chain") {
    const actionKey = `${alertId}:${actionType}`;
    setActingAlertKey(actionKey);
    setAlertActionMessage(null);
    const res = await fetch(`/api/teacher/alerts/${alertId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionType })
    });
    const data = await res.json();
    if (!res.ok) {
      setAlertActionMessage(data?.error ?? "执行失败");
      setActingAlertKey(null);
      return;
    }
    setAlertActionMessage(data?.data?.result?.message ?? "动作已执行");
    if (classId) {
      await loadAlerts(classId);
    }
    await loadAlertImpact(alertId, true);
    setActingAlertKey(null);
  }

  async function loadAlertImpact(alertId: string, force = false) {
    if (!force && impactByAlertId[alertId]) return;
    setLoadingImpactId(alertId);
    const res = await fetch(`/api/teacher/alerts/${alertId}/impact`);
    const data = await res.json();
    if (res.ok && data?.data) {
      setImpactByAlertId((prev) => ({ ...prev, [alertId]: data.data }));
    }
    setLoadingImpactId(null);
  }

  useEffect(() => {
    if (!classId) return;
    fetch(`/api/teacher/classes/${classId}/students`)
      .then((res) => res.json())
      .then((data) => {
        const list = data.data ?? [];
        setStudents(list);
        if (list.length) {
          setStudentId(list[0].id);
        } else {
          setStudentId("");
        }
      });
  }, [classId]);

  useEffect(() => {
    if (!studentId) {
      setFavorites([]);
      return;
    }
    fetch(`/api/teacher/favorites?studentId=${studentId}`)
      .then((res) => res.json())
      .then((data) => setFavorites(data.data ?? []));
  }, [studentId]);

  async function generateReport() {
    if (!classId) return;
    setReportLoading(true);
    const res = await fetch("/api/teacher/insights/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId })
    });
    const data = await res.json();
    setReport(data?.data ?? null);
    setReportLoading(false);
  }

  const sortedHeatmap = useMemo(() => heatmap.slice(0, 40), [heatmap]);
  const showHeatmapSkeleton = heatmapLoading && sortedHeatmap.length === 0;
  const showReportSkeleton = reportLoading && !report;

  function ratioColor(ratio: number) {
    const hue = Math.round((ratio / 100) * 120);
    return `hsl(${hue}, 70%, 35%)`;
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>班级学情分析</h2>
          <div className="section-sub">掌握热力图 + 学情报告。</div>
        </div>
        <span className="chip">数据面板</span>
      </div>

      <Card title="班级学情分析" tag="筛选">
        <div className="grid grid-2">
          <label>
            <div className="section-title">选择班级</div>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              style={{ width: "100%" }}
            >
              {!classes.length ? <option value="">暂无班级</option> : null}
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                </option>
              ))}
            </select>
          </label>
          <div className="feature-card" style={{ alignSelf: "end" }}>
            <div className="section-title">说明</div>
            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>颜色越偏红表示掌握度越低，可优先安排讲评与补救。</div>
          </div>
        </div>
        {!classes.length ? (
          <div className="empty-state">
            <p className="empty-state-title">暂无班级数据</p>
            <p>请先在教师端创建班级后再查看分析面板。</p>
          </div>
        ) : null}
      </Card>

      <Card title="教师预警看板" tag="风险">
        {alertActionMessage ? <div className="status-note info">{alertActionMessage}</div> : null}
        <div className="grid grid-3">
          <div className="card">
            <div className="section-title">班级风险分</div>
            <div className="kpi-value">{alertSummary?.classRiskScore ?? 0}</div>
          </div>
          <div className="card">
            <div className="section-title">活跃预警</div>
            <div className="kpi-value">{alertSummary?.activeAlerts ?? 0}</div>
          </div>
          <div className="card">
            <div className="section-title">高风险预警</div>
            <div className="kpi-value">{alertSummary?.highRiskAlerts ?? 0}</div>
          </div>
        </div>
        <div className="grid" style={{ gap: 10, marginTop: 12 }}>
          {alerts.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">暂无预警</p>
              <p>当前班级暂无风险告警。</p>
            </div>
          ) : null}
          {alerts.slice(0, 12).map((item) => (
            <div className="card" key={item.id}>
              <div className="section-title">
                {item.type === "student-risk" ? "学生风险" : "知识点风险"} · 风险分 {item.riskScore}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                {item.className} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
              </div>
              <p>{item.riskReason}</p>
              <p style={{ color: "var(--ink-1)" }}>建议动作：{item.recommendedAction}</p>
              {item.lastActionType ? (
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  最近动作：{item.lastActionType} · {item.lastActionAt ? new Date(item.lastActionAt).toLocaleString("zh-CN") : "-"}
                </div>
              ) : null}
              <div className="cta-row">
                <button
                  className="button primary"
                  onClick={() => runAlertAction(item.id, "auto_chain")}
                  disabled={actingAlertKey === `${item.id}:auto_chain`}
                >
                  {actingAlertKey === `${item.id}:auto_chain` ? "执行中..." : "一键闭环执行"}
                </button>
                <button
                  className="button ghost"
                  onClick={() => runAlertAction(item.id, "assign_review")}
                  disabled={actingAlertKey === `${item.id}:assign_review`}
                >
                  {actingAlertKey === `${item.id}:assign_review` ? "布置中..." : "一键布置修复任务"}
                </button>
                <button
                  className="button ghost"
                  onClick={() => runAlertAction(item.id, "notify_student")}
                  disabled={actingAlertKey === `${item.id}:notify_student`}
                >
                  {actingAlertKey === `${item.id}:notify_student`
                    ? "提醒中..."
                    : item.type === "student-risk"
                      ? "提醒学生"
                      : "提醒全班"}
                </button>
                {item.status === "acknowledged" ? (
                  <span className="badge">已确认</span>
                ) : (
                  <button
                    className="button secondary"
                    onClick={() => acknowledgeAlert(item.id)}
                    disabled={acknowledgingAlertId === item.id}
                  >
                    {acknowledgingAlertId === item.id ? "确认中..." : "确认预警"}
                  </button>
                )}
                <button
                  className="button ghost"
                  onClick={() => loadAlertImpact(item.id)}
                  disabled={loadingImpactId === item.id}
                >
                  {loadingImpactId === item.id ? "加载中..." : "查看24h/72h效果"}
                </button>
              </div>
              {impactByAlertId[item.id] ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    border: "1px dashed var(--stroke)",
                    background: "rgba(255,255,255,0.5)"
                  }}
                >
                  {impactByAlertId[item.id].impact.tracked ? (
                    <div style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--ink-1)" }}>
                      <div>
                        基线时间：{" "}
                        {impactByAlertId[item.id].impact.trackedAt
                          ? new Date(impactByAlertId[item.id].impact.trackedAt as string).toLocaleString("zh-CN")
                          : "-"}
                        {" · "}
                        已追踪 {impactByAlertId[item.id].impact.elapsedHours} 小时
                      </div>
                      <div>
                        风险分变化：
                        <strong style={{ marginLeft: 4 }}>
                          {impactByAlertId[item.id].impact.deltas.riskScore ?? 0}
                        </strong>
                        {" · "}
                        {(impactByAlertId[item.id].impact.deltas.riskScore ?? 0) < 0
                          ? "风险下降"
                          : "风险未下降"}
                      </div>
                      <div>
                        24h 窗口：{impactByAlertId[item.id].impact.windows.h24.ready ? "已到期" : "观察中"} ·{" "}
                        {impactByAlertId[item.id].impact.windows.h24.ready
                          ? `Δ${impactByAlertId[item.id].impact.windows.h24.riskDelta ?? 0}`
                          : `剩余 ${impactByAlertId[item.id].impact.windows.h24.remainingHours}h`}
                      </div>
                      <div>
                        72h 窗口：{impactByAlertId[item.id].impact.windows.h72.ready ? "已到期" : "观察中"} ·{" "}
                        {impactByAlertId[item.id].impact.windows.h72.ready
                          ? `Δ${impactByAlertId[item.id].impact.windows.h72.riskDelta ?? 0}`
                          : `剩余 ${impactByAlertId[item.id].impact.windows.h72.remainingHours}h`}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: 10 }}>
                      <p className="empty-state-title">暂无追踪基线</p>
                      <p>请先执行“一键布置修复任务”或“提醒学生”。</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card title="知识点掌握热力图" tag="热力图">
        {showHeatmapSkeleton ? (
          <div className="skeleton-grid grid-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="skeleton-card" key={`heat-skeleton-${index}`}>
                <div className="skeleton-line lg w-80" />
                <div className="skeleton-line w-60" />
                <div className="skeleton-line w-100" />
              </div>
            ))}
          </div>
        ) : sortedHeatmap.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">暂无练习数据</p>
            <p>当前班级还没有可用于热力图的练习记录。</p>
          </div>
        ) : (
          <div className="grid grid-3" style={{ gap: 12 }}>
            {sortedHeatmap.map((item) => (
              <div
                className="card"
                key={item.id}
                style={{
                  borderColor: ratioColor(item.ratio),
                  boxShadow: "none"
                }}
              >
                <div className="section-title">{item.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  {item.unit ? `${item.unit} / ` : ""}
                  {item.chapter}
                </div>
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  正确率：<span style={{ color: ratioColor(item.ratio) }}>{item.ratio}%</span> · 练习 {item.total} 次
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="学情报告 + 重点提醒" tag="报告">
        <div className="cta-row">
          <button className="button primary" onClick={generateReport} disabled={reportLoading || !classId}>
            {reportLoading ? "生成中..." : "生成学情报告"}
          </button>
        </div>
        {showReportSkeleton ? (
          <div className="skeleton-grid" style={{ marginTop: 12 }}>
            <div className="skeleton-card">
              <div className="skeleton-line lg w-40" />
              <div className="skeleton-line w-100" />
              <div className="skeleton-line w-100" />
              <div className="skeleton-line w-80" />
            </div>
          </div>
        ) : report ? (
          <div className="grid" style={{ gap: 10, marginTop: 12 }}>
            <div className="card">
              <div className="section-title">报告摘要</div>
              <p>{report.report?.report ?? "暂无报告内容。"}</p>
            </div>
            {report.report?.highlights?.length ? (
              <div className="card">
                <div className="section-title">亮点</div>
                <ul style={{ margin: "6px 0 0 16px" }}>
                  {report.report.highlights.map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {report.report?.reminders?.length ? (
              <div className="card">
                <div className="section-title">重点提醒</div>
                <ul style={{ margin: "6px 0 0 16px" }}>
                  {report.report.reminders.map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="empty-state" style={{ marginTop: 12 }}>
            <p className="empty-state-title">尚未生成报告</p>
            <p>点击上方按钮生成当前班级的学情摘要与重点提醒。</p>
          </div>
        )}
      </Card>

      <Card title="学生收藏题目" tag="收藏">
        <div className="grid grid-2">
          <label>
            <div className="section-title">选择学生</div>
            <select
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              style={{ width: "100%" }}
            >
              {!students.length ? <option value="">暂无学生</option> : null}
              {students.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.grade ?? "-"} 年级
                </option>
              ))}
            </select>
          </label>
          <div className="card" style={{ alignSelf: "end" }}>
            <div className="section-title">收藏数量</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{favorites.length}</div>
          </div>
        </div>
        <div className="grid" style={{ gap: 10, marginTop: 12 }}>
          {favorites.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">暂无收藏记录</p>
              <p>该学生还没有收藏题目。</p>
            </div>
          ) : null}
          {favorites.slice(0, 6).map((item) => (
            <div className="card" key={item.id}>
              <div className="section-title">{item.question?.stem ?? "题目"}</div>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                {item.question?.knowledgePointTitle ?? "知识点"} · {item.question?.grade ?? "-"} 年级
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 6 }}>
                标签：{item.tags?.length ? item.tags.join("、") : "未设置"}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
