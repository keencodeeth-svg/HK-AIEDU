"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  ClassItem,
  ClassStudent,
  ConfigNotice,
  FormState,
  KnowledgePoint
} from "./types";
import {
  getTeacherExamCreateRequestMessage,
  isTeacherExamCreateClassMissingError,
  pruneTeacherExamCreateStudentIds,
  syncTeacherExamCreateFormWithConfig
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type TeacherClassesResponse = {
  data?: ClassItem[];
};

type KnowledgePointListResponse = {
  data?: KnowledgePoint[];
};

type ClassStudentsResponse = {
  data?: ClassStudent[];
};

type TeacherExamCreateLoadConfigMode = "initial" | "refresh";

type LoadStudentsOptions = {
  preserveExisting?: boolean;
};

type TeacherExamCreatePageLoadersOptions = {
  formRef: MutableRefObject<FormState>;
  knowledgePointsRef: MutableRefObject<KnowledgePoint[]>;
  configRequestIdRef: MutableRefObject<number>;
  studentsRequestIdRef: MutableRefObject<number>;
  hasClassSnapshotRef: MutableRefObject<boolean>;
  hasKnowledgePointSnapshotRef: MutableRefObject<boolean>;
  setClasses: Setter<ClassItem[]>;
  setKnowledgePoints: Setter<KnowledgePoint[]>;
  setClassStudents: Setter<ClassStudent[]>;
  setConfigLoading: Setter<boolean>;
  setConfigRefreshing: Setter<boolean>;
  setStudentsLoading: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setPageError: Setter<string | null>;
  setConfigNotice: Setter<ConfigNotice | null>;
  setStudentsError: Setter<string | null>;
  setLastLoadedAt: Setter<string | null>;
  setForm: Setter<FormState>;
};

export function useTeacherExamCreatePageLoaders({
  formRef,
  knowledgePointsRef,
  configRequestIdRef,
  studentsRequestIdRef,
  hasClassSnapshotRef,
  hasKnowledgePointSnapshotRef,
  setClasses,
  setKnowledgePoints,
  setClassStudents,
  setConfigLoading,
  setConfigRefreshing,
  setStudentsLoading,
  setAuthRequired,
  setPageError,
  setConfigNotice,
  setStudentsError,
  setLastLoadedAt,
  setForm
}: TeacherExamCreatePageLoadersOptions) {
  const loadConfig = useCallback(
    async (mode: TeacherExamCreateLoadConfigMode = "initial") => {
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
          const message = getTeacherExamCreateRequestMessage(
            knowledgePointsResult.reason,
            "知识点加载失败"
          );
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
          const message = getTeacherExamCreateRequestMessage(
            classesResult.reason,
            "班级加载失败"
          );
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
        const { nextClassId, nextForm } = syncTeacherExamCreateFormWithConfig(
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
    [
      configRequestIdRef,
      formRef,
      hasClassSnapshotRef,
      hasKnowledgePointSnapshotRef,
      knowledgePointsRef,
      setAuthRequired,
      setClasses,
      setClassStudents,
      setConfigLoading,
      setConfigNotice,
      setConfigRefreshing,
      setForm,
      setKnowledgePoints,
      setLastLoadedAt,
      setPageError
    ]
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
          studentIds: pruneTeacherExamCreateStudentIds(prev.studentIds, students)
        }));
      } catch (nextError) {
        if (studentsRequestIdRef.current !== requestId) {
          return;
        }

        if (isAuthError(nextError)) {
          setAuthRequired(true);
          return;
        }

        setStudentsError(
          getTeacherExamCreateRequestMessage(nextError, "学生列表加载失败")
        );
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
    [
      setAuthRequired,
      setClassStudents,
      setForm,
      setStudentsError,
      setStudentsLoading,
      studentsRequestIdRef
    ]
  );

  return {
    loadConfig,
    loadStudents
  };
}
