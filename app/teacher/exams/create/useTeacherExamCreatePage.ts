"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getRequestErrorMessage,
  getRequestErrorPayload,
  getRequestStatus,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";
import type {
  ClassItem,
  ClassStudent,
  FormState,
  KnowledgePoint,
  StageTrailItem
} from "./types";
import {
  formatClassLabel,
  getDefaultEndAt,
  getPoolRisk,
  getScheduleStatus,
  normalizeCreateErrorMessage
} from "./utils";

type TeacherClassesResponse = {
  data?: ClassItem[];
};

type KnowledgePointListResponse = {
  data?: KnowledgePoint[];
};

type ClassStudentsResponse = {
  data?: ClassStudent[];
};

type CreateExamResponse = {
  message?: string;
  data?: {
    id?: string;
    warnings?: string[];
  };
};

type CreateExamErrorPayload = {
  details?: {
    suggestions?: string[];
    stageTrail?: StageTrailItem[];
  };
};

type ConfigNotice = {
  title: string;
  message: string;
};

type LoadStudentsOptions = {
  preserveExisting?: boolean;
};

function getTeacherExamCreateRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const normalizedMessage = normalizeCreateErrorMessage(requestMessage);

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续发布考试。";
  }
  if (requestMessage.toLowerCase() === "class not found" || (status === 404 && requestMessage.toLowerCase() === "not found")) {
    return "当前班级不存在，或你已失去该班级的发布权限。";
  }
  return normalizedMessage || fallback;
}

function isTeacherExamCreateClassMissingError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();
  return requestMessage === "class not found" || (status === 404 && requestMessage === "not found");
}

const INITIAL_FORM: FormState = {
  classId: "",
  title: "",
  description: "",
  publishMode: "teacher_assigned",
  antiCheatLevel: "basic",
  studentIds: [],
  startAt: "",
  endAt: getDefaultEndAt(),
  durationMinutes: 60,
  questionCount: 10,
  knowledgePointId: "",
  difficulty: "medium",
  questionType: "choice",
  includeIsolated: false
};

function syncFormWithConfig(
  prev: FormState,
  nextClasses: ClassItem[],
  nextKnowledgePoints: KnowledgePoint[]
) {
  const nextClassId =
    prev.classId && nextClasses.some((item) => item.id === prev.classId)
      ? prev.classId
      : nextClasses[0]?.id ?? "";
  const nextClass = nextClasses.find((item) => item.id === nextClassId);
  const nextKnowledgePointId =
    prev.knowledgePointId &&
    nextClass &&
    nextKnowledgePoints.some(
      (item) =>
        item.id === prev.knowledgePointId &&
        item.subject === nextClass.subject &&
        item.grade === nextClass.grade
    )
      ? prev.knowledgePointId
      : "";

  return {
    nextClassId,
    nextForm: {
      ...prev,
      classId: nextClassId,
      knowledgePointId: nextKnowledgePointId,
      studentIds: nextClassId === prev.classId ? prev.studentIds : [],
      endAt: prev.endAt || getDefaultEndAt()
    }
  };
}

export function useTeacherExamCreatePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configRefreshing, setConfigRefreshing] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [configNotice, setConfigNotice] = useState<ConfigNotice | null>(null);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitSuggestions, setSubmitSuggestions] = useState<string[]>([]);
  const [stageTrail, setStageTrail] = useState<StageTrailItem[]>([]);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const formRef = useRef<FormState>(INITIAL_FORM);
  const knowledgePointsRef = useRef<KnowledgePoint[]>([]);
  const configRequestIdRef = useRef(0);
  const studentsRequestIdRef = useRef(0);
  const hasClassSnapshotRef = useRef(false);
  const hasKnowledgePointSnapshotRef = useRef(false);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    knowledgePointsRef.current = knowledgePoints;
  }, [knowledgePoints]);

  const loadConfig = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const requestId = configRequestIdRef.current + 1;
      configRequestIdRef.current = requestId;

      if (mode === "refresh") {
        setConfigRefreshing(true);
      } else {
        setConfigLoading(true);
      }
      setPageError(null);
      setConfigNotice(null);

      try {
        const [classesResult, knowledgePointsResult] = await Promise.allSettled([
          requestJson<TeacherClassesResponse>("/api/teacher/classes"),
          requestJson<KnowledgePointListResponse>("/api/knowledge-points")
        ]);

        if (configRequestIdRef.current !== requestId) {
          return formRef.current.classId;
        }

        const classesAuthError =
          classesResult.status === "rejected" && isAuthError(classesResult.reason);
        const knowledgePointsAuthError =
          knowledgePointsResult.status === "rejected" &&
          isAuthError(knowledgePointsResult.reason);

        if (classesAuthError || knowledgePointsAuthError) {
          setAuthRequired(true);
          return "";
        }

        let nextKnowledgePoints = knowledgePointsRef.current;
        let nextNotice: ConfigNotice | null = null;

        if (knowledgePointsResult.status === "fulfilled") {
          nextKnowledgePoints = Array.isArray(knowledgePointsResult.value.data)
            ? knowledgePointsResult.value.data
            : [];
          setKnowledgePoints(nextKnowledgePoints);
          hasKnowledgePointSnapshotRef.current = true;
        } else {
          const message = getTeacherExamCreateRequestMessage(knowledgePointsResult.reason, "知识点加载失败");
          nextKnowledgePoints = hasKnowledgePointSnapshotRef.current
            ? knowledgePointsRef.current
            : [];
          if (!hasKnowledgePointSnapshotRef.current) {
            setKnowledgePoints([]);
          }
          nextNotice = {
            title: hasKnowledgePointSnapshotRef.current
              ? "已保留最近一次成功配置"
              : "部分配置加载失败",
            message: `知识点目录同步失败：${message}`
          };
        }

        if (classesResult.status === "rejected") {
          const message = getTeacherExamCreateRequestMessage(classesResult.reason, "班级加载失败");
          if (hasClassSnapshotRef.current) {
            setAuthRequired(false);
            setConfigNotice({
              title: "已保留最近一次成功配置",
              message: `班级配置刷新失败：${message}`
            });
            return formRef.current.classId;
          }

          setAuthRequired(false);
          setPageError(message);
          setClasses([]);
          setClassStudents([]);
          return "";
        }

        const nextClasses = Array.isArray(classesResult.value.data)
          ? classesResult.value.data
          : [];
        const { nextClassId, nextForm } = syncFormWithConfig(
          formRef.current,
          nextClasses,
          nextKnowledgePoints
        );

        setAuthRequired(false);
        setClasses(nextClasses);
        setForm(nextForm);
        hasClassSnapshotRef.current = true;
        setPageError(null);
        setConfigNotice(nextNotice);

        if (!nextNotice) {
          setLastLoadedAt(new Date().toISOString());
        }

        return nextClassId;
      } finally {
        if (configRequestIdRef.current === requestId) {
          setConfigLoading(false);
          setConfigRefreshing(false);
        }
      }
    },
    []
  );

  const loadStudents = useCallback(
    async (classId: string, options?: LoadStudentsOptions) => {
      if (!classId) {
        studentsRequestIdRef.current += 1;
        setClassStudents([]);
        setStudentsError(null);
        setStudentsLoading(false);
        return;
      }

      const requestId = studentsRequestIdRef.current + 1;
      studentsRequestIdRef.current = requestId;
      const preserveExisting = options?.preserveExisting === true;

      setStudentsLoading(true);
      setStudentsError(null);

      if (!preserveExisting) {
        setClassStudents([]);
      }

      try {
        const payload = await requestJson<ClassStudentsResponse>(
          `/api/teacher/classes/${classId}/students`
        );

        if (studentsRequestIdRef.current !== requestId) {
          return;
        }

        const students = Array.isArray(payload.data) ? payload.data : [];
        setClassStudents(students);
        setStudentsError(null);
        setAuthRequired(false);
        setForm((prev) => ({
          ...prev,
          studentIds: prev.studentIds.filter((studentId) =>
            students.some((student) => student.id === studentId)
          )
        }));
      } catch (nextError) {
        if (studentsRequestIdRef.current !== requestId) {
          return;
        }

        if (isAuthError(nextError)) {
          setAuthRequired(true);
          return;
        }

        setStudentsError(getTeacherExamCreateRequestMessage(nextError, "学生列表加载失败"));
        if (isTeacherExamCreateClassMissingError(nextError) || !preserveExisting) {
          setClassStudents([]);
          setForm((prev) => ({ ...prev, studentIds: [] }));
        }
      } finally {
        if (studentsRequestIdRef.current === requestId) {
          setStudentsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    void loadStudents(form.classId);
  }, [form.classId, loadStudents]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === form.classId),
    [classes, form.classId]
  );

  const filteredPoints = useMemo(() => {
    if (!selectedClass) return [];
    return knowledgePoints.filter(
      (item) =>
        item.subject === selectedClass.subject && item.grade === selectedClass.grade
    );
  }, [knowledgePoints, selectedClass]);

  const selectedPoint = useMemo(
    () => filteredPoints.find((item) => item.id === form.knowledgePointId) ?? null,
    [filteredPoints, form.knowledgePointId]
  );
  const scheduleStatus = useMemo(() => getScheduleStatus(form), [form]);
  const poolRisk = useMemo(() => getPoolRisk(form, filteredPoints), [filteredPoints, form]);
  const targetCount =
    form.publishMode === "targeted" ? form.studentIds.length : classStudents.length;
  const canSubmit =
    Boolean(form.classId && form.title.trim()) &&
    scheduleStatus.canSubmit &&
    !configLoading &&
    !saving &&
    !(form.publishMode === "targeted" && targetCount === 0) &&
    !(form.publishMode === "targeted" && studentsLoading);
  const classLabel = formatClassLabel(selectedClass);
  const scopeLabel = selectedPoint
    ? `${selectedPoint.chapter} · ${selectedPoint.title} · ${form.questionCount} 题`
    : `${
        SUBJECT_LABELS[selectedClass?.subject ?? ""] ?? "当前学科"
      }全范围 · ${form.questionCount} 题`;
  const targetLabel =
    form.publishMode === "targeted"
      ? `定向 ${targetCount}/${classStudents.length || 0} 人`
      : `全班 ${classStudents.length || 0} 人`;

  const refreshConfig = useCallback(async () => {
    const previousClassId = formRef.current.classId;
    const nextClassId = await loadConfig("refresh");

    if (nextClassId && nextClassId === previousClassId) {
      await loadStudents(nextClassId, { preserveExisting: true });
    }
  }, [loadConfig, loadStudents]);

  const retryStudents = useCallback(() => {
    void loadStudents(form.classId, { preserveExisting: true });
  }, [form.classId, loadStudents]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSaving(true);
      setSubmitError(null);
      setSubmitMessage(null);
      setSubmitSuggestions([]);
      setStageTrail([]);

      if (!scheduleStatus.canSubmit) {
        setSubmitError(scheduleStatus.title);
        setSaving(false);
        return;
      }

      try {
        const payload = await requestJson<CreateExamResponse>("/api/teacher/exams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classId: form.classId,
            title: form.title.trim(),
            description: form.description.trim(),
            publishMode: form.publishMode,
            antiCheatLevel: form.antiCheatLevel,
            studentIds: form.publishMode === "targeted" ? form.studentIds : undefined,
            startAt: form.startAt || undefined,
            endAt: form.endAt || undefined,
            durationMinutes: form.durationMinutes || undefined,
            questionCount: form.questionCount,
            knowledgePointId: form.knowledgePointId || undefined,
            difficulty: form.difficulty || undefined,
            questionType: form.questionType || undefined,
            includeIsolated: form.includeIsolated
          })
        });

        const warnings = Array.isArray(payload.data?.warnings)
          ? payload.data.warnings.filter(Boolean)
          : [];
        setSubmitMessage(
          warnings.length
            ? `${payload.message ?? "考试发布成功"} ${warnings.join("；")}`
            : payload.message ?? "考试发布成功"
        );
        setAuthRequired(false);

        const examId = payload.data?.id;
        if (examId) {
          router.push(`/teacher/exams/${examId}`);
          return;
        }

        router.push("/teacher/exams");
      } catch (nextError) {
        if (isAuthError(nextError)) {
          setAuthRequired(true);
          return;
        }

        const details =
          getRequestErrorPayload<CreateExamErrorPayload>(nextError)?.details;
        setSubmitError(getTeacherExamCreateRequestMessage(nextError, "发布失败"));
        setSubmitSuggestions(
          Array.isArray(details?.suggestions)
            ? details.suggestions.filter(Boolean)
            : []
        );
        setStageTrail(
          Array.isArray(details?.stageTrail) ? details.stageTrail : []
        );
      } finally {
        setSaving(false);
      }
    },
    [form, router, scheduleStatus]
  );

  return {
    classes,
    knowledgePoints,
    classStudents,
    configLoading,
    configRefreshing,
    studentsLoading,
    authRequired,
    pageError,
    configNotice,
    studentsError,
    saving,
    submitError,
    submitMessage,
    submitSuggestions,
    stageTrail,
    lastLoadedAt,
    form,
    setForm,
    selectedClass,
    filteredPoints,
    selectedPoint,
    scheduleStatus,
    poolRisk,
    targetCount,
    canSubmit,
    classLabel,
    scopeLabel,
    targetLabel,
    loadConfig,
    refreshConfig,
    retryStudents,
    handleSubmit
  };
}
