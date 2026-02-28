"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { ASSIGNMENT_TYPE_LABELS, GRADE_OPTIONS, SUBJECT_LABELS, SUBJECT_OPTIONS } from "@/lib/constants";

type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  studentCount: number;
  assignmentCount: number;
  joinCode?: string;
  joinMode?: "approval" | "auto";
};

type AssignmentItem = {
  id: string;
  classId: string;
  className: string;
  classSubject: string;
  classGrade: string;
  moduleTitle?: string;
  title: string;
  dueDate: string;
  total: number;
  completed: number;
  submissionType?: "quiz" | "upload" | "essay";
};

type KnowledgePoint = {
  id: string;
  subject: string;
  grade: string;
  title: string;
  chapter: string;
  unit?: string;
};

type AlertImpactData = {
  alertId: string;
  impact: {
    tracked: boolean;
    trackedAt: string | null;
    elapsedHours: number;
    deltas: {
      riskScore: number | null;
    };
    windows: {
      h24: { ready: boolean; remainingHours: number; riskDelta: number | null };
      h72: { ready: boolean; remainingHours: number; riskDelta: number | null };
    };
  };
};

export default function TeacherPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState<string | null>(null);
  const [actingAlertKey, setActingAlertKey] = useState<string | null>(null);
  const [impactByAlertId, setImpactByAlertId] = useState<Record<string, AlertImpactData>>({});
  const [loadingImpactId, setLoadingImpactId] = useState<string | null>(null);

  const [classForm, setClassForm] = useState({ name: "", subject: "math", grade: "4" });
  const [studentForm, setStudentForm] = useState({ classId: "", email: "" });
  const [assignmentForm, setAssignmentForm] = useState({
    classId: "",
    moduleId: "",
    title: "",
    description: "",
    dueDate: "",
    questionCount: 10,
    knowledgePointId: "",
    mode: "bank",
    difficulty: "medium",
    questionType: "choice",
    submissionType: "quiz",
    maxUploads: 3,
    gradingFocus: ""
  });

  const filteredPoints = useMemo(() => {
    const klass = classes.find((item) => item.id === assignmentForm.classId);
    if (!klass) return [];
    return knowledgePoints.filter((kp) => kp.subject === klass.subject && kp.grade === klass.grade);
  }, [assignmentForm.classId, classes, knowledgePoints]);

  async function loadAll() {
    setUnauthorized(false);
    setLoading(true);
    setError(null);
    setMessage(null);
    const classRes = await fetch("/api/teacher/classes");
    if (classRes.status === 401) {
      setUnauthorized(true);
      setLoading(false);
      return;
    }
    const classData = await classRes.json();
    setClasses(classData.data ?? []);

    const assignmentRes = await fetch("/api/teacher/assignments");
    const assignmentData = await assignmentRes.json();
    setAssignments(assignmentData.data ?? []);
    const insightRes = await fetch("/api/teacher/insights");
    const insightData = await insightRes.json();
    if (insightRes.ok) {
      setInsights(insightData);
    }
    const joinRes = await fetch("/api/teacher/join-requests");
    const joinData = await joinRes.json();
    if (joinRes.ok) {
      setJoinRequests(joinData.data ?? []);
    }
    setLoading(false);
  }

  async function loadKnowledgePoints() {
    const res = await fetch("/api/knowledge-points");
    const data = await res.json();
    setKnowledgePoints(data.data ?? []);
  }

  useEffect(() => {
    loadAll();
    loadKnowledgePoints();
  }, []);

  useEffect(() => {
    if (!studentForm.classId && classes.length) {
      setStudentForm((prev) => ({ ...prev, classId: classes[0].id }));
    }
    if (!assignmentForm.classId && classes.length) {
      const defaultDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setAssignmentForm((prev) => ({ ...prev, classId: classes[0].id, dueDate: prev.dueDate || defaultDue }));
    }
  }, [classes, studentForm.classId, assignmentForm.classId, assignmentForm.dueDate]);

  useEffect(() => {
    if (!assignmentForm.classId) return;
    setModules([]);
    setAssignmentForm((prev) => ({ ...prev, moduleId: "" }));
    fetch(`/api/teacher/modules?classId=${assignmentForm.classId}`)
      .then((res) => res.json())
      .then((data) => {
        const list = data.data ?? [];
        setModules(list);
        if (list.length) {
          setAssignmentForm((prev) => ({ ...prev, moduleId: list[0].id }));
        }
      });
  }, [assignmentForm.classId]);

  async function handleCreateClass(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/teacher/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(classForm)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "创建失败");
      setLoading(false);
      return;
    }
    setMessage("班级创建成功。");
    setClassForm({ ...classForm, name: "" });
    await loadAll();
    setLoading(false);
  }

  async function handleAddStudent(event: React.FormEvent) {
    event.preventDefault();
    if (!studentForm.classId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/teacher/classes/${studentForm.classId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: studentForm.email })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "添加失败");
      setLoading(false);
      return;
    }
    setMessage(data.added ? "已加入班级。" : "学生已在班级中。");
    setStudentForm((prev) => ({ ...prev, email: "" }));
    await loadAll();
    setLoading(false);
  }

  async function handleCreateAssignment(event: React.FormEvent) {
    event.preventDefault();
    if (!assignmentForm.classId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    setAssignmentError(null);
    setAssignmentMessage(null);
    const res = await fetch("/api/teacher/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: assignmentForm.classId,
        moduleId: assignmentForm.moduleId || undefined,
        title: assignmentForm.title,
        description: assignmentForm.description,
        dueDate: assignmentForm.dueDate,
        questionCount: assignmentForm.questionCount,
        knowledgePointId: assignmentForm.knowledgePointId || undefined,
        mode: assignmentForm.mode,
        difficulty: assignmentForm.difficulty,
        questionType: assignmentForm.questionType,
        submissionType: assignmentForm.submissionType,
        maxUploads: assignmentForm.maxUploads,
        gradingFocus: assignmentForm.gradingFocus
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "发布失败");
      setAssignmentError(data?.error ?? "发布失败");
      setLoading(false);
      return;
    }
    const nextMessage = data?.message ?? "作业发布成功。";
    setMessage(nextMessage);
    setAssignmentMessage(nextMessage);
    setAssignmentForm((prev) => ({ ...prev, title: "", description: "", gradingFocus: "" }));
    await loadAll();
    setLoading(false);
  }

  async function acknowledgeAlert(alertId: string) {
    setAcknowledgingAlertId(alertId);
    const res = await fetch(`/api/teacher/alerts/${alertId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionType: "mark_done" })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "确认预警失败");
      setAcknowledgingAlertId(null);
      return;
    }
    await loadAll();
    setAcknowledgingAlertId(null);
  }

  async function runAlertAction(alertId: string, actionType: "assign_review" | "notify_student" | "auto_chain") {
    const actionKey = `${alertId}:${actionType}`;
    setActingAlertKey(actionKey);
    setError(null);
    const res = await fetch(`/api/teacher/alerts/${alertId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionType })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "执行预警动作失败");
      setActingAlertKey(null);
      return;
    }
    const actionMessage = data?.data?.result?.message ?? "预警动作已执行";
    await loadAll();
    await loadAlertImpact(alertId, true);
    setMessage(actionMessage);
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

  async function handleUpdateJoinMode(classId: string, joinMode: "approval" | "auto") {
    await fetch(`/api/teacher/classes/${classId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinMode })
    });
    loadAll();
  }

  async function handleRegenerateCode(classId: string) {
    await fetch(`/api/teacher/classes/${classId}/join-code`, { method: "POST" });
    loadAll();
  }

  async function handleApprove(requestId: string) {
    await fetch(`/api/teacher/join-requests/${requestId}/approve`, { method: "POST" });
    loadAll();
  }

  async function handleReject(requestId: string) {
    await fetch(`/api/teacher/join-requests/${requestId}/reject`, { method: "POST" });
    loadAll();
  }

  if (unauthorized) {
    return <Card title="教师端">请先使用教师账号登录。</Card>;
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>教师工作台</h2>
          <div className="section-sub">班级管理、作业发布与 AI 教学工具。</div>
        </div>
        <span className="chip">教学进度跟踪</span>
      </div>

      <Card title="教师概览" tag="数据">
        <div className="grid grid-3">
          <div className="card">
            <div className="section-title">班级数</div>
            <p>{classes.length}</p>
          </div>
          <div className="card">
            <div className="section-title">作业数</div>
            <p>{assignments.length}</p>
          </div>
          <div className="card">
            <div className="section-title">待完成作业</div>
            <p>{assignments.filter((item) => item.completed < item.total).length}</p>
          </div>
        </div>
        {message ? <div style={{ marginTop: 12, color: "#1a7f37", fontSize: 13 }}>{message}</div> : null}
        {error ? <div style={{ marginTop: 12, color: "#b42318", fontSize: 13 }}>{error}</div> : null}
      </Card>

      <Card title="在线考试模块" tag="考试">
        <div className="feature-card">
          <EduIcon name="pencil" />
          <p>发布独立考试，追踪班级提交进度与成绩。</p>
        </div>
        <div className="cta-row" style={{ marginTop: 12 }}>
          <Link className="button secondary" href="/teacher/exams">
            进入在线考试
          </Link>
          <Link className="button ghost" href="/teacher/exams/create">
            新建考试
          </Link>
        </div>
      </Card>

      <Card title="作业统计看板" tag="分析">
        <div className="grid grid-3">
          <div className="card">
            <div className="section-title">完成率</div>
            <p>{insights?.summary?.completionRate ?? 0}%</p>
          </div>
          <div className="card">
            <div className="section-title">正确率</div>
            <p>{insights?.summary?.accuracy ?? 0}%</p>
          </div>
          <div className="card">
            <div className="section-title">参与学生</div>
            <p>{insights?.summary?.students ?? 0} 人</p>
          </div>
          <div className="card">
            <div className="section-title">班级风险分</div>
            <p>{insights?.summary?.classRiskScore ?? 0}</p>
          </div>
          <div className="card">
            <div className="section-title">活跃预警</div>
            <p>{insights?.summary?.activeAlerts ?? 0}</p>
          </div>
          <div className="card">
            <div className="section-title">高风险预警</div>
            <p>{insights?.summary?.highRiskAlerts ?? 0}</p>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="section-title">薄弱知识点</div>
          {insights?.weakPoints?.length ? (
            <div className="grid" style={{ gap: 8 }}>
              {insights.weakPoints.map((item: any) => (
                <div className="card" key={item.id}>
                  <div className="section-title">{item.title}</div>
                  <p>
                    正确率 {item.ratio}% · 练习 {item.total} 次
                  </p>
                  <p>
                    {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p>暂无薄弱点数据。</p>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="section-title">教师预警</div>
          {insights?.alerts?.length ? (
            <div className="grid" style={{ gap: 8 }}>
              {insights.alerts.map((item: any) => (
                <div className="card" key={item.id}>
                  <div className="section-title">
                    {item.type === "student-risk" ? "学生风险" : "知识点风险"} · 风险分 {item.riskScore}
                  </div>
                  <p>
                    {item.className} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                  </p>
                  <p>{item.riskReason}</p>
                  <p style={{ color: "var(--ink-1)" }}>建议动作：{item.recommendedAction}</p>
                  {item.lastActionType ? (
                    <p style={{ color: "var(--ink-1)", fontSize: 12 }}>
                      最近动作：{item.lastActionType} ·{" "}
                      {item.lastActionAt ? new Date(item.lastActionAt).toLocaleString("zh-CN") : "-"}
                    </p>
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
                            风险分变化：{impactByAlertId[item.id].impact.deltas.riskScore ?? 0}
                            {" · "}
                            {(impactByAlertId[item.id].impact.deltas.riskScore ?? 0) < 0
                              ? "风险下降"
                              : "风险未下降"}
                          </div>
                          <div>
                            24h：{impactByAlertId[item.id].impact.windows.h24.ready ? "已到期" : "观察中"} ·{" "}
                            {impactByAlertId[item.id].impact.windows.h24.ready
                              ? `Δ${impactByAlertId[item.id].impact.windows.h24.riskDelta ?? 0}`
                              : `剩余 ${impactByAlertId[item.id].impact.windows.h24.remainingHours}h`}
                          </div>
                          <div>
                            72h：{impactByAlertId[item.id].impact.windows.h72.ready ? "已到期" : "观察中"} ·{" "}
                            {impactByAlertId[item.id].impact.windows.h72.ready
                              ? `Δ${impactByAlertId[item.id].impact.windows.h72.riskDelta ?? 0}`
                              : `剩余 ${impactByAlertId[item.id].impact.windows.h72.remainingHours}h`}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                          当前预警还没有可追踪的动作基线，请先执行修复动作。
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p>暂无预警。</p>
          )}
        </div>
      </Card>

      <div className="grid grid-3">
        <Card title="AI 教学工具" tag="智能">
          <div className="feature-card">
            <EduIcon name="brain" />
            <p>AI 组卷、课堂讲稿、错题讲评脚本、题库纠错。</p>
          </div>
          <Link className="button secondary" href="/teacher/ai-tools" style={{ marginTop: 12 }}>
            进入工具
          </Link>
        </Card>
        <Card title="学情分析" tag="数据">
          <div className="feature-card">
            <EduIcon name="chart" />
            <p>知识点掌握热力图 + 学情报告。</p>
          </div>
          <Link className="button secondary" href="/teacher/analysis" style={{ marginTop: 12 }}>
            查看分析
          </Link>
        </Card>
        <Card title="成绩册" tag="Gradebook">
          <div className="feature-card">
            <EduIcon name="board" />
            <p>查看班级作业完成情况、逾期与平均分。</p>
          </div>
          <Link className="button secondary" href="/teacher/gradebook" style={{ marginTop: 12 }}>
            进入成绩册
          </Link>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="创建班级">
          <form onSubmit={handleCreateClass} style={{ display: "grid", gap: 12 }}>
            <label>
              <div className="section-title">班级名称</div>
              <input
                value={classForm.name}
                onChange={(event) => setClassForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="四年级一班"
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label>
              <div className="section-title">学科</div>
              <select
                value={classForm.subject}
                onChange={(event) => setClassForm((prev) => ({ ...prev, subject: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {SUBJECT_OPTIONS.map((subject) => (
                  <option key={subject.value} value={subject.value}>
                    {subject.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">年级</div>
              <select
                value={classForm.grade}
                onChange={(event) => setClassForm((prev) => ({ ...prev, grade: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {GRADE_OPTIONS.map((grade) => (
                  <option key={grade.value} value={grade.value}>
                    {grade.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary" type="submit" disabled={loading}>
              {loading ? "提交中..." : "创建班级"}
            </button>
          </form>
        </Card>

        <Card title="添加学生">
          <form onSubmit={handleAddStudent} style={{ display: "grid", gap: 12 }}>
            <label>
              <div className="section-title">选择班级</div>
              <select
                value={studentForm.classId}
                onChange={(event) => setStudentForm((prev) => ({ ...prev, classId: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">学生邮箱</div>
              <input
                value={studentForm.email}
                onChange={(event) => setStudentForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="student@demo.com"
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <button className="button primary" type="submit" disabled={loading}>
              {loading ? "提交中..." : "加入班级"}
            </button>
          </form>
        </Card>
      </div>

      <Card title="作业发布">
        <form onSubmit={handleCreateAssignment} style={{ display: "grid", gap: 12 }}>
            <label>
              <div className="section-title">选择班级</div>
              <select
                value={assignmentForm.classId}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, classId: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">关联模块（可选）</div>
              <select
                value={assignmentForm.moduleId}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, moduleId: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                <option value="">不关联模块</option>
                {modules.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          <label>
            <div className="section-title">作业标题</div>
            <input
              value={assignmentForm.title}
              onChange={(event) => setAssignmentForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="本周单元练习"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">作业说明</div>
            <textarea
              value={assignmentForm.description}
              onChange={(event) => setAssignmentForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="建议完成后再做错题总结。"
              rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <div className="grid grid-2">
            <label>
              <div className="section-title">截止日期</div>
              <input
                type="date"
                value={assignmentForm.dueDate}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label>
              <div className="section-title">作业类型</div>
              <select
                value={assignmentForm.submissionType}
                onChange={(event) =>
                  setAssignmentForm((prev) => ({ ...prev, submissionType: event.target.value }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                <option value="quiz">在线题目</option>
                <option value="upload">上传作业</option>
                <option value="essay">作文/主观题</option>
              </select>
            </label>
          </div>

          {assignmentForm.submissionType === "quiz" ? (
            <label>
              <div className="section-title">题目数量</div>
              <input
                type="number"
                min={1}
                max={50}
                value={assignmentForm.questionCount}
                onChange={(event) =>
                  setAssignmentForm((prev) => ({ ...prev, questionCount: Number(event.target.value) }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
          ) : (
            <label>
              <div className="section-title">最多上传</div>
              <input
                type="number"
                min={1}
                max={10}
                value={assignmentForm.maxUploads}
                onChange={(event) =>
                  setAssignmentForm((prev) => ({ ...prev, maxUploads: Number(event.target.value) }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                {assignmentForm.submissionType === "essay"
                  ? "作文/主观题可选上传纸质作业或草稿图片。"
                  : "支持学生上传图片或 PDF 作业。"}
              </div>
            </label>
          )}
          {assignmentForm.submissionType === "quiz" ? (
            <>
              <div className="grid grid-2">
                <label>
                  <div className="section-title">出题方式</div>
                  <select
                    value={assignmentForm.mode}
                    onChange={(event) => setAssignmentForm((prev) => ({ ...prev, mode: event.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                  >
                    <option value="bank">题库抽题</option>
                    <option value="ai">AI 生成</option>
                  </select>
                </label>
                <label>
                  <div className="section-title">难度</div>
                  <select
                    value={assignmentForm.difficulty}
                    onChange={(event) => setAssignmentForm((prev) => ({ ...prev, difficulty: event.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                  >
                    <option value="easy">简单</option>
                    <option value="medium">中等</option>
                    <option value="hard">较难</option>
                  </select>
                </label>
              </div>
              <label>
                <div className="section-title">题型</div>
                <select
                  value={assignmentForm.questionType}
                  onChange={(event) => setAssignmentForm((prev) => ({ ...prev, questionType: event.target.value }))}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                >
                  <option value="choice">选择题</option>
                  <option value="application">应用题</option>
                  <option value="calculation">计算题</option>
                </select>
              </label>
              <label>
                <div className="section-title">限定知识点（可选）</div>
                <select
                  value={assignmentForm.knowledgePointId}
                  onChange={(event) => setAssignmentForm((prev) => ({ ...prev, knowledgePointId: event.target.value }))}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                >
                  <option value="">不限</option>
                  {filteredPoints.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.unit ? `${item.unit} / ` : ""}
                      {item.chapter} · {item.title}
                    </option>
                  ))}
                </select>
              </label>
              {assignmentForm.mode === "ai" ? (
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  AI 生成会写入题库。建议选择知识点并确认已配置 LLM。
                </div>
              ) : null}
            </>
          ) : null}
          {assignmentForm.submissionType !== "quiz" ? (
            <label>
              <div className="section-title">批改重点（可选）</div>
              <textarea
                value={assignmentForm.gradingFocus}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, gradingFocus: event.target.value }))}
                placeholder={
                  assignmentForm.submissionType === "essay"
                    ? "例如：结构完整、语言表达、错别字与标点。"
                    : "例如：重视列式步骤、书写规范与验算。"
                }
                rows={3}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
          ) : null}
          {assignmentError ? <div style={{ color: "#b42318", fontSize: 13 }}>{assignmentError}</div> : null}
          {assignmentMessage ? (
            <div style={{ color: "#1a7f37", fontSize: 13 }}>{assignmentMessage}</div>
          ) : null}
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "提交中..." : "发布作业"}
          </button>
        </form>
      </Card>

      <Card title="班级列表">
        {classes.length === 0 ? (
          <p>暂无班级，请先创建班级。</p>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {classes.map((item) => (
              <div className="card" key={item.id}>
                <div className="section-title">{item.name}</div>
                <p>
                  {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                </p>
                <p>学生：{item.studentCount} 人</p>
                <p>作业：{item.assignmentCount} 份</p>
                <p>邀请码：{item.joinCode ?? "-"}</p>
                <div className="grid grid-2" style={{ marginTop: 8 }}>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => handleRegenerateCode(item.id)}
                  >
                    重新生成邀请码
                  </button>
                  <select
                    value={item.joinMode ?? "approval"}
                    onChange={(event) => handleUpdateJoinMode(item.id, event.target.value as "approval" | "auto")}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                  >
                    <option value="approval">需要审核</option>
                    <option value="auto">自动加入</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="加入班级申请">
        {joinRequests.filter((item) => item.status === "pending").length === 0 ? (
          <p>暂无待审核申请。</p>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {joinRequests
              .filter((item) => item.status === "pending")
              .map((item) => (
                <div className="card" key={item.id}>
                  <div className="section-title">{item.studentName}</div>
                  <p>{item.studentEmail}</p>
                  <p>
                    班级：{item.className} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                  </p>
                  <div className="cta-row">
                    <button className="button primary" type="button" onClick={() => handleApprove(item.id)}>
                      通过
                    </button>
                    <button className="button secondary" type="button" onClick={() => handleReject(item.id)}>
                      拒绝
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>

      <Card title="作业列表">
        {assignments.length === 0 ? (
          <p>暂无作业。</p>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {assignments.map((item) => (
              <div className="card" key={item.id}>
                <div className="section-title">{item.title}</div>
                <p>
                  {item.className} · {SUBJECT_LABELS[item.classSubject] ?? item.classSubject} · {item.classGrade} 年级
                </p>
                {item.moduleTitle ? <p>关联模块：{item.moduleTitle}</p> : null}
                <p>截止日期：{new Date(item.dueDate).toLocaleDateString("zh-CN")}</p>
                <p>类型：{ASSIGNMENT_TYPE_LABELS[item.submissionType ?? "quiz"]}</p>
                <p>
                  完成情况：{item.completed}/{item.total}
                </p>
                <div className="cta-row" style={{ marginTop: 8 }}>
                  <Link className="button secondary" href={`/teacher/assignments/${item.id}`}>
                    查看详情
                  </Link>
                  <Link className="button ghost" href={`/teacher/assignments/${item.id}/stats`}>
                    作业统计
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
