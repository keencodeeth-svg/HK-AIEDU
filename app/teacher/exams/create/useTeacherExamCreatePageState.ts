import { useRef, useState } from "react";
import type {
  ClassItem,
  ClassStudent,
  ConfigNotice,
  FormState,
  KnowledgePoint,
  StageTrailItem
} from "./types";
import {
  getTeacherExamCreatePageDerivedState,
  INITIAL_TEACHER_EXAM_CREATE_FORM
} from "./utils";

export function useTeacherExamCreatePageState() {
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
  const [form, setForm] = useState<FormState>(INITIAL_TEACHER_EXAM_CREATE_FORM);

  const formRef = useRef<FormState>(INITIAL_TEACHER_EXAM_CREATE_FORM);
  const knowledgePointsRef = useRef<KnowledgePoint[]>([]);
  const configRequestIdRef = useRef(0);
  const studentsRequestIdRef = useRef(0);
  const hasClassSnapshotRef = useRef(false);
  const hasKnowledgePointSnapshotRef = useRef(false);

  const derivedState = getTeacherExamCreatePageDerivedState({
    classes,
    knowledgePoints,
    classStudents,
    form,
    configLoading,
    saving,
    studentsLoading,
    lastLoadedAt
  });

  return {
    formRef,
    knowledgePointsRef,
    configRequestIdRef,
    studentsRequestIdRef,
    hasClassSnapshotRef,
    hasKnowledgePointSnapshotRef,
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
    selectedClass: derivedState.selectedClass,
    filteredPoints: derivedState.filteredPoints,
    selectedPoint: derivedState.selectedPoint,
    scheduleStatus: derivedState.scheduleStatus,
    poolRisk: derivedState.poolRisk,
    targetCount: derivedState.targetCount,
    canSubmit: derivedState.canSubmit,
    classLabel: derivedState.classLabel,
    scopeLabel: derivedState.scopeLabel,
    targetLabel: derivedState.targetLabel,
    lastLoadedAtLabel: derivedState.lastLoadedAtLabel,
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
    setSaving,
    setSubmitError,
    setSubmitMessage,
    setSubmitSuggestions,
    setStageTrail,
    setLastLoadedAt,
    setForm
  };
}
