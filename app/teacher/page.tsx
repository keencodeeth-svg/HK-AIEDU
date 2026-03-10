"use client";

import { useMemo, useState } from "react";
import type { CourseModule } from "@/lib/modules";
import RoleScheduleFocusCard from "@/components/RoleScheduleFocusCard";
import WorkspacePage, { WorkspaceAuthState, WorkspaceLoadingState, buildSuccessNotice, type WorkspaceNoticeItem } from "@/components/WorkspacePage";
import { TeacherAssignmentsCard, TeacherClassListCard, TeacherJoinRequestsCard } from "./_components/TeacherCollectionPanels";
import { TeacherAddStudentCard, TeacherAssignmentComposerCard, TeacherCreateClassCard } from "./_components/TeacherFormPanels";
import { TeacherExamModuleCard, TeacherInsightsCard, TeacherOverviewCard, TeacherQuickAccessCards } from "./_components/TeacherSummaryPanels";
import { TeacherExecutionSummaryCard, TeacherNextStepCard } from "./_components/TeacherPrimaryFlowPanels";
import type {
  AlertImpactData,
  AssignmentFormState,
  AssignmentItem,
  ClassFormState,
  ClassItem,
  KnowledgePoint,
  StudentFormState,
  TeacherAlertActionType,
  TeacherInsightsData,
  TeacherJoinRequest
} from "./types";
import { useTeacherAssignmentModules, useTeacherDataLoader, useTeacherDefaultSelections } from "./useTeacherDashboardEffects";

export default function TeacherPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [insights, setInsights] = useState<TeacherInsightsData | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<TeacherJoinRequest[]>([]);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState<string | null>(null);
  const [actingAlertKey, setActingAlertKey] = useState<string | null>(null);
  const [impactByAlertId, setImpactByAlertId] = useState<Record<string, AlertImpactData>>({});
  const [loadingImpactId, setLoadingImpactId] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const [classForm, setClassForm] = useState<ClassFormState>({ name: "", subject: "math", grade: "4" });
  const [studentForm, setStudentForm] = useState<StudentFormState>({ classId: "", email: "" });
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>({
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

  const { loadAll } = useTeacherDataLoader({
    setUnauthorized,
    setLoading,
    setError,
    setMessage,
    setClasses,
    setAssignments,
    setInsights,
    setJoinRequests,
    setKnowledgePoints,
    onLoaded: () => setLastLoadedAt(new Date().toISOString())
  });

  useTeacherDefaultSelections({
    classes,
    studentFormClassId: studentForm.classId,
    assignmentFormClassId: assignmentForm.classId,
    setStudentForm,
    setAssignmentForm
  });

  useTeacherAssignmentModules({
    classId: assignmentForm.classId,
    setModules,
    setAssignmentForm
  });

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

  async function runAlertAction(alertId: string, actionType: TeacherAlertActionType) {
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

  if (loading && !classes.length && !assignments.length && !insights && !unauthorized) {
    return <WorkspaceLoadingState title="教师工作台加载中" description="正在同步班级、作业、预警和教学执行数据。" />;
  }

  if (unauthorized) {
    return <WorkspaceAuthState title="需要教师账号登录" description="请先使用教师账号登录后，再查看教学工作台和班级执行动作。" />;
  }

  const notices: WorkspaceNoticeItem[] = [];
  if (error) {
    notices.push({ id: "teacher-error", tone: "error", title: "本次操作存在异常", description: error });
  }
  if (message) {
    notices.push(buildSuccessNotice(message));
  }

  return (
    <WorkspacePage
      title="教师工作台"
      subtitle="先处理阻塞项，再发作业、看学情和安排本周课堂动作。"
      lastLoadedAt={lastLoadedAt}
      chips={[<span key="teacher-progress" className="chip">教学进度跟踪</span>]}
      actions={
        <button className="button secondary" type="button" onClick={() => void loadAll()} disabled={loading}>
          {loading ? "刷新中..." : "刷新"}
        </button>
      }
      notices={notices}
    >

      <RoleScheduleFocusCard variant="teacher" />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <TeacherNextStepCard
          classes={classes}
          assignments={assignments}
          joinRequests={joinRequests}
          insights={insights}
        />
        <TeacherExecutionSummaryCard
          classes={classes}
          assignments={assignments}
          joinRequests={joinRequests}
          insights={insights}
        />
      </div>

      <div id="teacher-compose-assignment">
        <TeacherAssignmentComposerCard
          classes={classes}
          modules={modules}
          assignmentForm={assignmentForm}
          filteredPoints={filteredPoints}
          loading={loading}
          assignmentError={assignmentError}
          assignmentMessage={assignmentMessage}
          onChange={(patch) => setAssignmentForm((prev) => ({ ...prev, ...patch }))}
          onSubmit={handleCreateAssignment}
        />
      </div>

      <TeacherInsightsCard insights={insights} actingAlertKey={actingAlertKey} acknowledgingAlertId={acknowledgingAlertId} impactByAlertId={impactByAlertId} loadingImpactId={loadingImpactId} onRunAlertAction={runAlertAction} onAcknowledgeAlert={acknowledgeAlert} onLoadAlertImpact={loadAlertImpact} />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div id="teacher-join-requests">
          <TeacherJoinRequestsCard joinRequests={joinRequests} onApprove={handleApprove} onReject={handleReject} />
        </div>
        <TeacherOverviewCard classes={classes} assignments={assignments} message={null} error={null} />
      </div>

      <TeacherExamModuleCard />

      <TeacherQuickAccessCards />

      <div className="grid grid-2">
        <div id="teacher-create-class">
          <TeacherCreateClassCard
            classForm={classForm}
            loading={loading}
            onChange={(patch) => setClassForm((prev) => ({ ...prev, ...patch }))}
            onSubmit={handleCreateClass}
          />
        </div>
        <div id="teacher-add-student">
          <TeacherAddStudentCard
            studentForm={studentForm}
            classes={classes}
            loading={loading}
            onChange={(patch) => setStudentForm((prev) => ({ ...prev, ...patch }))}
            onSubmit={handleAddStudent}
          />
        </div>
      </div>

      <div id="teacher-class-list">
        <TeacherClassListCard classes={classes} onRegenerateCode={handleRegenerateCode} onUpdateJoinMode={handleUpdateJoinMode} />
      </div>

      <div id="teacher-assignment-list">
        <TeacherAssignmentsCard assignments={assignments} />
      </div>
    </WorkspacePage>
  );
}
