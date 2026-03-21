import { useEffect, type MutableRefObject } from "react";
import type { FormState, KnowledgePoint } from "./types";

type LoadStudentsOptions = {
  preserveExisting?: boolean;
};

type TeacherExamCreatePageEffectsOptions = {
  formRef: MutableRefObject<FormState>;
  knowledgePointsRef: MutableRefObject<KnowledgePoint[]>;
  form: FormState;
  knowledgePoints: KnowledgePoint[];
  loadConfig: (mode?: "initial" | "refresh") => Promise<string>;
  loadStudents: (
    classId: string,
    options?: LoadStudentsOptions
  ) => Promise<void>;
};

export function useTeacherExamCreatePageEffects({
  formRef,
  knowledgePointsRef,
  form,
  knowledgePoints,
  loadConfig,
  loadStudents
}: TeacherExamCreatePageEffectsOptions) {
  useEffect(() => {
    formRef.current = form;
  }, [form, formRef]);

  useEffect(() => {
    knowledgePointsRef.current = knowledgePoints;
  }, [knowledgePoints, knowledgePointsRef]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    void loadStudents(form.classId);
  }, [form.classId, loadStudents]);
}
