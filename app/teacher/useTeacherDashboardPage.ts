"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type { CourseModule } from "@/lib/modules";
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
import {
  useTeacherAssignmentModules,
  useTeacherDataLoader,
  useTeacherDefaultSelections
} from "./useTeacherDashboardEffects";
import {
  getTeacherDashboardAlertRequestMessage,
  getTeacherDashboardClassRequestMessage,
  getTeacherDashboardJoinRequestMessage,
  isMissingTeacherDashboardAlertError,
  isMissingTeacherDashboardClassError,
  isMissingTeacherDashboardJoinRequestError,
  isTeacherDashboardModuleMissingError
} from "./dashboard-utils";

type CreateClassResponse = {
  data?: Partial<ClassItem>;
};

type AddStudentResponse = {
  added?: boolean;
};

type CreateAssignmentResponse = {
  data?: Partial<AssignmentItem>;
  message?: string;
};

type AlertActionResponse = {
  message?: string;
  data?: {
    result?: {
      message?: string;
    };
  };
};

type AlertImpactResponse = {
  data?: AlertImpactData;
};

type UpdateClassResponse = {
  data?: Partial<ClassItem>;
};

type JoinRequestMutationResponse = {
  message?: string;
  ok?: boolean;
};

export function useTeacherDashboardPage() {
  const classesRef = useRef<ClassItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [insights, setInsights] = useState<TeacherInsightsData | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageReady, setPageReady] = useState(false);
  const [staleDataError, setStaleDataError] = useState<string | null>(null);
  const [knowledgePointsNotice, setKnowledgePointsNotice] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<TeacherJoinRequest[]>([]);
  const [assignmentLoadError, setAssignmentLoadError] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState<string | null>(null);
  const [actingAlertKey, setActingAlertKey] = useState<string | null>(null);
  const [impactByAlertId, setImpactByAlertId] = useState<Record<string, AlertImpactData>>({});
  const [loadingImpactId, setLoadingImpactId] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const [classForm, setClassForm] = useState<ClassFormState>({
    name: "",
    subject: "math",
    grade: "4"
  });
  const [studentForm, setStudentForm] = useState<StudentFormState>({
    classId: "",
    email: ""
  });
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
    return knowledgePoints.filter(
      (kp) => kp.subject === klass.subject && kp.grade === klass.grade
    );
  }, [assignmentForm.classId, classes, knowledgePoints]);

  const pendingJoinCount = useMemo(
    () => joinRequests.filter((item) => item.status === "pending").length,
    [joinRequests]
  );

  const activeAlertCount = useMemo(
    () => (insights?.alerts ?? []).filter((item) => item.status === "active").length,
    [insights]
  );

  const classesMissingAssignmentsCount = useMemo(
    () =>
      classes.filter(
        (item) => item.studentCount > 0 && item.assignmentCount === 0
      ).length,
    [classes]
  );

  const dueSoonAssignmentCount = useMemo(
    () =>
      assignments.filter(
        (item) =>
          item.completed < item.total &&
          Math.ceil(
            (new Date(item.dueDate).getTime() - Date.now()) / (60 * 60 * 1000)
          ) <= 48
      ).length,
    [assignments]
  );

  const hasDashboardData =
    classes.length > 0 ||
    assignments.length > 0 ||
    insights !== null ||
    joinRequests.length > 0;

  useEffect(() => {
    classesRef.current = classes;
  }, [classes]);

  const handleLoaded = useCallback(() => {
    setLastLoadedAt(new Date().toISOString());
  }, []);

  const { loadAll, loadKnowledgePoints } = useTeacherDataLoader({
    setUnauthorized,
    setLoading,
    setPageError,
    setStaleDataError,
    setKnowledgePointsNotice,
    setPageReady,
    setClasses,
    setAssignments,
    setInsights,
    setJoinRequests,
    setKnowledgePoints,
    onLoaded: handleLoaded
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
    setAssignmentForm,
    setUnauthorized,
    setAssignmentLoadError
  });

  const updateClassForm = useCallback((patch: Partial<ClassFormState>) => {
    setClassForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateStudentForm = useCallback((patch: Partial<StudentFormState>) => {
    setStudentForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateAssignmentForm = useCallback(
    (patch: Partial<AssignmentFormState>) => {
      setAssignmentForm((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      loadAll({ preserveFeedback: true }),
      loadKnowledgePoints()
    ]);
  }, [loadAll, loadKnowledgePoints]);

  const removeClassFromDashboard = useCallback((classId: string) => {
    const nextClasses = classesRef.current.filter((item) => item.id !== classId);
    const nextClassId = nextClasses[0]?.id ?? "";

    classesRef.current = nextClasses;
    setClasses(nextClasses);
    setAssignments((prev) => prev.filter((item) => item.classId !== classId));
    setJoinRequests((prev) => prev.filter((item) => item.classId !== classId));
    setModules([]);
    setStudentForm((prev) => (prev.classId === classId ? { ...prev, classId: nextClassId } : prev));
    setAssignmentForm((prev) =>
      prev.classId === classId
        ? {
            ...prev,
            classId: nextClassId,
            moduleId: "",
            knowledgePointId: ""
          }
        : prev
    );
  }, []);

  const removeJoinRequestFromDashboard = useCallback((requestId: string) => {
    setJoinRequests((prev) => prev.filter((item) => item.id !== requestId));
  }, []);

  const removeAlertImpact = useCallback((alertId: string) => {
    setImpactByAlertId((prev) => {
      if (!prev[alertId]) return prev;
      const next = { ...prev };
      delete next[alertId];
      return next;
    });
  }, []);

  async function handleCreateClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await requestJson<CreateClassResponse>(
        "/api/teacher/classes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(classForm)
        }
      );
      const createdClass = payload.data;
      if (createdClass?.id) {
        const createdClassId = createdClass.id;
        const defaultDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        setClasses((prev) => [
          {
            id: createdClassId,
            name: createdClass.name ?? classForm.name,
            subject: createdClass.subject ?? classForm.subject,
            grade: createdClass.grade ?? classForm.grade,
            studentCount: 0,
            assignmentCount: 0,
            joinCode: createdClass.joinCode,
            joinMode: createdClass.joinMode ?? "approval"
          },
          ...prev.filter((item) => item.id !== createdClassId)
        ]);
        setStudentForm((prev) => ({
          ...prev,
          classId: prev.classId || createdClassId
        }));
        setAssignmentForm((prev) => ({
          ...prev,
          classId: prev.classId || createdClassId,
          dueDate: prev.dueDate || defaultDue
        }));
      }
      setMessage("班级创建成功。");
      setClassForm((prev) => ({ ...prev, name: "" }));
      void loadAll({ background: true, preserveFeedback: true });
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setUnauthorized(true);
      } else {
        setError(getTeacherDashboardClassRequestMessage(nextError, "创建班级失败"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAddStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentForm.classId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await requestJson<AddStudentResponse>(
        `/api/teacher/classes/${studentForm.classId}/students`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: studentForm.email })
        }
      );
      if (payload.added) {
        setClasses((prev) =>
          prev.map((item) =>
            item.id === studentForm.classId
              ? { ...item, studentCount: item.studentCount + 1 }
              : item
          )
        );
      }
      setMessage(payload.added ? "已加入班级。" : "学生已在班级中。");
      setStudentForm((prev) => ({ ...prev, email: "" }));
      void loadAll({ background: true, preserveFeedback: true });
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardClassRequestMessage(nextError, "添加学生失败");
        if (isMissingTeacherDashboardClassError(nextError)) {
          removeClassFromDashboard(studentForm.classId);
          void loadAll({ background: true, preserveFeedback: true });
        }
        setError(nextMessage);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignmentForm.classId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    setAssignmentLoadError(null);
    setAssignmentError(null);
    setAssignmentMessage(null);
    try {
      const payload = await requestJson<CreateAssignmentResponse>(
        "/api/teacher/assignments",
        {
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
        }
      );
      const createdAssignment = payload.data;
      const targetClass = classes.find(
        (item) => item.id === assignmentForm.classId
      );
      const selectedModule = modules.find(
        (item) => item.id === assignmentForm.moduleId
      );
      if (createdAssignment?.id && targetClass) {
        const createdAssignmentId = createdAssignment.id;
        setAssignments((prev) => [
          {
            id: createdAssignmentId,
            classId: createdAssignment.classId ?? targetClass.id,
            className: targetClass.name,
            classSubject: targetClass.subject,
            classGrade: targetClass.grade,
            moduleTitle:
              (createdAssignment as { moduleTitle?: string }).moduleTitle ??
              (assignmentForm.moduleId ? selectedModule?.title ?? "" : ""),
            title: createdAssignment.title ?? assignmentForm.title,
            dueDate: createdAssignment.dueDate ?? assignmentForm.dueDate,
            total: targetClass.studentCount,
            completed: 0,
            submissionType:
              createdAssignment.submissionType ?? assignmentForm.submissionType
          },
          ...prev.filter((item) => item.id !== createdAssignmentId)
        ]);
        setClasses((prev) =>
          prev.map((item) =>
            item.id === targetClass.id
              ? { ...item, assignmentCount: item.assignmentCount + 1 }
              : item
          )
        );
      }
      const nextMessage = payload.message ?? "作业发布成功。";
      setMessage(nextMessage);
      setAssignmentMessage(nextMessage);
      setAssignmentForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        gradingFocus: ""
      }));
      void loadAll({ background: true, preserveFeedback: true });
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setUnauthorized(true);
        return;
      }
      const nextMessage = getTeacherDashboardClassRequestMessage(nextError, "发布作业失败");
      if (isTeacherDashboardModuleMissingError(nextError)) {
        setAssignmentForm((prev) => ({ ...prev, moduleId: "" }));
      }
      if (isMissingTeacherDashboardClassError(nextError)) {
        removeClassFromDashboard(assignmentForm.classId);
        void loadAll({ background: true, preserveFeedback: true });
      }
      setError(nextMessage);
      setAssignmentError(nextMessage);
    } finally {
      setLoading(false);
    }
  }

  async function acknowledgeAlert(alertId: string) {
    setAcknowledgingAlertId(alertId);
    setError(null);
    setMessage(null);
    try {
      const payload = await requestJson<AlertActionResponse>(
        `/api/teacher/alerts/${alertId}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionType: "mark_done" })
        }
      );
      setMessage(payload.data?.result?.message ?? "预警已标记处理。");
      await loadAll({ background: true, preserveFeedback: true });
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardAlertRequestMessage(nextError, "确认预警失败");
        if (isMissingTeacherDashboardAlertError(nextError)) {
          removeAlertImpact(alertId);
          await loadAll({ background: true, preserveFeedback: true });
        }
        setError(nextMessage);
      }
    } finally {
      setAcknowledgingAlertId(null);
    }
  }

  async function runAlertAction(
    alertId: string,
    actionType: TeacherAlertActionType
  ) {
    const actionKey = `${alertId}:${actionType}`;
    setActingAlertKey(actionKey);
    setError(null);
    setMessage(null);
    try {
      const payload = await requestJson<AlertActionResponse>(
        `/api/teacher/alerts/${alertId}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionType })
        }
      );
      const actionMessage =
        payload.data?.result?.message ?? "预警动作已执行";
      await loadAll({ background: true, preserveFeedback: true });
      await loadAlertImpact(alertId, true);
      setMessage(actionMessage);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardAlertRequestMessage(nextError, "执行预警动作失败");
        if (isMissingTeacherDashboardAlertError(nextError)) {
          removeAlertImpact(alertId);
          await loadAll({ background: true, preserveFeedback: true });
        }
        setError(nextMessage);
      }
    } finally {
      setActingAlertKey(null);
    }
  }

  async function loadAlertImpact(alertId: string, force = false) {
    if (!force && impactByAlertId[alertId]) return;
    setLoadingImpactId(alertId);
    try {
      const payload = await requestJson<AlertImpactResponse>(
        `/api/teacher/alerts/${alertId}/impact`
      );
      if (payload.data) {
        setImpactByAlertId((prev) => ({ ...prev, [alertId]: payload.data! }));
      }
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setUnauthorized(true);
      } else if (isMissingTeacherDashboardAlertError(nextError)) {
        removeAlertImpact(alertId);
        await loadAll({ background: true, preserveFeedback: true });
      }
      // Keep the current dashboard usable if the impact side panel fails to refresh.
    } finally {
      setLoadingImpactId(null);
    }
  }

  async function handleUpdateJoinMode(
    classId: string,
    joinMode: "approval" | "auto"
  ) {
    setError(null);
    setMessage(null);
    try {
      const payload = await requestJson<UpdateClassResponse>(
        `/api/teacher/classes/${classId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ joinMode })
        }
      );
      setClasses((prev) =>
        prev.map((item) =>
          item.id === classId
            ? { ...item, joinMode: payload.data?.joinMode ?? joinMode }
            : item
        )
      );
      setMessage("班级加入方式已更新。");
      void loadAll({ background: true, preserveFeedback: true });
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardClassRequestMessage(nextError, "更新加入方式失败");
        if (isMissingTeacherDashboardClassError(nextError)) {
          removeClassFromDashboard(classId);
          void loadAll({ background: true, preserveFeedback: true });
        }
        setError(nextMessage);
      }
    }
  }

  async function handleRegenerateCode(classId: string) {
    setError(null);
    setMessage(null);
    try {
      const payload = await requestJson<UpdateClassResponse>(
        `/api/teacher/classes/${classId}/join-code`,
        {
          method: "POST"
        }
      );
      setClasses((prev) =>
        prev.map((item) =>
          item.id === classId
            ? { ...item, joinCode: payload.data?.joinCode ?? item.joinCode }
            : item
        )
      );
      setMessage("邀请码已重新生成。");
      void loadAll({ background: true, preserveFeedback: true });
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardClassRequestMessage(nextError, "重新生成邀请码失败");
        if (isMissingTeacherDashboardClassError(nextError)) {
          removeClassFromDashboard(classId);
          void loadAll({ background: true, preserveFeedback: true });
        }
        setError(nextMessage);
      }
    }
  }

  async function handleApprove(requestId: string) {
    setError(null);
    setMessage(null);
    try {
      const payload = await requestJson<JoinRequestMutationResponse>(
        `/api/teacher/join-requests/${requestId}/approve`,
        { method: "POST" }
      );
      setMessage(payload.message ?? "已通过加入班级申请。");
      void loadAll({ background: true, preserveFeedback: true });
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardJoinRequestMessage(nextError, "通过申请失败");
        if (isMissingTeacherDashboardJoinRequestError(nextError)) {
          removeJoinRequestFromDashboard(requestId);
          void loadAll({ background: true, preserveFeedback: true });
        }
        setError(nextMessage);
      }
    }
  }

  async function handleReject(requestId: string) {
    setError(null);
    setMessage(null);
    try {
      const payload = await requestJson<JoinRequestMutationResponse>(
        `/api/teacher/join-requests/${requestId}/reject`,
        { method: "POST" }
      );
      setMessage(payload.message ?? "已拒绝加入班级申请。");
      void loadAll({ background: true, preserveFeedback: true });
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardJoinRequestMessage(nextError, "拒绝申请失败");
        if (isMissingTeacherDashboardJoinRequestError(nextError)) {
          removeJoinRequestFromDashboard(requestId);
          void loadAll({ background: true, preserveFeedback: true });
        }
        setError(nextMessage);
      }
    }
  }

  return {
    classes,
    assignments,
    knowledgePoints,
    modules,
    insights,
    unauthorized,
    loading,
    pageError,
    pageReady,
    staleDataError,
    knowledgePointsNotice,
    message,
    error,
    joinRequests,
    assignmentLoadError,
    assignmentError,
    assignmentMessage,
    acknowledgingAlertId,
    actingAlertKey,
    impactByAlertId,
    loadingImpactId,
    lastLoadedAt,
    classForm,
    studentForm,
    assignmentForm,
    filteredPoints,
    pendingJoinCount,
    activeAlertCount,
    classesMissingAssignmentsCount,
    dueSoonAssignmentCount,
    hasDashboardData,
    updateClassForm,
    updateStudentForm,
    updateAssignmentForm,
    refreshDashboard,
    handleCreateClass,
    handleAddStudent,
    handleCreateAssignment,
    acknowledgeAlert,
    runAlertAction,
    loadAlertImpact,
    handleUpdateJoinMode,
    handleRegenerateCode,
    handleApprove,
    handleReject
  };
}
