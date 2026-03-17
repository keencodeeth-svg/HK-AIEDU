"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CourseModule } from "@/lib/modules";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  AssignmentFormState,
  AssignmentItem,
  ClassItem,
  KnowledgePoint,
  StudentFormState,
  TeacherInsightsData,
  TeacherJoinRequest
} from "./types";
import { getTeacherDashboardClassRequestMessage } from "./dashboard-utils";

const DASHBOARD_FETCH_TIMEOUT_MS = 8_000;

type LoadAllOptions = {
  background?: boolean;
  preserveFeedback?: boolean;
};

type TeacherClassesResponse = {
  data?: ClassItem[];
};

type TeacherAssignmentsResponse = {
  data?: AssignmentItem[];
};

type TeacherJoinRequestsResponse = {
  data?: TeacherJoinRequest[];
};

type KnowledgePointsResponse = {
  data?: KnowledgePoint[];
};

type TeacherModulesResponse = {
  data?: CourseModule[];
};

function mergeClasses(nextClasses: ClassItem[], previousClasses: ClassItem[]) {
  const previousById = new Map(previousClasses.map((item) => [item.id, item]));
  return nextClasses.map((item) => {
    const previous = previousById.get(item.id);
    if (!previous) return item;
    return {
      ...item,
      studentCount: Math.max(item.studentCount, previous.studentCount),
      assignmentCount: Math.max(item.assignmentCount, previous.assignmentCount),
      joinCode: item.joinCode ?? previous.joinCode,
      joinMode: item.joinMode ?? previous.joinMode
    };
  });
}

function mergeAssignments(
  nextAssignments: AssignmentItem[],
  previousAssignments: AssignmentItem[]
) {
  const previousById = new Map(previousAssignments.map((item) => [item.id, item]));
  return nextAssignments.map((item) => {
    const previous = previousById.get(item.id);
    if (!previous) return item;
    return {
      ...item,
      total: Math.max(item.total, previous.total),
      completed: Math.max(item.completed, previous.completed),
      moduleTitle: item.moduleTitle || previous.moduleTitle
    };
  });
}

async function requestJsonWithTimeout<T>(url: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    DASHBOARD_FETCH_TIMEOUT_MS
  );
  try {
    return await requestJson<T>(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function getDashboardLoadMessage(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "教师工作台刷新超时";
  }
  return getTeacherDashboardClassRequestMessage(error, fallback);
}

export function useTeacherDataLoader({
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
  onLoaded
}: {
  setUnauthorized: Dispatch<SetStateAction<boolean>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setPageError: Dispatch<SetStateAction<string | null>>;
  setStaleDataError: Dispatch<SetStateAction<string | null>>;
  setKnowledgePointsNotice: Dispatch<SetStateAction<string | null>>;
  setPageReady: Dispatch<SetStateAction<boolean>>;
  setClasses: Dispatch<SetStateAction<ClassItem[]>>;
  setAssignments: Dispatch<SetStateAction<AssignmentItem[]>>;
  setInsights: Dispatch<SetStateAction<TeacherInsightsData | null>>;
  setJoinRequests: Dispatch<SetStateAction<TeacherJoinRequest[]>>;
  setKnowledgePoints: Dispatch<SetStateAction<KnowledgePoint[]>>;
  onLoaded?: () => void;
}) {
  const latestRequestIdRef = useRef(0);
  const knowledgePointRequestIdRef = useRef(0);
  const hasClassSnapshotRef = useRef(false);
  const hasAssignmentSnapshotRef = useRef(false);
  const hasInsightsSnapshotRef = useRef(false);
  const hasJoinRequestSnapshotRef = useRef(false);
  const hasKnowledgePointsSnapshotRef = useRef(false);

  const loadAll = useCallback(
    async (options: LoadAllOptions = {}) => {
      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      const background = options.background === true;

      setUnauthorized(false);
      if (!background) {
        setLoading(true);
      }
      setPageError(null);
      setStaleDataError(null);

      try {
        const [
          classResult,
          assignmentResult,
          insightResult,
          joinResult
        ] = await Promise.allSettled([
          requestJsonWithTimeout<TeacherClassesResponse>("/api/teacher/classes"),
          requestJsonWithTimeout<TeacherAssignmentsResponse>(
            "/api/teacher/assignments"
          ),
          requestJsonWithTimeout<TeacherInsightsData>("/api/teacher/insights"),
          requestJsonWithTimeout<TeacherJoinRequestsResponse>(
            "/api/teacher/join-requests"
          )
        ]);

        if (requestId !== latestRequestIdRef.current) {
          return;
        }

        const authError =
          (classResult.status === "rejected" && isAuthError(classResult.reason)) ||
          (assignmentResult.status === "rejected" &&
            isAuthError(assignmentResult.reason)) ||
          (insightResult.status === "rejected" && isAuthError(insightResult.reason)) ||
          (joinResult.status === "rejected" && isAuthError(joinResult.reason));

        if (authError) {
          setUnauthorized(true);
          return;
        }

        const staleMessages: string[] = [];
        let classReady = false;

        if (classResult.status === "fulfilled") {
          setClasses((previous) =>
            mergeClasses(classResult.value.data ?? [], previous)
          );
          hasClassSnapshotRef.current = true;
          classReady = true;
        } else {
          const nextMessage = getDashboardLoadMessage(
            classResult.reason,
            "班级数据加载失败"
          );
          if (hasClassSnapshotRef.current) {
            staleMessages.push(`班级数据刷新失败：${nextMessage}`);
            classReady = true;
          } else {
            setPageError(nextMessage);
            setClasses([]);
          }
        }

        if (assignmentResult.status === "fulfilled") {
          setAssignments((previous) =>
            mergeAssignments(assignmentResult.value.data ?? [], previous)
          );
          hasAssignmentSnapshotRef.current = true;
        } else {
          const nextMessage = getDashboardLoadMessage(
            assignmentResult.reason,
            "作业数据加载失败"
          );
          if (hasAssignmentSnapshotRef.current) {
            staleMessages.push(`作业数据刷新失败：${nextMessage}`);
          } else {
            setAssignments([]);
            staleMessages.push(`作业数据加载失败：${nextMessage}`);
          }
        }

        if (insightResult.status === "fulfilled") {
          setInsights(insightResult.value);
          hasInsightsSnapshotRef.current = true;
        } else {
          const nextMessage = getDashboardLoadMessage(
            insightResult.reason,
            "学情分析加载失败"
          );
          if (hasInsightsSnapshotRef.current) {
            staleMessages.push(`学情分析刷新失败：${nextMessage}`);
          } else {
            setInsights(null);
            staleMessages.push(`学情分析加载失败：${nextMessage}`);
          }
        }

        if (joinResult.status === "fulfilled") {
          setJoinRequests(joinResult.value.data ?? []);
          hasJoinRequestSnapshotRef.current = true;
        } else {
          const nextMessage = getDashboardLoadMessage(
            joinResult.reason,
            "加入班级申请加载失败"
          );
          if (hasJoinRequestSnapshotRef.current) {
            staleMessages.push(`加入班级申请刷新失败：${nextMessage}`);
          } else {
            setJoinRequests([]);
            staleMessages.push(`加入班级申请加载失败：${nextMessage}`);
          }
        }

        if (classReady) {
          setPageReady(true);
          onLoaded?.();
        }
        setStaleDataError(staleMessages.join("；") || null);
      } catch (nextError) {
        if (requestId !== latestRequestIdRef.current) {
          return;
        }
        if (isAuthError(nextError)) {
          setUnauthorized(true);
          return;
        }
        setPageError(getDashboardLoadMessage(nextError, "加载教师工作台失败"));
      } finally {
        if (!background && requestId === latestRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [
      onLoaded,
      setAssignments,
      setClasses,
      setInsights,
      setJoinRequests,
      setLoading,
      setPageError,
      setPageReady,
      setStaleDataError,
      setUnauthorized
    ]
  );

  const loadKnowledgePoints = useCallback(async () => {
    const requestId = knowledgePointRequestIdRef.current + 1;
    knowledgePointRequestIdRef.current = requestId;
    try {
      const payload = await requestJson<KnowledgePointsResponse>(
        "/api/knowledge-points"
      );
      if (knowledgePointRequestIdRef.current !== requestId) {
        return;
      }
      setKnowledgePoints(payload.data ?? []);
      hasKnowledgePointsSnapshotRef.current = true;
      setKnowledgePointsNotice(null);
    } catch (nextError) {
      if (knowledgePointRequestIdRef.current !== requestId) {
        return;
      }
      if (isAuthError(nextError)) {
        setUnauthorized(true);
        return;
      }
      const nextMessage = getDashboardLoadMessage(
        nextError,
        "知识点加载失败"
      );
      if (hasKnowledgePointsSnapshotRef.current) {
        setKnowledgePointsNotice(`已保留最近一次知识点目录：${nextMessage}`);
        return;
      }
      setKnowledgePoints([]);
      setKnowledgePointsNotice(nextMessage);
    }
  }, [setKnowledgePoints, setKnowledgePointsNotice, setUnauthorized]);

  useEffect(() => {
    void loadAll();
    void loadKnowledgePoints();
  }, [loadAll, loadKnowledgePoints]);

  return { loadAll, loadKnowledgePoints };
}

export function useTeacherDefaultSelections({
  classes,
  studentFormClassId,
  assignmentFormClassId,
  setStudentForm,
  setAssignmentForm
}: {
  classes: ClassItem[];
  studentFormClassId: StudentFormState["classId"];
  assignmentFormClassId: AssignmentFormState["classId"];
  setStudentForm: Dispatch<SetStateAction<StudentFormState>>;
  setAssignmentForm: Dispatch<SetStateAction<AssignmentFormState>>;
}) {
  useEffect(() => {
    const nextClassId = classes[0]?.id ?? "";
    const hasStudentClass = studentFormClassId && classes.some((item) => item.id === studentFormClassId);
    const hasAssignmentClass = assignmentFormClassId && classes.some((item) => item.id === assignmentFormClassId);

    if (nextClassId && !hasStudentClass) {
      setStudentForm((prev) => ({ ...prev, classId: nextClassId }));
    }
    if (nextClassId && !hasAssignmentClass) {
      const defaultDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      setAssignmentForm((prev) => ({
        ...prev,
        classId: nextClassId,
        moduleId: "",
        knowledgePointId: "",
        dueDate: prev.dueDate || defaultDue
      }));
    }
    if (!nextClassId && studentFormClassId) {
      setStudentForm((prev) => ({ ...prev, classId: "" }));
    }
    if (!nextClassId && assignmentFormClassId) {
      setAssignmentForm((prev) => ({
        ...prev,
        classId: "",
        moduleId: "",
        knowledgePointId: ""
      }));
    }
  }, [
    assignmentFormClassId,
    classes,
    setAssignmentForm,
    setStudentForm,
    studentFormClassId
  ]);
}

export function useTeacherAssignmentModules({
  classId,
  setModules,
  setAssignmentForm,
  setUnauthorized,
  setAssignmentLoadError
}: {
  classId: AssignmentFormState["classId"];
  setModules: Dispatch<SetStateAction<CourseModule[]>>;
  setAssignmentForm: Dispatch<SetStateAction<AssignmentFormState>>;
  setUnauthorized: Dispatch<SetStateAction<boolean>>;
  setAssignmentLoadError: Dispatch<SetStateAction<string | null>>;
}) {
  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    setModules([]);
    setAssignmentForm((prev) => ({ ...prev, moduleId: "" }));
    setAssignmentLoadError(null);

    async function loadModules() {
      try {
        const payload = await requestJson<TeacherModulesResponse>(
          `/api/teacher/modules?classId=${classId}`
        );
        if (cancelled) return;
        const list = payload.data ?? [];
        setModules(list);
        if (list.length) {
          setAssignmentForm((prev) => ({ ...prev, moduleId: list[0].id }));
        }
      } catch (nextError) {
        if (cancelled) return;
        if (isAuthError(nextError)) {
          setUnauthorized(true);
          return;
        }
        setModules([]);
        setAssignmentLoadError(
          getDashboardLoadMessage(nextError, "课程模块加载失败")
        );
      }
    }

    void loadModules();
    return () => {
      cancelled = true;
    };
  }, [
    classId,
    setAssignmentForm,
    setAssignmentLoadError,
    setModules,
    setUnauthorized
  ]);
}
