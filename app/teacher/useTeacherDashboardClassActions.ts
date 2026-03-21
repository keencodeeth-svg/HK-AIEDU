"use client";

import { useCallback, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { CourseModule } from "@/lib/modules";
import type {
  AssignmentFormState,
  AssignmentItem,
  ClassFormState,
  ClassItem,
  StudentFormState,
  TeacherJoinMode
} from "./types";
import {
  buildTeacherDashboardDefaultDueDate,
  getTeacherDashboardClassRequestMessage,
  incrementTeacherDashboardAssignmentCount,
  incrementTeacherDashboardStudentCount,
  isMissingTeacherDashboardClassError,
  isTeacherDashboardModuleMissingError,
  prependTeacherDashboardAssignment,
  prependTeacherDashboardClass,
  updateTeacherDashboardClassJoinCode,
  updateTeacherDashboardClassJoinMode
} from "./dashboard-utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type LoadAll = (options?: { background?: boolean; preserveFeedback?: boolean }) => Promise<void>;

type CreateClassResponse = {
  data?: Partial<ClassItem>;
};

type AddStudentResponse = {
  added?: boolean;
};

type CreateAssignmentResponse = {
  data?: Partial<AssignmentItem> & { moduleTitle?: string };
  message?: string;
};

type UpdateClassResponse = {
  data?: Partial<ClassItem>;
};

type TeacherDashboardClassActionsOptions = {
  classForm: ClassFormState;
  studentForm: StudentFormState;
  assignmentForm: AssignmentFormState;
  classes: ClassItem[];
  modules: CourseModule[];
  loadAll: LoadAll;
  removeClassFromDashboard: (classId: string) => void;
  setUnauthorized: Setter<boolean>;
  setLoading: Setter<boolean>;
  setMessage: Setter<string | null>;
  setError: Setter<string | null>;
  setAssignmentLoadError: Setter<string | null>;
  setAssignmentError: Setter<string | null>;
  setAssignmentMessage: Setter<string | null>;
  setClasses: Setter<ClassItem[]>;
  setAssignments: Setter<AssignmentItem[]>;
  setClassForm: Setter<ClassFormState>;
  setStudentForm: Setter<StudentFormState>;
  setAssignmentForm: Setter<AssignmentFormState>;
};

function refreshTeacherDashboard(loadAll: LoadAll) {
  void loadAll({ background: true, preserveFeedback: true });
}

export function useTeacherDashboardClassActions({
  classForm,
  studentForm,
  assignmentForm,
  classes,
  modules,
  loadAll,
  removeClassFromDashboard,
  setUnauthorized,
  setLoading,
  setMessage,
  setError,
  setAssignmentLoadError,
  setAssignmentError,
  setAssignmentMessage,
  setClasses,
  setAssignments,
  setClassForm,
  setStudentForm,
  setAssignmentForm
}: TeacherDashboardClassActionsOptions) {
  const handleCreateClass = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const payload = await requestJson<CreateClassResponse>("/api/teacher/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(classForm)
      });

      const createdClass = payload.data ?? {};
      if (createdClass.id) {
        const createdClassId = createdClass.id;
        const defaultDue = buildTeacherDashboardDefaultDueDate();

        setClasses((previous) =>
          prependTeacherDashboardClass(previous, createdClass, classForm)
        );
        setStudentForm((previous) => ({
          ...previous,
          classId: previous.classId || createdClassId
        }));
        setAssignmentForm((previous) => ({
          ...previous,
          classId: previous.classId || createdClassId,
          dueDate: previous.dueDate || defaultDue
        }));
      }

      setMessage("班级创建成功。");
      setClassForm((previous) => ({ ...previous, name: "" }));
      refreshTeacherDashboard(loadAll);
    } catch (error) {
      if (isAuthError(error)) {
        setUnauthorized(true);
      } else {
        setError(getTeacherDashboardClassRequestMessage(error, "创建班级失败"));
      }
    } finally {
      setLoading(false);
    }
  }, [
    classForm,
    loadAll,
    setAssignmentForm,
    setClassForm,
    setClasses,
    setError,
    setLoading,
    setMessage,
    setStudentForm,
    setUnauthorized
  ]);

  const handleAddStudent = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studentForm.classId) {
      return;
    }

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
        setClasses((previous) =>
          incrementTeacherDashboardStudentCount(previous, studentForm.classId)
        );
      }

      setMessage(payload.added ? "已加入班级。" : "学生已在班级中。");
      setStudentForm((previous) => ({ ...previous, email: "" }));
      refreshTeacherDashboard(loadAll);
    } catch (error) {
      if (isAuthError(error)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardClassRequestMessage(error, "添加学生失败");
        if (isMissingTeacherDashboardClassError(error)) {
          removeClassFromDashboard(studentForm.classId);
          refreshTeacherDashboard(loadAll);
        }
        setError(nextMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [
    loadAll,
    removeClassFromDashboard,
    setClasses,
    setError,
    setLoading,
    setMessage,
    setStudentForm,
    setUnauthorized,
    studentForm.classId,
    studentForm.email
  ]);

  const handleCreateAssignment = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignmentForm.classId) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    setAssignmentLoadError(null);
    setAssignmentError(null);
    setAssignmentMessage(null);

    try {
      const payload = await requestJson<CreateAssignmentResponse>("/api/teacher/assignments", {
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

      const createdAssignment = payload.data ?? {};
      const targetClass = classes.find((item) => item.id === assignmentForm.classId);
      const selectedModule = modules.find((item) => item.id === assignmentForm.moduleId);

      if (createdAssignment.id && targetClass) {
        setAssignments((previous) =>
          prependTeacherDashboardAssignment(
            previous,
            createdAssignment,
            targetClass,
            assignmentForm,
            selectedModule
          )
        );
        setClasses((previous) =>
          incrementTeacherDashboardAssignmentCount(previous, targetClass.id)
        );
      }

      const nextMessage = payload.message ?? "作业发布成功。";
      setMessage(nextMessage);
      setAssignmentMessage(nextMessage);
      setAssignmentForm((previous) => ({
        ...previous,
        title: "",
        description: "",
        gradingFocus: ""
      }));
      refreshTeacherDashboard(loadAll);
    } catch (error) {
      if (isAuthError(error)) {
        setUnauthorized(true);
        return;
      }

      const nextMessage = getTeacherDashboardClassRequestMessage(error, "发布作业失败");
      if (isTeacherDashboardModuleMissingError(error)) {
        setAssignmentForm((previous) => ({ ...previous, moduleId: "" }));
      }
      if (isMissingTeacherDashboardClassError(error)) {
        removeClassFromDashboard(assignmentForm.classId);
        refreshTeacherDashboard(loadAll);
      }
      setError(nextMessage);
      setAssignmentError(nextMessage);
    } finally {
      setLoading(false);
    }
  }, [
    assignmentForm,
    classes,
    loadAll,
    modules,
    removeClassFromDashboard,
    setAssignmentError,
    setAssignmentForm,
    setAssignmentLoadError,
    setAssignmentMessage,
    setAssignments,
    setClasses,
    setError,
    setLoading,
    setMessage,
    setUnauthorized
  ]);

  const handleUpdateJoinMode = useCallback(async (classId: string, joinMode: TeacherJoinMode) => {
    setError(null);
    setMessage(null);

    try {
      const payload = await requestJson<UpdateClassResponse>(`/api/teacher/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinMode })
      });

      setClasses((previous) =>
        updateTeacherDashboardClassJoinMode(
          previous,
          classId,
          payload.data?.joinMode ?? joinMode
        )
      );
      setMessage("班级加入方式已更新。");
      refreshTeacherDashboard(loadAll);
    } catch (error) {
      if (isAuthError(error)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardClassRequestMessage(error, "更新加入方式失败");
        if (isMissingTeacherDashboardClassError(error)) {
          removeClassFromDashboard(classId);
          refreshTeacherDashboard(loadAll);
        }
        setError(nextMessage);
      }
    }
  }, [
    loadAll,
    removeClassFromDashboard,
    setClasses,
    setError,
    setMessage,
    setUnauthorized
  ]);

  const handleRegenerateCode = useCallback(async (classId: string) => {
    setError(null);
    setMessage(null);

    try {
      const payload = await requestJson<UpdateClassResponse>(
        `/api/teacher/classes/${classId}/join-code`,
        { method: "POST" }
      );

      setClasses((previous) =>
        updateTeacherDashboardClassJoinCode(previous, classId, payload.data?.joinCode)
      );
      setMessage("邀请码已重新生成。");
      refreshTeacherDashboard(loadAll);
    } catch (error) {
      if (isAuthError(error)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardClassRequestMessage(error, "重新生成邀请码失败");
        if (isMissingTeacherDashboardClassError(error)) {
          removeClassFromDashboard(classId);
          refreshTeacherDashboard(loadAll);
        }
        setError(nextMessage);
      }
    }
  }, [
    loadAll,
    removeClassFromDashboard,
    setClasses,
    setError,
    setMessage,
    setUnauthorized
  ]);

  return {
    handleCreateClass,
    handleAddStudent,
    handleCreateAssignment,
    handleUpdateJoinMode,
    handleRegenerateCode
  };
}
