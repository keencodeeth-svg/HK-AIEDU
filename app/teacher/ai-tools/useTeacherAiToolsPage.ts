"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getRequestErrorPayload,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  ClassItem,
  KnowledgePoint,
  OutlineFormState,
  OutlineResult,
  PaperFormState,
  PaperGenerationResult,
  PaperQuickFixAction,
  QuestionCheckFormState,
  QuestionCheckResult,
  ReviewPackDispatchOptions,
  ReviewPackDispatchPayload,
  ReviewPackDispatchQuality,
  ReviewPackDispatchResult,
  ReviewPackFailedItem,
  ReviewPackRelaxedItem,
  ReviewPackResult,
  ReviewPackReviewSheetItem,
  WrongReviewFormState,
  WrongReviewResult
} from "./types";
import {
  getTeacherAiToolsRequestMessage,
  isMissingTeacherAiToolsClassError,
  isMissingTeacherAiToolsQuestionError,
  resolveTeacherAiToolsClassId
} from "./utils";

const TEACHER_AI_TOOLS_GUIDE_KEY = "guide:teacher-ai-tools:v1";

type TeacherClassesResponse = {
  data?: ClassItem[];
};

type KnowledgePointsResponse = {
  data?: KnowledgePoint[];
};

type PaperGenerateResponse = {
  data?: PaperGenerationResult;
};

type OutlineResponse = {
  data?: OutlineResult;
};

type WrongReviewResponse = {
  data?: WrongReviewResult;
};

type ReviewPackResponse = {
  data?: ReviewPackResult;
};

type QuestionCheckResponse = {
  data?: QuestionCheckResult;
};

type ReviewPackDispatchResponse = {
  data?: ReviewPackDispatchPayload | null;
};

type PaperGenerateErrorPayload = {
  details?: {
    suggestions?: string[];
  };
};

export function useTeacherAiToolsPage() {
  const bootstrapRequestIdRef = useRef(0);
  const hasClassesSnapshotRef = useRef(false);
  const hasKnowledgePointsSnapshotRef = useRef(false);
  const previousPaperClassIdRef = useRef("");
  const previousOutlineClassIdRef = useRef("");
  const previousWrongClassIdRef = useRef("");

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [bootstrapNotice, setBootstrapNotice] = useState<string | null>(null);
  const [knowledgePointsNotice, setKnowledgePointsNotice] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [paperForm, setPaperForm] = useState<PaperFormState>({
    classId: "",
    knowledgePointIds: [],
    difficulty: "all",
    questionType: "all",
    durationMinutes: 40,
    questionCount: 0,
    mode: "ai",
    includeIsolated: false
  });
  const [paperResult, setPaperResult] = useState<PaperGenerationResult | null>(null);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [paperErrorSuggestions, setPaperErrorSuggestions] = useState<string[]>([]);
  const [outlineForm, setOutlineForm] = useState<OutlineFormState>({ classId: "", topic: "", knowledgePointIds: [] });
  const [outlineResult, setOutlineResult] = useState<OutlineResult | null>(null);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [wrongForm, setWrongForm] = useState<WrongReviewFormState>({ classId: "", rangeDays: 7 });
  const [wrongResult, setWrongResult] = useState<WrongReviewResult | null>(null);
  const [wrongError, setWrongError] = useState<string | null>(null);
  const [reviewPackResult, setReviewPackResult] = useState<ReviewPackResult | null>(null);
  const [reviewPackError, setReviewPackError] = useState<string | null>(null);
  const [reviewPackAssigningId, setReviewPackAssigningId] = useState<string | null>(null);
  const [reviewPackAssigningAll, setReviewPackAssigningAll] = useState(false);
  const [reviewPackAssignMessage, setReviewPackAssignMessage] = useState<string | null>(null);
  const [reviewPackAssignError, setReviewPackAssignError] = useState<string | null>(null);
  const [reviewPackDispatchIncludeIsolated, setReviewPackDispatchIncludeIsolated] = useState(false);
  const [reviewPackDispatchQuality, setReviewPackDispatchQuality] = useState<ReviewPackDispatchQuality | null>(null);
  const [reviewPackFailedItems, setReviewPackFailedItems] = useState<ReviewPackFailedItem[]>([]);
  const [reviewPackRelaxedItems, setReviewPackRelaxedItems] = useState<ReviewPackRelaxedItem[]>([]);
  const [reviewPackRetryingFailed, setReviewPackRetryingFailed] = useState(false);
  const [showGuideCard, setShowGuideCard] = useState(true);
  const [paperAutoFixing, setPaperAutoFixing] = useState(false);
  const [paperAutoFixHint, setPaperAutoFixHint] = useState<string | null>(null);
  const [checkForm, setCheckForm] = useState<QuestionCheckFormState>({
    questionId: "",
    stem: "",
    options: ["", "", "", ""],
    answer: "",
    explanation: ""
  });
  const [checkResult, setCheckResult] = useState<QuestionCheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetPaperScope = useCallback((nextClassId = "") => {
    setPaperForm((prev) => ({
      ...prev,
      classId: nextClassId,
      knowledgePointIds: []
    }));
    setPaperResult(null);
    setPaperError(null);
    setPaperErrorSuggestions([]);
    setPaperAutoFixHint(null);
  }, []);

  const resetOutlineScope = useCallback((nextClassId = "") => {
    setOutlineForm((prev) => ({
      ...prev,
      classId: nextClassId,
      knowledgePointIds: []
    }));
    setOutlineResult(null);
    setOutlineError(null);
  }, []);

  const resetWrongScope = useCallback((nextClassId = "") => {
    setWrongForm((prev) => ({
      ...prev,
      classId: nextClassId
    }));
    setWrongResult(null);
    setWrongError(null);
    setReviewPackResult(null);
    setReviewPackError(null);
    setReviewPackAssigningId(null);
    setReviewPackAssigningAll(false);
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);
    setReviewPackDispatchQuality(null);
    setReviewPackFailedItems([]);
    setReviewPackRelaxedItems([]);
    setReviewPackRetryingFailed(false);
  }, []);

  const handleAuthRequired = useCallback(() => {
    hasClassesSnapshotRef.current = false;
    hasKnowledgePointsSnapshotRef.current = false;
    previousPaperClassIdRef.current = "";
    previousOutlineClassIdRef.current = "";
    previousWrongClassIdRef.current = "";

    setClasses([]);
    setKnowledgePoints([]);
    resetPaperScope("");
    resetOutlineScope("");
    resetWrongScope("");
    setCheckResult(null);
    setCheckError(null);
    setPageReady(false);
    setPageError(null);
    setBootstrapNotice(null);
    setKnowledgePointsNotice(null);
    setLastLoadedAt(null);
    setAuthRequired(true);
  }, [resetOutlineScope, resetPaperScope, resetWrongScope]);

  const loadBootstrapData = useCallback(async () => {
    const requestId = bootstrapRequestIdRef.current + 1;
    bootstrapRequestIdRef.current = requestId;
    setAuthRequired(false);
    setPageLoading(true);
    setPageError(null);
    setBootstrapNotice(null);
    setKnowledgePointsNotice(null);

    try {
      const [classesResult, knowledgePointsResult] = await Promise.allSettled([
        requestJson<TeacherClassesResponse>("/api/teacher/classes"),
        requestJson<KnowledgePointsResponse>("/api/knowledge-points")
      ]);

      if (requestId !== bootstrapRequestIdRef.current) {
        return;
      }

      const authError =
        (classesResult.status === "rejected" && isAuthError(classesResult.reason)) ||
        (knowledgePointsResult.status === "rejected" &&
          isAuthError(knowledgePointsResult.reason));

      if (authError) {
        handleAuthRequired();
        return;
      }

      let classesReady = false;
      if (classesResult.status === "fulfilled") {
        setClasses(classesResult.value.data ?? []);
        hasClassesSnapshotRef.current = true;
        classesReady = true;
        setLastLoadedAt(new Date().toISOString());
      } else {
        const nextMessage = getTeacherAiToolsRequestMessage(
          classesResult.reason,
          "班级加载失败",
          "bootstrap"
        );
        if (hasClassesSnapshotRef.current) {
          setBootstrapNotice(`班级数据刷新失败，已保留最近一次结果：${nextMessage}`);
          classesReady = true;
        } else {
          setClasses([]);
          setPageError(nextMessage);
        }
      }

      if (knowledgePointsResult.status === "fulfilled") {
        setKnowledgePoints(knowledgePointsResult.value.data ?? []);
        setKnowledgePointsNotice(null);
        hasKnowledgePointsSnapshotRef.current = true;
      } else {
        const nextMessage = getTeacherAiToolsRequestMessage(
          knowledgePointsResult.reason,
          "知识点加载失败",
          "bootstrap"
        );
        if (hasKnowledgePointsSnapshotRef.current) {
          setKnowledgePointsNotice(`已保留最近一次知识点目录：${nextMessage}`);
        } else {
          setKnowledgePoints([]);
          setKnowledgePointsNotice(nextMessage);
        }
      }

      if (classesReady) {
        setPageReady(true);
      }
    } finally {
      if (requestId === bootstrapRequestIdRef.current) {
        setPageLoading(false);
      }
    }
  }, [handleAuthRequired]);

  useEffect(() => {
    void loadBootstrapData();
  }, [loadBootstrapData]);

  useEffect(() => {
    try {
      const hidden = window.localStorage.getItem(TEACHER_AI_TOOLS_GUIDE_KEY) === "hidden";
      setShowGuideCard(!hidden);
    } catch {
      setShowGuideCard(true);
    }
  }, []);

  useEffect(() => {
    const nextPaperClassId = resolveTeacherAiToolsClassId(paperForm.classId, classes);
    if (nextPaperClassId !== paperForm.classId) {
      resetPaperScope(nextPaperClassId);
    }

    const nextOutlineClassId = resolveTeacherAiToolsClassId(outlineForm.classId, classes);
    if (nextOutlineClassId !== outlineForm.classId) {
      resetOutlineScope(nextOutlineClassId);
    }

    const nextWrongClassId = resolveTeacherAiToolsClassId(wrongForm.classId, classes);
    if (nextWrongClassId !== wrongForm.classId) {
      resetWrongScope(nextWrongClassId);
    }
  }, [
    classes,
    outlineForm.classId,
    paperForm.classId,
    resetOutlineScope,
    resetPaperScope,
    resetWrongScope,
    wrongForm.classId
  ]);

  const paperClass = classes.find((item) => item.id === paperForm.classId);
  const outlineClass = classes.find((item) => item.id === outlineForm.classId);

  const paperPoints = useMemo(() => {
    if (!paperClass) return [];
    return knowledgePoints.filter((kp) => kp.subject === paperClass.subject && kp.grade === paperClass.grade);
  }, [knowledgePoints, paperClass]);

  const outlinePoints = useMemo(() => {
    if (!outlineClass) return [];
    return knowledgePoints.filter((kp) => kp.subject === outlineClass.subject && kp.grade === outlineClass.grade);
  }, [knowledgePoints, outlineClass]);
  const paperPointIdSet = useMemo(() => new Set(paperPoints.map((kp) => kp.id)), [paperPoints]);
  const outlinePointIdSet = useMemo(() => new Set(outlinePoints.map((kp) => kp.id)), [outlinePoints]);

  useEffect(() => {
    if (previousPaperClassIdRef.current && previousPaperClassIdRef.current !== paperForm.classId) {
      setPaperResult(null);
      setPaperError(null);
      setPaperErrorSuggestions([]);
      setPaperAutoFixHint(null);
    }
    previousPaperClassIdRef.current = paperForm.classId;
  }, [paperForm.classId]);

  useEffect(() => {
    setPaperForm((prev) => {
      const nextKnowledgePointIds = prev.knowledgePointIds.filter((id) => paperPointIdSet.has(id));
      return nextKnowledgePointIds.length === prev.knowledgePointIds.length
        ? prev
        : { ...prev, knowledgePointIds: nextKnowledgePointIds };
    });
  }, [paperPointIdSet]);

  useEffect(() => {
    if (previousOutlineClassIdRef.current && previousOutlineClassIdRef.current !== outlineForm.classId) {
      setOutlineResult(null);
      setOutlineError(null);
    }
    previousOutlineClassIdRef.current = outlineForm.classId;
  }, [outlineForm.classId]);

  useEffect(() => {
    setOutlineForm((prev) => {
      const nextKnowledgePointIds = prev.knowledgePointIds.filter((id) => outlinePointIdSet.has(id));
      return nextKnowledgePointIds.length === prev.knowledgePointIds.length
        ? prev
        : { ...prev, knowledgePointIds: nextKnowledgePointIds };
    });
  }, [outlinePointIdSet]);

  useEffect(() => {
    if (previousWrongClassIdRef.current && previousWrongClassIdRef.current !== wrongForm.classId) {
      setWrongResult(null);
      setWrongError(null);
      setReviewPackResult(null);
      setReviewPackError(null);
      setReviewPackAssigningId(null);
      setReviewPackAssigningAll(false);
      setReviewPackAssignMessage(null);
      setReviewPackAssignError(null);
      setReviewPackDispatchQuality(null);
      setReviewPackFailedItems([]);
      setReviewPackRelaxedItems([]);
      setReviewPackRetryingFailed(false);
    }
    previousWrongClassIdRef.current = wrongForm.classId;
  }, [wrongForm.classId]);

  async function requestGeneratePaper(nextForm: PaperFormState) {
    setLoading(true);
    setPaperError(null);
    setPaperErrorSuggestions([]);
    try {
      const payload = await requestJson<PaperGenerateResponse>(
        "/api/teacher/paper/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextForm)
        }
      );
      setPaperResult(payload.data ?? null);
      return true;
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return false;
      }
      setPaperResult(null);
      const nextMessage = getTeacherAiToolsRequestMessage(nextError, "组卷失败，请稍后重试", "paper");
      const payload =
        getRequestErrorPayload<PaperGenerateErrorPayload>(nextError);
      if (isMissingTeacherAiToolsClassError(nextError)) {
        resetPaperScope("");
        void loadBootstrapData();
      }
      setPaperError(nextMessage);
      setPaperErrorSuggestions(
        Array.isArray(payload?.details?.suggestions)
          ? payload.details.suggestions
          : []
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleGeneratePaper(event: FormEvent) {
    event.preventDefault();
    if (!paperForm.classId) return;
    setPaperAutoFixHint(null);
    await requestGeneratePaper(paperForm);
  }

  function hideGuideCard() {
    setShowGuideCard(false);
    try {
      window.localStorage.setItem(TEACHER_AI_TOOLS_GUIDE_KEY, "hidden");
    } catch {
      // ignore localStorage errors
    }
  }

  function showGuideAgain() {
    setShowGuideCard(true);
    try {
      window.localStorage.removeItem(TEACHER_AI_TOOLS_GUIDE_KEY);
    } catch {
      // ignore localStorage errors
    }
  }

  async function applyPaperQuickFix(action: PaperQuickFixAction) {
    if (!paperForm.classId || paperAutoFixing || loading) return;
    const nextForm: PaperFormState = { ...paperForm };
    let hint = "";
    if (action === "clear_filters") {
      nextForm.knowledgePointIds = [];
      nextForm.difficulty = "all";
      nextForm.questionType = "all";
      hint = "已清空知识点/难度/题型筛选，正在重试。";
    } else if (action === "switch_ai") {
      nextForm.mode = "ai";
      hint = "已切换为 AI 补题模式，正在重试。";
    } else if (action === "reduce_count") {
      if (nextForm.questionCount <= 0) {
        nextForm.questionCount = Math.max(6, Math.floor(nextForm.durationMinutes / 3));
      } else {
        nextForm.questionCount = Math.max(5, nextForm.questionCount - 3);
      }
      hint = `已降低题量到 ${nextForm.questionCount} 题，正在重试。`;
    } else if (action === "allow_isolated") {
      nextForm.includeIsolated = true;
      hint = "已允许使用隔离池高风险题，正在重试（请人工复核）。";
    }
    setPaperForm(nextForm);
    setPaperAutoFixHint(hint);
    setPaperAutoFixing(true);
    try {
      await requestGeneratePaper(nextForm);
    } finally {
      setPaperAutoFixing(false);
    }
  }

  async function handleGenerateOutline(event: FormEvent) {
    event.preventDefault();
    if (!outlineForm.classId || !outlineForm.topic) return;
    setLoading(true);
    setOutlineError(null);
    try {
      const payload = await requestJson<OutlineResponse>(
        "/api/teacher/lesson/outline",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(outlineForm)
        }
      );
      setOutlineResult(payload.data ?? null);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      setOutlineResult(null);
      const nextMessage = getTeacherAiToolsRequestMessage(nextError, "生成讲稿失败，请稍后重试", "outline");
      if (isMissingTeacherAiToolsClassError(nextError)) {
        resetOutlineScope("");
        void loadBootstrapData();
      }
      setOutlineError(nextMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleWrongReview(event: FormEvent) {
    event.preventDefault();
    if (!wrongForm.classId) return;
    setLoading(true);
    setWrongError(null);
    try {
      const payload = await requestJson<WrongReviewResponse>(
        "/api/teacher/lesson/wrong-review",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wrongForm)
        }
      );
      setWrongResult(payload.data ?? null);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      setWrongResult(null);
      const nextMessage = getTeacherAiToolsRequestMessage(nextError, "生成讲评脚本失败，请稍后重试", "wrong_review");
      if (isMissingTeacherAiToolsClassError(nextError)) {
        resetWrongScope("");
        void loadBootstrapData();
      }
      setWrongError(nextMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewPack(event: FormEvent) {
    event.preventDefault();
    if (!wrongForm.classId) return;
    setReviewPackError(null);
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);
    setReviewPackDispatchQuality(null);
    setReviewPackFailedItems([]);
    setReviewPackRelaxedItems([]);
    setLoading(true);
    try {
      const payload = await requestJson<ReviewPackResponse>(
        "/api/teacher/lesson/review-pack",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wrongForm)
        }
      );
      setReviewPackResult(payload.data ?? null);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      setReviewPackResult(null);
      const nextMessage = getTeacherAiToolsRequestMessage(nextError, "生成讲评包失败，请稍后重试", "review_pack");
      if (isMissingTeacherAiToolsClassError(nextError)) {
        resetWrongScope("");
        void loadBootstrapData();
      }
      setReviewPackError(nextMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckQuestion(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setCheckError(null);
    try {
      const payload = await requestJson<QuestionCheckResponse>(
        "/api/teacher/questions/check",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: checkForm.questionId || undefined,
            stem: checkForm.stem,
            options: checkForm.options,
            answer: checkForm.answer,
            explanation: checkForm.explanation
          })
        }
      );
      setCheckResult(payload.data ?? null);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      setCheckResult(null);
      const nextMessage = getTeacherAiToolsRequestMessage(nextError, "题目纠错失败，请稍后重试", "question_check");
      if (isMissingTeacherAiToolsQuestionError(nextError)) {
        setCheckForm((prev) => ({ ...prev, questionId: "" }));
      }
      setCheckError(nextMessage);
    } finally {
      setLoading(false);
    }
  }

  async function dispatchReviewPackItems(
    items: ReviewPackReviewSheetItem[],
    options?: ReviewPackDispatchOptions
  ): Promise<ReviewPackDispatchResult> {
    try {
      const payload = await requestJson<ReviewPackDispatchResponse>(
        "/api/teacher/lesson/review-pack/dispatch",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classId: wrongForm.classId,
            items,
            includeIsolated: options?.includeIsolated ?? reviewPackDispatchIncludeIsolated,
            autoRelaxOnInsufficient: options?.autoRelaxOnInsufficient ?? false
          })
        }
      );
      return {
        ok: true,
        data: payload.data ?? null
      };
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else if (isMissingTeacherAiToolsClassError(nextError)) {
        resetWrongScope("");
        void loadBootstrapData();
      }
      return {
        ok: false,
        error: getTeacherAiToolsRequestMessage(nextError, "下发失败", "review_pack_dispatch")
      };
    }
  }

  async function handleAssignReviewSheet(item: ReviewPackReviewSheetItem) {
    if (!wrongForm.classId) return;
    const assignKey = String(item?.id ?? "");
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);
    setReviewPackFailedItems([]);
    setReviewPackRelaxedItems([]);
    setReviewPackAssigningId(assignKey);

    try {
      const result = await dispatchReviewPackItems([item]);
      if (!result.ok) {
        setReviewPackAssignError(result.error);
        return;
      }
      const summary = result.data?.summary;
      const failed = result.data?.failed ?? [];
      setReviewPackFailedItems(failed);
      setReviewPackRelaxedItems(summary?.relaxed ?? []);
      setReviewPackDispatchQuality(summary?.qualityGovernance ?? null);
      if (summary && summary.created > 0) {
        const quality = summary?.qualityGovernance;
        setReviewPackAssignMessage(
          `已下发 ${summary.created}/${summary.requested} 条，通知学生 ${summary.studentsNotified} 人，家长 ${summary.parentsNotified} 人。${
            quality && !quality.includeIsolated ? ` 已排除隔离池候选 ${quality.isolatedExcludedCount} 次。` : ""
          }${(summary?.relaxedCount ?? 0) > 0 ? ` 已自动放宽 ${summary.relaxedCount} 条。` : ""}`
        );
      } else {
        setReviewPackAssignMessage(null);
      }
      if (failed.length > 0) {
        setReviewPackAssignError(failed[0]?.reason ?? "下发失败");
      }
    } catch {
      setReviewPackAssignError("布置失败");
    } finally {
      setReviewPackAssigningId(null);
    }
  }

  async function handleAssignAllReviewSheets() {
    if (!wrongForm.classId) return;
    const items = reviewPackResult?.afterClassReviewSheet ?? [];
    if (!items.length) {
      setReviewPackAssignMessage(null);
      setReviewPackAssignError("暂无可布置的复练单");
      return;
    }
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);
    setReviewPackFailedItems([]);
    setReviewPackRelaxedItems([]);
    setReviewPackAssigningAll(true);

    let summary = null;
    let failedItems: ReviewPackFailedItem[] = [];
    try {
      const result = await dispatchReviewPackItems(items);
      if (!result.ok) {
        setReviewPackAssignError(result.error);
        return;
      }
      summary = result.data?.summary ?? null;
      failedItems = result.data?.failed ?? [];
      setReviewPackFailedItems(failedItems);
      setReviewPackRelaxedItems(summary?.relaxed ?? []);
      setReviewPackDispatchQuality(summary?.qualityGovernance ?? null);
    } catch {
      setReviewPackAssignError("批量下发失败");
      return;
    } finally {
      setReviewPackAssigningAll(false);
    }

    if (summary && summary.created > 0) {
      const quality = summary?.qualityGovernance;
      setReviewPackAssignMessage(
        `已批量下发 ${summary.created}/${summary.requested} 条，通知学生 ${summary.studentsNotified} 人，家长 ${summary.parentsNotified} 人。${
          quality && !quality.includeIsolated ? ` 已排除隔离池候选 ${quality.isolatedExcludedCount} 次。` : ""
        }${(summary?.relaxedCount ?? 0) > 0 ? ` 已自动放宽 ${summary.relaxedCount} 条。` : ""}`
      );
    } else {
      setReviewPackAssignMessage(null);
    }

    if (failedItems.length > 0) {
      const brief = failedItems
        .slice(0, 3)
        .map((item) => `${item?.title ?? "未命名复练"}：${item?.reason ?? "下发失败"}`)
        .join("；");
      setReviewPackAssignError(`失败 ${failedItems.length} 条：${brief}`);
    } else {
      setReviewPackAssignError(null);
    }
  }

  async function handleRetryFailedReviewSheets() {
    if (!wrongForm.classId || !reviewPackFailedItems.length) return;
    const retryItems = reviewPackFailedItems
      .map((item) => item?.item)
      .filter((item): item is ReviewPackReviewSheetItem => Boolean(item));

    if (!retryItems.length) {
      setReviewPackAssignError("失败项缺少重试参数，请重新生成讲评包后再试。");
      return;
    }

    setReviewPackRetryingFailed(true);
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);

    let summary = null;
    let failedItems: ReviewPackFailedItem[] = [];
    try {
      const result = await dispatchReviewPackItems(retryItems, {
        autoRelaxOnInsufficient: true
      });
      if (!result.ok) {
        setReviewPackAssignError(result.error);
        return;
      }
      summary = result.data?.summary ?? null;
      failedItems = result.data?.failed ?? [];
      setReviewPackFailedItems(failedItems);
      setReviewPackRelaxedItems(summary?.relaxed ?? []);
      setReviewPackDispatchQuality(summary?.qualityGovernance ?? null);
    } catch {
      setReviewPackAssignError("重试失败，请稍后再试");
      return;
    } finally {
      setReviewPackRetryingFailed(false);
    }

    if (summary && summary.created > 0) {
      setReviewPackAssignMessage(`失败项重试完成：新增下发 ${summary.created}/${summary.requested} 条，自动放宽 ${summary.relaxedCount ?? 0} 条。`);
    }

    if (failedItems.length > 0) {
      const brief = failedItems
        .slice(0, 3)
        .map((failedItem) => `${failedItem?.title ?? "未命名复练"}：${failedItem?.reason ?? "重试失败"}`)
        .join("；");
      setReviewPackAssignError(`重试后仍失败 ${failedItems.length} 条：${brief}`);
    }
  }

  const checkPreviewOptions = checkForm.options.map((item) => item.trim()).filter(Boolean);
  const hasCheckPreview = Boolean(checkForm.stem.trim() || checkPreviewOptions.length || checkForm.answer.trim() || checkForm.explanation.trim());

  return {
    classes,
    authRequired,
    pageLoading,
    pageReady,
    pageError,
    bootstrapNotice,
    knowledgePointsNotice,
    lastLoadedAt,
    reload: loadBootstrapData,
    paperForm,
    setPaperForm,
    paperPoints,
    loading,
    paperAutoFixing,
    paperAutoFixHint,
    paperResult,
    paperError,
    paperErrorSuggestions,
    outlineForm,
    setOutlineForm,
    outlinePoints,
    outlineError,
    outlineResult,
    wrongForm,
    setWrongForm,
    wrongError,
    wrongResult,
    reviewPackResult,
    reviewPackError,
    reviewPackAssigningId,
    reviewPackAssigningAll,
    reviewPackAssignMessage,
    reviewPackAssignError,
    reviewPackDispatchIncludeIsolated,
    setReviewPackDispatchIncludeIsolated,
    reviewPackDispatchQuality,
    reviewPackFailedItems,
    reviewPackRelaxedItems,
    reviewPackRetryingFailed,
    showGuideCard,
    checkForm,
    setCheckForm,
    checkPreviewOptions,
    hasCheckPreview,
    checkError,
    checkResult,
    handleGeneratePaper,
    applyPaperQuickFix,
    handleGenerateOutline,
    handleWrongReview,
    handleReviewPack,
    handleAssignAllReviewSheets,
    handleRetryFailedReviewSheets,
    handleAssignReviewSheet,
    handleCheckQuestion,
    hideGuideCard,
    showGuideAgain
  };
}
