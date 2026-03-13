"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CourseModule } from "@/lib/modules";
import type {
  AssignmentFormState,
  AssignmentItem,
  ClassItem,
  KnowledgePoint,
  StudentFormState,
  TeacherInsightsData,
  TeacherJoinRequest
} from "./types";

const DASHBOARD_FETCH_TIMEOUT_MS = 8_000;

type LoadAllOptions = {
  background?: boolean;
  preserveFeedback?: boolean;
};

function mergeClasses(nextClasses: ClassItem[], previousClasses: ClassItem[]) {
  const previousById = new Map(previousClasses.map((item) => [item.id, item]));
  const merged = nextClasses.map((item) => {
    const previous = previousById.get(item.id);
    if (!previous) return item;
    previousById.delete(item.id);
    return {
      ...item,
      studentCount: Math.max(item.studentCount, previous.studentCount),
      assignmentCount: Math.max(item.assignmentCount, previous.assignmentCount),
      joinCode: item.joinCode ?? previous.joinCode,
      joinMode: item.joinMode ?? previous.joinMode
    };
  });
  return [...merged, ...previousById.values()];
}

function mergeAssignments(nextAssignments: AssignmentItem[], previousAssignments: AssignmentItem[]) {
  const previousById = new Map(previousAssignments.map((item) => [item.id, item]));
  const merged = nextAssignments.map((item) => {
    const previous = previousById.get(item.id);
    if (!previous) return item;
    previousById.delete(item.id);
    return {
      ...item,
      total: Math.max(item.total, previous.total),
      completed: Math.max(item.completed, previous.completed),
      moduleTitle: item.moduleTitle || previous.moduleTitle
    };
  });
  return [...merged, ...previousById.values()];
}

async function fetchJsonWithTimeout<T>(url: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DASHBOARD_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = (await response.json().catch(() => null)) as T | null;
    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

function getFetchErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "教师工作台刷新超时";
  }
  return error instanceof Error ? error.message : "加载教师工作台失败";
}

export function useTeacherDataLoader({
  setUnauthorized,
  setLoading,
  setError,
  setMessage,
  setClasses,
  setAssignments,
  setInsights,
  setJoinRequests,
  setKnowledgePoints,
  onLoaded
}: {
  setUnauthorized: Dispatch<SetStateAction<boolean>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setClasses: Dispatch<SetStateAction<ClassItem[]>>;
  setAssignments: Dispatch<SetStateAction<AssignmentItem[]>>;
  setInsights: Dispatch<SetStateAction<TeacherInsightsData | null>>;
  setJoinRequests: Dispatch<SetStateAction<TeacherJoinRequest[]>>;
  setKnowledgePoints: Dispatch<SetStateAction<KnowledgePoint[]>>;
  onLoaded?: () => void;
}) {
  const latestRequestIdRef = useRef(0);

  const loadAll = useCallback(async (options: LoadAllOptions = {}) => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    const background = options.background === true;
    setUnauthorized(false);
    if (!background) {
      setLoading(true);
    }
    setError(null);
    if (!options.preserveFeedback) {
      setMessage(null);
    }

    try {
      const [classResult, assignmentResult, insightResult, joinResult] = await Promise.allSettled([
        fetchJsonWithTimeout<{ data?: ClassItem[] }>("/api/teacher/classes"),
        fetchJsonWithTimeout<{ data?: AssignmentItem[] }>("/api/teacher/assignments"),
        fetchJsonWithTimeout<TeacherInsightsData>("/api/teacher/insights"),
        fetchJsonWithTimeout<{ data?: TeacherJoinRequest[] }>("/api/teacher/join-requests")
      ]);

      if (requestId !== latestRequestIdRef.current) {
        return;
      }

      if (classResult.status === "fulfilled" && classResult.value.status === 401) {
        setUnauthorized(true);
        return;
      }

      const nextErrors: string[] = [];

      if (classResult.status === "fulfilled") {
        if (classResult.value.ok) {
          setClasses((previous) => mergeClasses(classResult.value.data?.data ?? [], previous));
        } else {
          nextErrors.push("班级数据加载失败");
        }
      } else {
        nextErrors.push(getFetchErrorMessage(classResult.reason));
      }

      if (assignmentResult.status === "fulfilled") {
        if (assignmentResult.value.ok) {
          setAssignments((previous) => mergeAssignments(assignmentResult.value.data?.data ?? [], previous));
        } else {
          nextErrors.push("作业数据加载失败");
        }
      } else {
        nextErrors.push(getFetchErrorMessage(assignmentResult.reason));
      }

      if (insightResult.status === "fulfilled") {
        if (insightResult.value.ok && insightResult.value.data) {
          setInsights(insightResult.value.data);
        } else {
          nextErrors.push("学情分析加载失败");
        }
      } else {
        nextErrors.push(getFetchErrorMessage(insightResult.reason));
      }

      if (joinResult.status === "fulfilled") {
        if (joinResult.value.ok) {
          setJoinRequests(joinResult.value.data?.data ?? []);
        } else {
          nextErrors.push("加入班级申请加载失败");
        }
      } else {
        nextErrors.push(getFetchErrorMessage(joinResult.reason));
      }

      if (nextErrors.length > 0) {
        setError(nextErrors[0]);
      }

      onLoaded?.();
    } catch (nextError) {
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      setError(getFetchErrorMessage(nextError));
    } finally {
      if (!background && requestId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [onLoaded, setAssignments, setClasses, setError, setInsights, setJoinRequests, setLoading, setMessage, setUnauthorized]);

  const loadKnowledgePoints = useCallback(async () => {
    const res = await fetch("/api/knowledge-points");
    const data = (await res.json()) as { data?: KnowledgePoint[] };
    setKnowledgePoints(data.data ?? []);
  }, [setKnowledgePoints]);

  useEffect(() => {
    void loadAll();
    void loadKnowledgePoints();
  }, [loadAll, loadKnowledgePoints]);

  return { loadAll };
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
    if (!studentFormClassId && classes.length) {
      setStudentForm((prev) => ({ ...prev, classId: classes[0].id }));
    }
    if (!assignmentFormClassId && classes.length) {
      const defaultDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setAssignmentForm((prev) => ({ ...prev, classId: classes[0].id, dueDate: prev.dueDate || defaultDue }));
    }
  }, [assignmentFormClassId, classes, setAssignmentForm, setStudentForm, studentFormClassId]);
}

export function useTeacherAssignmentModules({
  classId,
  setModules,
  setAssignmentForm
}: {
  classId: AssignmentFormState["classId"];
  setModules: Dispatch<SetStateAction<CourseModule[]>>;
  setAssignmentForm: Dispatch<SetStateAction<AssignmentFormState>>;
}) {
  useEffect(() => {
    if (!classId) return;
    setModules([]);
    setAssignmentForm((prev) => ({ ...prev, moduleId: "" }));
    fetch(`/api/teacher/modules?classId=${classId}`)
      .then((res) => res.json())
      .then((data: { data?: CourseModule[] }) => {
        const list = data.data ?? [];
        setModules(list);
        if (list.length) {
          setAssignmentForm((prev) => ({ ...prev, moduleId: list[0].id }));
        }
      });
  }, [classId, setAssignmentForm, setModules]);
}
