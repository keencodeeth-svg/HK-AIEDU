"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { type ChangeEvent, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { pushAppToast } from "@/components/AppToastHub";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import MathText from "@/components/MathText";
import { trackEvent } from "@/lib/analytics-client";
import { GRADE_OPTIONS, SUBJECT_LABELS, SUBJECT_OPTIONS, getGradeLabel } from "@/lib/constants";
import { type TutorLaunchIntent } from "@/lib/tutor-launch";
import {
  ALLOWED_IMAGE_TYPES,
  ANSWER_MODE_OPTIONS,
  DEFAULT_ANSWER_MODE,
  DEFAULT_GRADE,
  DEFAULT_SUBJECT,
  HISTORY_ORIGIN_OPTIONS,
  LEARNING_MODE_OPTIONS,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE_MB,
  QUALITY_RISK_LABELS
} from "./config";
import type {
  TutorAnswer,
  TutorAnswerMode,
  TutorAskResponse,
  TutorHistoryCreatePayload,
  TutorHistoryItem,
  TutorHistoryItemResponse,
  TutorHistoryListResponse,
  TutorHistoryOrigin,
  TutorHistoryOriginFilter,
  TutorShareResultResponse,
  TutorShareTarget,
  TutorShareTargetsResponse,
  TutorVariantPack,
  TutorVariantPackResponse,
  TutorVariantProgress,
  TutorVariantProgressResponse,
  TutorVariantReflection,
  TutorVariantReflectionResponse
} from "./types";
import {
  type ActiveAction,
  type CropSelection,
  type DragState,
  type PreviewItem,
  type ResultOrigin,
  type StudyQuestionResolution,
  type TutorLearningMode,
  buildSelection,
  copyToClipboard,
  cropImageFile,
  getAnswerSections,
  getCropSummary,
  getOriginLabel,
  getPointerPercent,
  getQualityToneClass,
  getShareTargetActionLabel,
  hasCrop,
  isStudyResult,
  isTutorAnswerMode,
  isTutorLaunchIntent,
  isTutorLaunchPanel,
  readImageFromFile,
  shouldRenderCrop,
  truncateText
} from "./utils";

export default function TutorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const answerSectionRef = useRef<HTMLDivElement | null>(null);
  const launchSignatureRef = useRef("");
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [launchIntent, setLaunchIntent] = useState<TutorLaunchIntent | null>(null);
  const [question, setQuestion] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [grade, setGrade] = useState(DEFAULT_GRADE);
  const [learningMode, setLearningMode] = useState<TutorLearningMode>("direct");
  const [answerMode, setAnswerMode] = useState<TutorAnswerMode>(DEFAULT_ANSWER_MODE);
  const [resultAnswerMode, setResultAnswerMode] = useState<TutorAnswerMode>(DEFAULT_ANSWER_MODE);
  const [answer, setAnswer] = useState<TutorAnswer | null>(null);
  const [studyThinking, setStudyThinking] = useState("");
  const [studyHintCount, setStudyHintCount] = useState(0);
  const [editableQuestion, setEditableQuestion] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [resultOrigin, setResultOrigin] = useState<ResultOrigin>(null);
  const [history, setHistory] = useState<TutorHistoryItem[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyOriginFilter, setHistoryOriginFilter] = useState<TutorHistoryOriginFilter>("all");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [cropSelections, setCropSelections] = useState<Array<CropSelection | null>>([]);
  const [dragState, setDragState] = useState<DragState>(null);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [variantPack, setVariantPack] = useState<TutorVariantPack | null>(null);
  const [variantAnswers, setVariantAnswers] = useState<Record<number, string>>({});
  const [variantResults, setVariantResults] = useState<Record<number, boolean | null>>({});
  const [variantCommittedAnswers, setVariantCommittedAnswers] = useState<Record<number, string>>({});
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [variantProgress, setVariantProgress] = useState<TutorVariantProgress | null>(null);
  const [savingVariantProgressIndex, setSavingVariantProgressIndex] = useState<number | null>(null);
  const [variantReflection, setVariantReflection] = useState<TutorVariantReflection | null>(null);
  const [loadingVariantReflection, setLoadingVariantReflection] = useState(false);
  const [shareTargets, setShareTargets] = useState<TutorShareTarget[]>([]);
  const [shareTargetsLoaded, setShareTargetsLoaded] = useState(false);
  const [shareTargetsLoading, setShareTargetsLoading] = useState(false);
  const [shareSubmittingTargetId, setShareSubmittingTargetId] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<{ threadId: string; targetName: string; reused: boolean } | null>(null);

  const submittedVariantCount = useMemo(
    () =>
      variantPack?.variants.reduce((count, _, index) => (typeof variantResults[index] === "boolean" ? count + 1 : count), 0) ?? 0,
    [variantPack, variantResults]
  );

  useEffect(() => {
    let disposed = false;
    let createdUrls: string[] = [];

    async function buildPreviewItems() {
      if (!selectedImages.length) {
        setPreviewItems([]);
        return;
      }

      const nextItems = await Promise.all(
        selectedImages.map(async (file) => {
          const image = await readImageFromFile(file);
          const url = URL.createObjectURL(file);
          createdUrls.push(url);
          return {
            url,
            width: Math.max(1, image.naturalWidth || 1200),
            height: Math.max(1, image.naturalHeight || 900)
          };
        })
      );

      if (disposed) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setPreviewItems(nextItems);
    }

    void buildPreviewItems();

    return () => {
      disposed = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedImages]);

  useEffect(() => {
    fetch("/api/ai/history")
      .then((res) => res.json())
      .then((data: TutorHistoryListResponse) => setHistory(data.data ?? []))
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    if (!answer || shareTargetsLoaded || shareTargetsLoading) {
      return;
    }

    let cancelled = false;

    async function loadShareTargets() {
      setShareTargetsLoading(true);
      try {
        const res = await fetch("/api/ai/share-targets", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as TutorShareTargetsResponse;
        if (cancelled) {
          return;
        }
        if (res.ok) {
          setShareTargets(data.data ?? []);
        } else {
          setShareTargets([]);
        }
      } catch {
        if (!cancelled) {
          setShareTargets([]);
        }
      } finally {
        if (!cancelled) {
          setShareTargetsLoaded(true);
          setShareTargetsLoading(false);
        }
      }
    }

    void loadShareTargets();
    return () => {
      cancelled = true;
    };
  }, [answer, shareTargetsLoaded, shareTargetsLoading]);

  useEffect(() => {
    const rawIntent = searchParams.get("intent");
    const rawPanel = searchParams.get("panel");
    const source = searchParams.get("source")?.trim() ?? "";
    const favoritesOnly = searchParams.get("favorites") === "1";
    const nextSubject = searchParams.get("subject");
    const nextGrade = searchParams.get("grade");
    const nextAnswerMode = searchParams.get("answerMode");
    const intent = isTutorLaunchIntent(rawIntent) ? rawIntent : null;
    const panel = isTutorLaunchPanel(rawPanel) ? rawPanel : intent === "history" ? "history" : "composer";
    const signature = [intent ?? "", panel, source, favoritesOnly ? "1" : "0", nextSubject ?? "", nextGrade ?? "", nextAnswerMode ?? ""].join("|");

    if (launchSignatureRef.current === signature) {
      return;
    }
    launchSignatureRef.current = signature;

    setLaunchIntent(intent);
    setLaunchMessage(null);
    setShowFavorites(favoritesOnly);

    if (SUBJECT_OPTIONS.some((item) => item.value === nextSubject)) {
      setSubject(nextSubject!);
    }
    if (GRADE_OPTIONS.some((item) => item.value === nextGrade)) {
      setGrade(nextGrade!);
    }
    if (isTutorAnswerMode(nextAnswerMode)) {
      setAnswerMode(nextAnswerMode);
    }

    const scrollToAnchor = (anchorId: string, focusTextInput = false) => {
      requestAnimationFrame(() => {
        document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (focusTextInput) {
          questionInputRef.current?.focus();
        }
      });
    };

    if (panel === "history") {
      setLaunchMessage(favoritesOnly ? "已打开历史收藏，可直接回看并复用之前的题目。" : "已打开 AI 历史，可继续回看并复用。");
      scrollToAnchor("tutor-history-anchor");
    } else if (intent === "image") {
      setLaunchMessage("已进入拍题模式：上传题图后即可开始识题。\n建议先把题干、图形和选项完整拍入。");
      scrollToAnchor("tutor-composer-anchor");
    } else if (intent === "text") {
      setLaunchMessage("已进入文字提问模式：输入题目即可开始求解。\n如有识别误差，也可以直接用文字修正。");
      scrollToAnchor("tutor-composer-anchor", true);
    } else if (source) {
      setLaunchMessage("已从快捷入口进入 AI 辅导。");
    }

    if (source || intent || panel === "history") {
      trackEvent({
        eventName: "tutor_entry_landed",
        page: "/tutor",
        subject: SUBJECT_OPTIONS.some((item) => item.value === nextSubject) ? nextSubject ?? undefined : undefined,
        grade: GRADE_OPTIONS.some((item) => item.value === nextGrade) ? nextGrade ?? undefined : undefined,
        props: {
          source: source || "direct",
          intent,
          panel,
          favoritesOnly
        }
      });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!answer) return;
    requestAnimationFrame(() => {
      answerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [answer]);

  async function saveHistory(payload: TutorHistoryCreatePayload) {
    const historyRes = await fetch("/api/ai/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const historyData = (await historyRes.json().catch(() => ({}))) as TutorHistoryItemResponse;
    if (historyRes.ok && historyData.data) {
      setHistory((prev) => [historyData.data!, ...prev]);
    }
  }

  async function refreshHistory() {
    try {
      const res = await fetch("/api/ai/history");
      const data = (await res.json().catch(() => ({}))) as TutorHistoryListResponse;
      if (res.ok) {
        setHistory(data.data ?? []);
      }
    } catch {
      // Best effort only; history refresh must not block the live tutor flow.
    }
  }

  function resetVariantTraining() {
    setVariantPack(null);
    setVariantAnswers({});
    setVariantResults({});
    setVariantCommittedAnswers({});
    setLoadingVariants(false);
    setVariantProgress(null);
    setSavingVariantProgressIndex(null);
    setVariantReflection(null);
    setLoadingVariantReflection(false);
  }

  function normalizeTutorAnswer(
    data: TutorAnswer & {
      source?: string[];
      sources?: string[];
    },
    nextLearningMode: TutorLearningMode,
    fallbackQuestion?: string
  ) {
    return {
      ...data,
      learningMode: nextLearningMode,
      recognizedQuestion: data.recognizedQuestion?.trim() || fallbackQuestion?.trim() || undefined,
      source: data.source ?? data.sources
    } as TutorAnswer;
  }

  async function requestImageAssist(nextAnswerMode: TutorAnswerMode) {
    const processedImages = await Promise.all(
      selectedImages.map((file, index) => cropImageFile(file, cropSelections[index]))
    );

    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("grade", grade);
    formData.set("answerMode", nextAnswerMode);
    if (question.trim()) {
      formData.set("question", question.trim());
    }
    processedImages.forEach((file) => {
      formData.append("images", file);
    });

    const res = await fetch("/api/ai/solve-from-image", {
      method: "POST",
      body: formData
    });
    const payload = (await res.json().catch(() => ({}))) as TutorAskResponse;
    if (!res.ok) {
      throw new Error(payload.error ?? payload.message ?? "拍照识题暂不可用，请稍后重试");
    }

    return {
      data: payload.data ?? payload,
      processedImages
    };
  }

  async function performCoachRequest(input: {
    question: string;
    origin: TutorHistoryOrigin;
    studentAnswer?: string;
    revealAnswer?: boolean;
  }) {
    const res = await fetch("/api/ai/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: input.question,
        subject,
        grade,
        studentAnswer: input.studentAnswer,
        revealAnswer: input.revealAnswer,
        origin: input.origin
      })
    });
    const payload = (await res.json().catch(() => ({}))) as TutorAskResponse & { data?: TutorAnswer & { sources?: string[] } };
    if (!res.ok) {
      throw new Error(payload.error ?? payload.message ?? "学习模式暂不可用，请稍后重试");
    }

    return normalizeTutorAnswer((payload.data ?? payload) as TutorAnswer & { sources?: string[] }, "study", input.question);
  }

  function resetShareFeedback() {
    setShareError(null);
    setShareSuccess(null);
    setShareSubmittingTargetId("");
  }

  function focusComposerInput() {
    requestAnimationFrame(() => {
      document.getElementById("tutor-composer-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      questionInputRef.current?.focus();
    });
  }

  function handleStartOver() {
    resetShareFeedback();
    resetVariantTraining();
    setLaunchIntent("text");
    setLaunchMessage(null);
    setActionMessage(null);
    setAnswer(null);
    setStudyThinking("");
    setStudyHintCount(0);
    setEditableQuestion("");
    setQuestion("");
    setResultOrigin(null);
    clearSelectedImages();
    setError(null);
    focusComposerInput();
    pushAppToast("已清空当前结果，可以开始新一轮提问");
  }

  function clearHistoryFilters() {
    setHistoryKeyword("");
    setHistoryOriginFilter("all");
    setShowFavorites(false);
  }

  async function handleCopy(value: string, message: string) {
    if (!value.trim()) {
      pushAppToast("暂无可复制内容", "error");
      return;
    }
    try {
      await copyToClipboard(value.trim());
      pushAppToast(message);
    } catch {
      pushAppToast("复制失败，请稍后重试", "error");
    }
  }

  function updateCropSelection(index: number, selection: CropSelection | null) {
    setCropSelections((prev) => {
      const next = [...prev];
      next[index] = selection;
      return next;
    });
  }

  function handleCropPointerDown(index: number, event: ReactPointerEvent<HTMLDivElement>) {
    if (activeAction) {
      return;
    }

    const point = getPointerPercent(event);
    updateCropSelection(index, { x: point.x, y: point.y, width: 0, height: 0 });
    setDragState({ index, startX: point.x, startY: point.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCropPointerMove(index: number, event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.index !== index) {
      return;
    }

    const point = getPointerPercent(event);
    updateCropSelection(index, buildSelection(dragState.startX, dragState.startY, point.x, point.y));
  }

  function finishCropPointer(index: number, event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.index !== index) {
      return;
    }

    const point = getPointerPercent(event);
    const nextSelection = buildSelection(dragState.startX, dragState.startY, point.x, point.y);
    updateCropSelection(index, hasCrop(nextSelection) ? nextSelection : null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
  }

  async function handleAsk() {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    resetShareFeedback();
    setLaunchIntent("text");
    setLaunchMessage(null);
    setActionMessage(null);
    setActiveAction("text");
    setError(null);
    setAnswer(null);
    setStudyHintCount(0);
    resetVariantTraining();

    try {
      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion, subject, grade, answerMode })
      });
      const payload = (await res.json().catch(() => ({}))) as TutorAskResponse;
      if (!res.ok) {
        setError(payload.error ?? payload.message ?? "AI 辅导暂不可用，请稍后重试");
        return;
      }

      const data = normalizeTutorAnswer((payload.data ?? payload) as TutorAnswer, "direct", trimmedQuestion);
      setLearningMode("direct");
      setAnswer(data);
      setActionMessage("文字求解完成，可继续看下方讲解、复制答案，或修改题干后重新求解。");
      setResultAnswerMode(answerMode);
      setEditableQuestion(trimmedQuestion);
      setResultOrigin("text");
      if (data.answer) {
        await saveHistory({
          question: trimmedQuestion,
          answer: data.answer,
          meta: {
            origin: "text",
            learningMode: "direct",
            subject,
            grade,
            answerMode,
            provider: data.provider,
            recognizedQuestion: trimmedQuestion,
            quality: data.quality
          }
        });
      }
      trackEvent({
        eventName: "tutor_direct_answer_completed",
        page: "/tutor",
        subject,
        grade,
        props: {
          origin: "text",
          answerMode
        }
      });
    } catch {
      setError("AI 辅导暂不可用，请稍后重试");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleStartStudyMode(input?: Partial<StudyQuestionResolution> & { activeAction?: ActiveAction }) {
    resetShareFeedback();
    resetVariantTraining();
    setLaunchIntent(selectedImages.length && !input?.question ? "image" : "text");
    setLaunchMessage(null);
    setActionMessage(null);
    setActiveAction(input?.activeAction ?? (selectedImages.length && !input?.question ? "study_image" : "study"));
    setError(null);
    setAnswer(null);

    try {
      let resolved: StudyQuestionResolution | null = null;

      if (input?.question?.trim()) {
        resolved = {
          question: input.question.trim(),
          origin: input.origin ?? "refine",
          imageCount: input.imageCount ?? 0
        };
      } else if (selectedImages.length) {
        const { data, processedImages } = await requestImageAssist("hints_first");
        const recognizedQuestion = data.recognizedQuestion?.trim() || question.trim();
        if (!recognizedQuestion) {
          throw new Error("暂时没能识别出清晰题干，请补充文字或重拍后再试");
        }
        resolved = {
          question: recognizedQuestion,
          origin: "image",
          imageCount: processedImages.length
        };
      } else if (question.trim()) {
        resolved = {
          question: question.trim(),
          origin: "text",
          imageCount: 0
        };
      }

      if (!resolved) {
        setError("请先输入题目或上传题图");
        return;
      }

      const nextAnswer = await performCoachRequest({
        question: resolved.question,
        origin: resolved.origin,
        studentAnswer: studyThinking.trim() || undefined
      });

      setLearningMode("study");
      setAnswer(nextAnswer);
      setEditableQuestion(resolved.question);
      setResultOrigin(resolved.origin);
      setResultAnswerMode(answerMode);
      setStudyHintCount(Math.min(studyThinking.trim() ? 2 : 1, nextAnswer.hints?.length ?? 0));
      setActionMessage(
        studyThinking.trim()
          ? "学习模式已结合你的思路生成追问和提示，先完成知识检查，再决定是否查看完整讲解。"
          : "学习模式已开始，系统会先给提示和追问，不会直接把答案摊开。"
      );
      await refreshHistory();
      trackEvent({
        eventName: "tutor_study_mode_started",
        page: "/tutor",
        subject,
        grade,
        props: {
          origin: resolved.origin,
          hasStudentAnswer: Boolean(studyThinking.trim()),
          imageCount: resolved.imageCount
        }
      });
      if (resolved.origin === "image") {
        pushAppToast("已根据题图识别结果进入学习模式");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "学习模式暂不可用，请稍后重试");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSubmitStudyThinking() {
    const trimmedQuestion = editableQuestion.trim() || question.trim();
    const thinking = studyThinking.trim();
    if (!trimmedQuestion || !thinking) {
      return;
    }

    resetShareFeedback();
    setActionMessage(null);
    setActiveAction("study");
    setError(null);

    try {
      const nextAnswer = await performCoachRequest({
        question: trimmedQuestion,
        origin: resultOrigin ?? "text",
        studentAnswer: thinking
      });
      setAnswer(nextAnswer);
      setStudyHintCount(Math.min(Math.max(studyHintCount, 2), nextAnswer.hints?.length ?? 0));
      setActionMessage("已根据你的思路做了校准，先看知识检查，再决定是否查看完整讲解。");
      await refreshHistory();
      trackEvent({
        eventName: "tutor_study_mode_reply_submitted",
        page: "/tutor",
        subject,
        grade,
        props: {
          origin: resultOrigin ?? "text"
        }
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "思路反馈失败，请稍后重试");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleRevealStudyAnswer() {
    const trimmedQuestion = editableQuestion.trim() || question.trim();
    if (!trimmedQuestion) {
      return;
    }

    resetShareFeedback();
    setActionMessage(null);
    setActiveAction("study");
    setError(null);

    try {
      const nextAnswer = await performCoachRequest({
        question: trimmedQuestion,
        origin: resultOrigin ?? "text",
        studentAnswer: studyThinking.trim() || undefined,
        revealAnswer: true
      });
      setAnswer(nextAnswer);
      setStudyHintCount(nextAnswer.hints?.length ?? 0);
      setActionMessage("完整讲解已揭晓。现在请对照答案，再复述一遍关键转折。");
      await refreshHistory();
      trackEvent({
        eventName: "tutor_study_mode_answer_revealed",
        page: "/tutor",
        subject,
        grade,
        props: {
          origin: resultOrigin ?? "text",
          hasStudentAnswer: Boolean(studyThinking.trim())
        }
      });
      pushAppToast("已揭晓完整讲解");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "完整讲解暂不可用，请稍后重试");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleLoadVariants() {
    if (!answer?.answer.trim()) {
      return;
    }

    const composedQuestion = editableQuestion.trim() || answer.recognizedQuestion?.trim() || question.trim();
    if (!composedQuestion) {
      setError("请先确认题目后再生成变式巩固");
      return;
    }

    setLoadingVariants(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/study-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: composedQuestion,
          answer: answer.answer,
          subject,
          grade,
          count: 2
        })
      });
      const payload = (await res.json().catch(() => ({}))) as TutorVariantPackResponse;
      if (!res.ok || !payload.data) {
        setError(payload.error ?? payload.message ?? "变式生成失败，请稍后重试");
        return;
      }

      setVariantPack(payload.data);
      setVariantAnswers({});
      setVariantResults({});
      setVariantCommittedAnswers({});
      setVariantProgress(null);
      setSavingVariantProgressIndex(null);
      setVariantReflection(null);
      trackEvent({
        eventName: "tutor_variant_pack_loaded",
        page: "/tutor",
        subject,
        grade,
        props: {
          learningMode: studyResult ? "study" : "direct",
          sourceMode: payload.data.sourceMode ?? "fallback",
          variantCount: payload.data.variants.length
        }
      });
      pushAppToast(
        payload.data.sourceMode === "pool"
          ? "已加载题库中的同类变式题"
          : payload.data.sourceMode === "fallback"
            ? "已生成概念迁移练习，可先做一轮巩固"
            : "已生成 AI 变式巩固题"
      );
    } catch {
      setError("变式生成失败，请稍后重试");
    } finally {
      setLoadingVariants(false);
    }
  }

  async function loadVariantReflection(
    trigger: "auto" | "manual" = "manual",
    nextAnswers?: Record<number, string>,
    submittedResults?: Record<number, boolean | null>
  ) {
    if (!variantPack?.variants.length) {
      return;
    }

    const composedQuestion = editableQuestion.trim() || answer?.recognizedQuestion?.trim() || question.trim();
    if (!composedQuestion) {
      setError("请先确认题目后再生成学习复盘");
      return;
    }

    const answerMap = nextAnswers ?? variantAnswers;
    const submittedMap = submittedResults ?? variantResults;
    const reflectionVariants = variantPack.variants.map((variant, index) => ({
      stem: variant.stem,
      answer: variant.answer,
      explanation: variant.explanation,
      studentAnswer: typeof submittedMap[index] === "boolean" ? answerMap[index] ?? "" : ""
    }));

    const answeredCount = reflectionVariants.filter((variant) => variant.studentAnswer.trim()).length;
    if (!answeredCount) {
      setError("请先至少提交 1 道变式题，再生成学习复盘");
      return;
    }

    setLoadingVariantReflection(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/study-reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: composedQuestion,
          subject,
          grade,
          knowledgePointTitle: variantPack.knowledgePointTitle,
          variants: reflectionVariants
        })
      });
      const payload = (await res.json().catch(() => ({}))) as TutorVariantReflectionResponse;
      if (!res.ok || !payload.data) {
        setError(payload.error ?? payload.message ?? "学习复盘生成失败，请稍后重试");
        return;
      }

      setVariantReflection(payload.data);
      trackEvent({
        eventName: "tutor_variant_reflection_loaded",
        page: "/tutor",
        subject,
        grade,
        props: {
          trigger,
          learningMode: studyResult ? "study" : "direct",
          masteryLevel: payload.data.masteryLevel,
          answeredCount: payload.data.answeredCount,
          correctCount: payload.data.correctCount,
          total: payload.data.total,
          detailSource: payload.data.detailSource
        }
      });
      pushAppToast(
        payload.data.masteryLevel === "secure"
          ? "这轮迁移做得很稳，可以继续拉开难度"
          : "已生成学习复盘，先看错因再决定下一步"
      );
    } catch {
      setError("学习复盘生成失败，请稍后重试");
    } finally {
      setLoadingVariantReflection(false);
    }
  }

  async function syncVariantProgress(index: number, variant: TutorVariantPack["variants"][number], selected: string) {
    const composedQuestion = editableQuestion.trim() || answer?.recognizedQuestion?.trim() || question.trim();
    if (!composedQuestion) {
      return;
    }

    setSavingVariantProgressIndex(index);
    try {
      const res = await fetch("/api/ai/study-variant-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: composedQuestion,
          subject,
          grade,
          knowledgePointId: variantPack?.knowledgePointId,
          knowledgePointTitle: variantPack?.knowledgePointTitle,
          variant: {
            stem: variant.stem,
            answer: variant.answer,
            explanation: variant.explanation,
            studentAnswer: selected
          }
        })
      });
      const payload = (await res.json().catch(() => ({}))) as TutorVariantProgressResponse;
      if (!res.ok || !payload.data) {
        setError(payload.error ?? payload.message ?? "学习成长同步失败，请稍后重试");
        return;
      }

      setVariantCommittedAnswers((prev) => ({
        ...prev,
        [index]: selected
      }));
      setVariantProgress(payload.data);
      trackEvent({
        eventName: "tutor_variant_progress_synced",
        page: "/tutor",
        subject,
        grade,
        props: {
          variantIndex: index,
          persisted: payload.data.persisted,
          masteryScore: payload.data.mastery?.masteryScore ?? null,
          masteryDelta: payload.data.mastery?.masteryDelta ?? null,
          weaknessRank: payload.data.mastery?.weaknessRank ?? null
        }
      });
      if (!payload.data.persisted) {
        pushAppToast(payload.data.message);
      }
    } catch {
      setError("学习成长同步失败，请稍后重试");
    } finally {
      setSavingVariantProgressIndex((current) => (current === index ? null : current));
    }
  }

  function handleVariantAnswerChange(index: number, value: string) {
    setVariantAnswers((prev) => ({
      ...prev,
      [index]: value
    }));
    setVariantResults((prev) => {
      if (!(index in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setVariantCommittedAnswers((prev) => {
      if (!(index in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setVariantReflection(null);
  }

  function handleVariantSubmit(index: number, selected: string, correctAnswer: string) {
    if (!variantPack) {
      return;
    }
    if (variantCommittedAnswers[index] === selected && typeof variantResults[index] === "boolean") {
      return;
    }

    const correct = selected === correctAnswer;
    const nextResults = {
      ...variantResults,
      [index]: correct
    };
    const nextAnswers = {
      ...variantAnswers,
      [index]: selected
    };
    setVariantResults(nextResults);
    trackEvent({
      eventName: "tutor_variant_answer_submitted",
      page: "/tutor",
      subject,
      grade,
      props: {
        learningMode: studyResult ? "study" : "direct",
        variantIndex: index,
        correct
      }
    });
    void syncVariantProgress(index, variantPack.variants[index]!, selected);
    if (variantPack && variantPack.variants.every((_, variantIndex) => typeof nextResults[variantIndex] === "boolean")) {
      void loadVariantReflection("auto", nextAnswers, nextResults);
    }
    pushAppToast(correct ? "这道变式答对了" : "这道变式还没稳，先看下方解析");
  }

  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const invalidType = files.find((file) => !ALLOWED_IMAGE_TYPES.includes(file.type));
    if (invalidType) {
      setError("请上传 PNG、JPG 或 WebP 图片");
      return;
    }

    const oversize = files.find((file) => file.size / (1024 * 1024) > MAX_IMAGE_SIZE_MB);
    if (oversize) {
      setError(`单张图片不能超过 ${MAX_IMAGE_SIZE_MB}MB`);
      return;
    }

    const slotsLeft = Math.max(0, MAX_IMAGE_COUNT - selectedImages.length);
    const acceptedFiles = files.slice(0, slotsLeft);
    if (!acceptedFiles.length) {
      setError(`最多上传 ${MAX_IMAGE_COUNT} 张图片`);
      return;
    }

    setLaunchIntent("image");
    setActionMessage(`已添加 ${acceptedFiles.length} 张题图，可直接开始识题${question.trim() ? "，当前文字会作为补充说明。" : "。"}`);
    setSelectedImages((prev) => [...prev, ...acceptedFiles]);
    setCropSelections((prev) => [...prev, ...acceptedFiles.map(() => null)]);

    if (files.length > slotsLeft) {
      setError(`最多上传 ${MAX_IMAGE_COUNT} 张图片，已为你保留前 ${MAX_IMAGE_COUNT} 张。`);
    } else {
      setError(null);
    }
  }

  function clearCropSelection(index: number) {
    updateCropSelection(index, null);
  }

  function removeSelectedImage(index: number) {
    setSelectedImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setCropSelections((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setDragState((prev) => (prev?.index === index ? null : prev));
    setError(null);
  }

  function clearSelectedImages() {
    setSelectedImages([]);
    setCropSelections([]);
    setDragState(null);
    setError(null);
  }

  async function handleImageAsk() {
    if (!selectedImages.length) return;

    resetShareFeedback();
    setLaunchIntent("image");
    setLaunchMessage(null);
    setActionMessage(null);
    setActiveAction("image");
    setError(null);
    setAnswer(null);
    setStudyHintCount(0);
    resetVariantTraining();

    try {
      const { data: rawData, processedImages } = await requestImageAssist(answerMode);
      const recognizedQuestion = rawData.recognizedQuestion?.trim() || question.trim();
      const data = normalizeTutorAnswer(rawData as TutorAnswer, "direct", recognizedQuestion);
      setLearningMode("direct");
      setAnswer(data);
      setActionMessage("识题完成，先核对下方识别题干；如果有误，直接编辑后重新求解会更稳。");
      setResultAnswerMode(answerMode);
      setEditableQuestion(recognizedQuestion);
      setResultOrigin("image");
      if (data.answer) {
        const historyQuestion =
          recognizedQuestion || `${SUBJECT_LABELS[subject] ?? subject} · ${getGradeLabel(grade)} · 图片识题`;
        await saveHistory({
          question: historyQuestion,
          answer: data.answer,
          meta: {
            origin: "image",
            learningMode: "direct",
            subject,
            grade,
            answerMode,
            provider: data.provider,
            recognizedQuestion: recognizedQuestion || undefined,
            imageCount: processedImages.length,
            quality: data.quality
          }
        });
      }
      trackEvent({
        eventName: "tutor_direct_answer_completed",
        page: "/tutor",
        subject,
        grade,
        props: {
          origin: "image",
          answerMode,
          imageCount: processedImages.length
        }
      });
      pushAppToast("识题完成，可继续编辑题干再重算");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "拍照识题暂不可用，请稍后重试");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleRefineSolve() {
    const trimmedQuestion = editableQuestion.trim();
    if (!trimmedQuestion) return;

    resetShareFeedback();
    setActionMessage(null);
    setActiveAction("refine");
    setError(null);
    resetVariantTraining();

    try {
      if (isStudyResult(answer)) {
        const nextAnswer = await performCoachRequest({
          question: trimmedQuestion,
          origin: "refine"
        });
        setAnswer(nextAnswer);
        setLearningMode("study");
        setStudyThinking("");
        setStudyHintCount(Math.min(1, nextAnswer.hints?.length ?? 0));
        setActionMessage("已按编辑后的题目重新开始学习模式，可继续先说思路，再决定是否查看完整讲解。");
        setResultAnswerMode(answerMode);
        setEditableQuestion(trimmedQuestion);
        setResultOrigin("refine");
        await refreshHistory();
        pushAppToast("已按编辑后的题目重新开始学习模式");
        return;
      }

      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion, subject, grade, answerMode })
      });
      const payload = (await res.json().catch(() => ({}))) as TutorAskResponse;
      if (!res.ok) {
        setError(payload.error ?? payload.message ?? "重新求解失败，请稍后重试");
        return;
      }

      const data = normalizeTutorAnswer((payload.data ?? payload) as TutorAnswer, "direct", trimmedQuestion);
      setLearningMode("direct");
      setAnswer(data);
      setActionMessage("已按编辑后的题目重新求解，可直接对比下方新结果。");
      setResultAnswerMode(answerMode);
      setEditableQuestion(trimmedQuestion);
      setResultOrigin("refine");
      if (data.answer) {
        await saveHistory({
          question: trimmedQuestion,
          answer: data.answer,
          meta: {
            origin: "refine",
            learningMode: "direct",
            subject,
            grade,
            answerMode,
            provider: data.provider,
            recognizedQuestion: trimmedQuestion,
            quality: data.quality
          }
        });
      }
      pushAppToast("已按编辑后的题目重新求解");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "重新求解失败，请稍后重试");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleShareResult(target: TutorShareTarget) {
    if (!answer) return;

    const composedQuestion = editableQuestion.trim() || answer.recognizedQuestion?.trim() || question.trim();
    if (!composedQuestion || !answer.answer.trim()) {
      const message = "当前结果不完整，暂时无法分享";
      setShareError(message);
      pushAppToast(message, "error");
      return;
    }

    setShareSubmittingTargetId(target.id);
    setShareError(null);
    setShareSuccess(null);

    try {
      const res = await fetch("/api/ai/share-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: target.id,
          question: composedQuestion,
          recognizedQuestion: editableQuestion.trim() || answer.recognizedQuestion?.trim() || undefined,
          answer: answer.answer,
          origin: resultOrigin ?? undefined,
          subject,
          grade,
          answerMode: studyResult ? "hints_first" : resultAnswerMode,
          provider: answer.provider,
          steps: answer.steps ?? [],
          hints: answer.hints ?? [],
          quality: answer.quality
        })
      });
      const data = (await res.json().catch(() => ({}))) as TutorShareResultResponse;
      if (!res.ok || !data.data) {
        const message = data.error ?? data.message ?? "分享失败，请稍后重试";
        setShareError(message);
        pushAppToast(message, "error");
        return;
      }

      setShareSuccess({
        threadId: data.data.threadId,
        targetName: data.data.target.name,
        reused: data.data.reused
      });
      pushAppToast(data.data.reused ? `已继续发送给${data.data.target.name}` : `已发送给${data.data.target.name}`);
    } catch {
      const message = "分享失败，请稍后重试";
      setShareError(message);
      pushAppToast(message, "error");
    } finally {
      setShareSubmittingTargetId("");
    }
  }

  async function toggleFavorite(item: TutorHistoryItem) {
    const res = await fetch(`/api/ai/history/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !item.favorite })
    });
    const data = (await res.json().catch(() => ({}))) as TutorHistoryItemResponse;
    if (data.data) {
      setHistory((prev) => prev.map((historyItem) => (historyItem.id === item.id ? data.data! : historyItem)));
      pushAppToast(item.favorite ? "已取消收藏" : "已加入收藏");
      return;
    }
    pushAppToast("更新收藏状态失败", "error");
  }

  async function editTags(item: TutorHistoryItem) {
    const input = prompt("输入标签（用逗号分隔）", item.tags.join(",") ?? "");
    if (input === null) return;
    const tags = input
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const res = await fetch(`/api/ai/history/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags })
    });
    const data = (await res.json().catch(() => ({}))) as TutorHistoryItemResponse;
    if (data.data) {
      setHistory((prev) => prev.map((historyItem) => (historyItem.id === item.id ? data.data! : historyItem)));
      pushAppToast(tags.length ? "标签已更新" : "标签已清空");
      return;
    }
    pushAppToast("标签更新失败", "error");
  }

  async function deleteHistory(item: TutorHistoryItem) {
    const confirmed = window.confirm(`确认删除这条记录？\n\n${truncateText(item.question, 60)}`);
    if (!confirmed) return;

    const res = await fetch(`/api/ai/history/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      pushAppToast("删除失败，请稍后重试", "error");
      return;
    }

    setHistory((prev) => prev.filter((historyItem) => historyItem.id !== item.id));
    pushAppToast("记录已删除");
  }

  function reuseHistoryItem(item: TutorHistoryItem) {
    const nextQuestion = item.meta?.recognizedQuestion?.trim() || item.question.trim();
    if (item.meta?.subject) {
      setSubject(item.meta.subject);
    }
    if (item.meta?.grade) {
      setGrade(item.meta.grade);
    }
    if (item.meta?.answerMode) {
      setAnswerMode(item.meta.answerMode);
    }
    setLearningMode(item.meta?.learningMode === "study" ? "study" : "direct");
    resetShareFeedback();
    resetVariantTraining();
    setLaunchIntent((item.meta?.origin ?? "text") === "image" ? "image" : "text");
    setActionMessage("已从历史记录回填到提问区，可继续追问或重新求解。");
    clearSelectedImages();
    setQuestion(nextQuestion);
    setStudyThinking("");
    setStudyHintCount(0);
    setEditableQuestion(nextQuestion);
    setAnswer(null);
    setResultOrigin(null);
    setError(null);
    focusComposerInput();
    pushAppToast("已回填到提问区，可继续追问或重新求解");
  }

  const filteredHistory = useMemo(() => {
    const keyword = historyKeyword.trim().toLowerCase();
    return history.filter((item) => {
      if (showFavorites && !item.favorite) {
        return false;
      }

      const origin = item.meta?.origin ?? "text";
      if (historyOriginFilter !== "all" && origin !== historyOriginFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchable = [
        item.question,
        item.answer,
        item.tags.join(" "),
        item.meta?.recognizedQuestion ?? "",
        item.meta?.subject ?? "",
        item.meta?.provider ?? "",
        item.meta?.learningMode === "study" ? "学习模式" : "直接讲解",
        getOriginLabel(item.meta?.origin)
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [history, historyKeyword, historyOriginFilter, showFavorites]);

  const historyImageCount = useMemo(
    () => history.filter((item) => (item.meta?.origin ?? "text") === "image").length,
    [history]
  );
  const favoriteHistoryCount = useMemo(() => history.filter((item) => item.favorite).length, [history]);
  const teacherShareTargets = useMemo(
    () => shareTargets.filter((item) => item.kind === "teacher"),
    [shareTargets]
  );
  const parentShareTargets = useMemo(
    () => shareTargets.filter((item) => item.kind === "parent"),
    [shareTargets]
  );
  const loading = activeAction !== null;
  const studyResult = isStudyResult(answer);
  const answerSections = answer ? getAnswerSections(answer, resultAnswerMode) : [];
  const visibleStudyHints =
    studyResult && answer
      ? (answer.hints ?? []).slice(0, answer.answer.trim() ? answer.hints?.length ?? 0 : studyHintCount)
      : [];
  const canLoadVariants = Boolean(answer?.answer.trim());
  const selectedLearningMode = LEARNING_MODE_OPTIONS.find((item) => item.value === learningMode) ?? LEARNING_MODE_OPTIONS[0];
  const selectedAnswerMode = ANSWER_MODE_OPTIONS.find((item) => item.value === answerMode) ?? ANSWER_MODE_OPTIONS[1];
  const resolvedAnswerMode = ANSWER_MODE_OPTIONS.find((item) => item.value === resultAnswerMode) ?? selectedAnswerMode;
  const selectedModeLabel = learningMode === "study" ? selectedLearningMode.label : selectedAnswerMode.label;
  const resolvedModeLabel = studyResult ? "学习模式" : resolvedAnswerMode.label;
  const selectedCropCount = useMemo(() => cropSelections.filter((selection) => hasCrop(selection)).length, [cropSelections]);
  const hasActiveHistoryFilters = showFavorites || historyOriginFilter !== "all" || historyKeyword.trim().length > 0;
  const stageCopy = (() => {
    if (loading && activeAction === "study_image") {
      return {
        title: "正在识题并进入学习模式",
        description: "系统会先识别题目，再生成提示、追问和知识检查，不会直接摊开答案。"
      };
    }

    if (loading && activeAction === "study") {
      return {
        title: studyResult ? "正在更新学习模式" : "正在启动学习模式",
        description: studyResult
          ? "系统正在根据你的思路校准下一轮追问和提示。"
          : "系统会先生成提示与知识检查，再决定何时揭晓完整讲解。"
      };
    }

    if (loading && activeAction === "image") {
      return {
        title: "正在识题与生成讲解",
        description: "系统正在处理你上传的题图，稍等片刻就会自动滚动到下方结果区。"
      };
    }

    if (loading && activeAction === "text") {
      return {
        title: "正在分析题目",
        description: "系统正在根据你的文字问题生成答案与讲解，请稍等。"
      };
    }

    if (loading && activeAction === "refine") {
      return {
        title: "正在按编辑后的题目重新求解",
        description: "新结果生成后会自动滚动到下方讲解区，方便直接对比。"
      };
    }

    if (answer) {
      if (shareSuccess) {
        return {
          title: `结果已发送给 ${shareSuccess.targetName}`,
          description: "你可以继续留在当前页修改题目、再次求解，或前往站内信继续沟通。"
        };
      }

      if (studyResult) {
        if (answer.answer.trim()) {
          return {
            title: "学习模式已揭晓完整讲解",
            description: "现在先对照答案复盘，再试着不用看讲解复述一遍关键转折。"
          };
        }

        if (answer.feedback) {
          return {
            title: "已根据你的思路做校准",
            description: "继续完成下方知识检查；如果还是卡住，再按需揭晓完整讲解。"
          };
        }

        return {
          title: resultOrigin === "image" ? "题图已进入学习模式" : "学习模式已开始，先说思路再看答案",
          description: answer.nextPrompt ?? "先回答下方追问，系统会根据你的思路继续推进。"
        };
      }

      if (resultOrigin === "image") {
        return {
          title: "识题完成，先核对题干再决定下一步",
          description: editableQuestion.trim()
            ? "下方已展示识别后的题目和讲解；如果识别有误，直接改题干再重新求解会更稳。"
            : "下方已生成讲解，建议先核对识别结果，再决定是否重算或分享给老师 / 家长。"
        };
      }

      if (resultOrigin === "refine") {
        return {
          title: "已按编辑后的题目重算",
          description: "现在可以直接对比新旧理解差异，再决定是否复制、分享或继续追问。"
        };
      }

      return {
        title: "文字求解完成",
        description: "下方已生成答案与讲解；如果题目变化了，可以继续改题后重算。"
      };
    }

    if (selectedImages.length > 0) {
      return {
        title:
          learningMode === "study"
            ? question.trim()
              ? "图片已准备好，可以进入学习模式"
              : "题图已准备好，建议补充一句说明后进入学习模式"
            : question.trim()
              ? "图片已准备好，可以开始识题"
              : "题图已准备好，建议补充一句说明",
        description: question.trim()
          ? `当前已选择 ${selectedImages.length} 张题图${selectedCropCount ? `，其中 ${selectedCropCount} 张已框选题目区域` : ""}，${
              learningMode === "study" ? "可直接开始学习模式。" : "可直接开始识题。"
            }`
          : `当前已选择 ${selectedImages.length} 张题图${selectedCropCount ? `，其中 ${selectedCropCount} 张已框选题目区域` : ""}；${
              learningMode === "study" ? "补充一句文字说明，通常更利于进入学习模式。" : "补充一句文字说明，通常能提升准确性。"
            }`
      };
    }

    if (question.trim()) {
      return {
        title: learningMode === "study" ? "文字问题已准备好，可以开始学习模式" : "文字问题已准备好，可以直接求解",
        description:
          learningMode === "study"
            ? "系统会先提示和追问，再让你决定是否查看完整讲解；如果是图形题，也可以补上传图片。"
            : "如果题干已经足够完整，直接文字提问最快；如果是图形题，也可以补上传图片。"
      };
    }

    if (launchIntent === "image") {
      return {
        title: "先上传题目图片",
        description: "支持一题多图，适合长题干、图形题和题干选项分开拍摄的场景。"
      };
    }

    return {
      title: "先输入题目或上传图片",
      description: "文字提问适合直接求解，拍照识题更适合图形题、手写题和长题干。"
    };
  })();
  const resultSummary = answer
    ? studyResult
      ? answer.answer.trim()
        ? "完整讲解已经揭晓，接下来最重要的是复盘：不用看答案，再说一遍为什么这么做。"
        : "当前仍在学习模式中，答案默认锁定。先完成提示、追问和知识检查，再决定是否揭晓讲解。"
      : resultOrigin === "image"
        ? "图片题目已识别完成，建议先核对题干，再根据讲解决定是否需要重新求解或分享给老师。"
        : resultOrigin === "refine"
          ? "这是按你编辑后的题目重新生成的结果，可以直接对比并判断是否更贴合原题。"
          : "文字问题已经讲解完成，适合直接复制答案、继续追问或发给老师 / 家长。"
    : null;
  const tutorFlowSteps = [
    {
      id: "capture",
      step: "01",
      title: selectedImages.length
        ? `整理题目（已选 ${selectedImages.length} 张图）`
        : question.trim()
          ? "整理题目（文字已就绪）"
          : "整理题目",
      description: selectedImages.length
        ? selectedCropCount
          ? `其中 ${selectedCropCount} 张已经框选题目区域，识题会更稳。`
          : "题图已经准备好，必要时再补一句文字说明。"
        : question.trim()
          ? "题目已经足够开始求解；如果是图形题，可以再补上传图片。"
          : "先输入题目或上传图片，别一开始就纠结答案模式。",
      state: answer ? "done" : selectedImages.length || question.trim() ? "active" : "idle"
    },
    {
      id: "solve",
      step: "02",
      title: learningMode === "study" ? "AI 先带你思考" : "AI 生成讲解",
      description:
        learningMode === "study"
          ? answer
            ? answer.answer.trim()
              ? "提示、追问和完整讲解都已经给到，可以开始复盘。"
              : "当前还在学习模式里，先完成提示与追问，再决定是否揭晓答案。"
            : "学习模式会先提示和追问，不会一上来直接把答案摊开。"
          : answer
            ? "当前讲解已经生成，可以直接核对、重算或继续追问。"
            : "直接讲解适合快速核对；如果想边学边做，切换到学习模式。",
      state: loading ? "active" : answer ? "done" : "idle"
    },
    {
      id: "extend",
      step: "03",
      title: canLoadVariants ? "巩固、分享、继续追问" : "结果出来后继续推进",
      description: canLoadVariants
        ? "结果区支持做变式训练、分享给老师 / 家长、复制答案或回到历史继续追问。"
        : "结果生成后，优先做变式巩固或把关键结论分享给需要协同的人。",
      state: answer ? "active" : "idle"
    }
  ];

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>AI 辅导</h2>
          <div className="section-sub">直接讲解与学习模式双轨并行，支持文字提问、拍照识题、阶段追问、质量提示与历史回放。</div>
        </div>
        <span className="chip">{learningMode === "study" ? "学习模式" : "智能讲解"}</span>
      </div>

      {launchMessage ? (
        <div className="status-note info" style={{ whiteSpace: "pre-line" }}>
          {launchMessage}
        </div>
      ) : null}

      <div className="tutor-stage-banner">
        <div className="tutor-stage-kicker">当前阶段</div>
        <div className="tutor-stage-title">{stageCopy.title}</div>
        <p className="tutor-stage-description">{stageCopy.description}</p>
        <div className="pill-list">
          <span className="pill">{SUBJECT_LABELS[subject] ?? subject}</span>
          <span className="pill">{getGradeLabel(grade)}</span>
          <span className="pill">{answer ? resolvedModeLabel : selectedModeLabel}</span>
          <span className="pill">题图 {selectedImages.length}/{MAX_IMAGE_COUNT} 张</span>
          {selectedCropCount ? <span className="pill">已框选 {selectedCropCount} 张</span> : null}
        </div>
      </div>

      <div className="tutor-jump-row">
        <a className="button ghost" href="#tutor-composer-anchor">去输入区</a>
        <a className="button ghost" href={answer ? "#tutor-answer-anchor" : "#tutor-history-anchor"}>
          {answer ? "看当前结果" : "看历史记录"}
        </a>
        <a className="button ghost" href="#tutor-history-anchor">回看历史</a>
      </div>

      <div className="tutor-flow-grid">
        {tutorFlowSteps.map((item) => (
          <div
            key={item.id}
            className={`tutor-flow-card${item.state === "active" ? " active" : item.state === "done" ? " done" : ""}`}
          >
            <div className="tutor-flow-card-head">
              <span className="tutor-flow-step">{item.step}</span>
              <div className="tutor-flow-title">{item.title}</div>
            </div>
            <p className="tutor-flow-description">{item.description}</p>
          </div>
        ))}
      </div>

      <div id="tutor-composer-anchor" />
      <Card title="AI 辅导 / 拍照识题" tag="提问">
        <div className="grid" style={{ gap: 12 }}>
          <div className="grid grid-3">
            <label>
              <div className="section-title">学科</div>
              <select
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {SUBJECT_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">年级</div>
              <select
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {GRADE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="card tutor-image-status-card" style={{ minHeight: 84, display: "grid", alignContent: "center" }}>
              <div className="section-title">题图状态</div>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                已选 {selectedImages.length} / {MAX_IMAGE_COUNT} 张题图{selectedCropCount ? ` · 已框选 ${selectedCropCount} 张` : ""}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                {selectedImages.length
                  ? question.trim()
                    ? learningMode === "study"
                      ? "可直接进入学习模式，当前文字会作为补充说明。"
                      : "可直接开始识题，当前文字会作为补充说明。"
                    : learningMode === "study"
                      ? "可先识别题目，再进入学习模式。"
                      : "可直接开始识题，也可以先补充一句文字说明。"
                  : learningMode === "study"
                    ? selectedLearningMode.description
                    : selectedAnswerMode.description}
              </div>
            </div>
          </div>

          <div className="grid" style={{ gap: 8 }}>
            <div className="section-title">交互模式</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 8
              }}
            >
              {LEARNING_MODE_OPTIONS.map((option) => {
                const selected = option.value === learningMode;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className="button secondary"
                    aria-pressed={selected}
                    onClick={() => setLearningMode(option.value)}
                    style={{
                      minHeight: 64,
                      justifyContent: "flex-start",
                      textAlign: "left",
                      borderColor: selected ? "var(--brand, #6366f1)" : undefined,
                      background: selected ? "rgba(99, 102, 241, 0.08)" : undefined
                    }}
                  >
                    <span style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontWeight: 600 }}>{option.label}</span>
                      <span style={{ fontSize: 12, color: "var(--ink-1)" }}>{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {learningMode === "direct" ? (
            <div className="grid" style={{ gap: 8 }}>
              <div className="section-title">答案模式</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 8
                }}
              >
                {ANSWER_MODE_OPTIONS.map((option) => {
                  const selected = option.value === answerMode;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className="button secondary"
                      aria-pressed={selected}
                      onClick={() => setAnswerMode(option.value)}
                      style={{
                        minHeight: 56,
                        justifyContent: "flex-start",
                        textAlign: "left",
                        borderColor: selected ? "var(--brand, #6366f1)" : undefined,
                        background: selected ? "rgba(99, 102, 241, 0.08)" : undefined
                      }}
                    >
                      <span style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontWeight: 600 }}>{option.label}</span>
                        <span style={{ fontSize: 12, color: "var(--ink-1)" }}>{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="status-note info" style={{ marginTop: -2 }}>
              学习模式会先给提示、追问和知识检查；只有在你需要时，才揭晓完整讲解。
            </div>
          )}

          <label>
            <div className="section-title">{learningMode === "study" ? "输入题目或学习任务" : "输入你的问题或补充说明"}</div>
            <textarea
              ref={questionInputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              placeholder={
                learningMode === "study"
                  ? "例如：我想先自己做，请用学习模式带我做这道题；如果识别有误，以我输入的文字为准。"
                  : "例如：如果识别有误，请以我输入的文字为准；或者要求只给答案。"
              }
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>

          {learningMode === "study" ? (
            <label>
              <div className="section-title">先写下你的想法（可选）</div>
              <textarea
                value={studyThinking}
                onChange={(event) => setStudyThinking(event.target.value)}
                rows={3}
                placeholder="例如：我觉得应该先找已知条件，再判断用哪个公式。"
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
          ) : null}

          <div className="status-note" style={{ marginTop: -4 }}>
            {learningMode === "study"
              ? "支持一题多图。学习模式会先识别题目，再通过提示、追问和知识检查推进。"
              : "支持一题多图，适合题干较长、图形题、选项与题干分开拍摄的场景。"}
          </div>

          <div
            className="card"
            style={{
              display: "grid",
              gap: 12,
              borderColor: launchIntent === "image" ? "rgba(99, 102, 241, 0.36)" : undefined,
              boxShadow: launchIntent === "image" ? "0 16px 40px rgba(99, 102, 241, 0.08)" : undefined
            }}
          >
            <div>
              <div className="section-title">{learningMode === "study" ? "拍照识题后进入学习模式" : "拍照或上传题目图片"}</div>
              <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                {learningMode === "study"
                  ? "在图片上按住并拖拽框出题目区域；识别完成后会先进入提示与追问，而不是直接给答案。"
                  : "在图片上按住并拖拽框出题目区域；不框选时默认上传原图。"}
              </div>
            </div>

            <div className="cta-row">
              <label className="button secondary" style={{ cursor: "pointer", minHeight: 44 }}>
                {selectedImages.length ? "继续添加图片" : "选择图片"}
                <input
                  type="file"
                  multiple
                  accept={ALLOWED_IMAGE_TYPES.join(",")}
                  capture="environment"
                  onChange={handleImageSelect}
                  style={{ display: "none" }}
                />
              </label>
              <button className="button secondary" onClick={clearSelectedImages} disabled={loading || !selectedImages.length}>
                清空图片
              </button>
              <span style={{ fontSize: 12, color: "var(--ink-1)" }}>
                最多 {MAX_IMAGE_COUNT} 张，每张不超过 {MAX_IMAGE_SIZE_MB}MB
              </span>
            </div>

            {previewItems.length ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 12
                }}
              >
                {previewItems.map((previewItem, index) => {
                  const selection = cropSelections[index] ?? null;
                  return (
                    <div key={`${selectedImages[index]?.name ?? "preview"}-${index}`} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div className="section-title">第 {index + 1} 张 · {selectedImages[index]?.name ?? "题图"}</div>
                        <span className="pill">{getCropSummary(selection)}</span>
                      </div>

                      <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 6, marginBottom: 8 }}>
                        可重复拖拽重新框选；如果不满意，点击“清除框选”后再试一次。
                      </div>

                      <div
                        style={{
                          position: "relative",
                          borderRadius: 16,
                          overflow: "hidden",
                          border: "1px solid var(--stroke)",
                          background: "rgba(255,255,255,0.72)"
                        }}
                      >
                        <Image
                          src={previewItem.url}
                          alt={`待识别题目预览 ${index + 1}`}
                          width={previewItem.width}
                          height={previewItem.height}
                          unoptimized
                          style={{ width: "100%", height: "auto", display: "block" }}
                        />
                        <div
                          role="presentation"
                          onPointerDown={(event) => handleCropPointerDown(index, event)}
                          onPointerMove={(event) => handleCropPointerMove(index, event)}
                          onPointerUp={(event) => finishCropPointer(index, event)}
                          onPointerCancel={(event) => finishCropPointer(index, event)}
                          style={{
                            position: "absolute",
                            inset: 0,
                            cursor: loading ? "not-allowed" : "crosshair",
                            touchAction: "none"
                          }}
                        />
                        {shouldRenderCrop(selection) ? (
                          <div
                            style={{
                              position: "absolute",
                              left: `${selection!.x}%`,
                              top: `${selection!.y}%`,
                              width: `${selection!.width}%`,
                              height: `${selection!.height}%`,
                              borderRadius: 12,
                              border: "2px solid var(--brand, #6366f1)",
                              background: "rgba(99, 102, 241, 0.14)",
                              boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.22)",
                              pointerEvents: "none"
                            }}
                          />
                        ) : null}
                      </div>

                      <div className="cta-row" style={{ marginTop: 10 }}>
                        <button
                          className="button secondary"
                          onClick={() => clearCropSelection(index)}
                          disabled={loading || !hasCrop(selection)}
                        >
                          清除框选
                        </button>
                        <button className="button secondary" onClick={() => removeSelectedImage(index)} disabled={loading}>
                          移除这张
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="cta-row">
            {learningMode === "study" ? (
              <>
                <button
                  className={launchIntent === "image" ? "button secondary" : "button primary"}
                  onClick={() => void handleStartStudyMode()}
                  disabled={loading || (!question.trim() && !selectedImages.length)}
                >
                  {activeAction === "study" || activeAction === "study_image"
                    ? selectedImages.length
                      ? "进入学习模式中..."
                      : "启动学习模式中..."
                    : selectedImages.length
                      ? `拍照进入学习模式（${selectedImages.length}）`
                      : question.trim()
                        ? "开始学习模式"
                        : "学习模式"}
                </button>
                <button className="button secondary" type="button" onClick={handleAsk} disabled={loading || !question.trim()}>
                  按文字直接讲解
                </button>
              </>
            ) : (
              <>
                <button
                  className={launchIntent === "image" ? "button secondary" : "button primary"}
                  onClick={handleAsk}
                  disabled={loading || !question.trim()}
                >
                  {activeAction === "text" ? "思考中..." : question.trim() ? "按文字求解" : "文字提问"}
                </button>
                <button
                  className={launchIntent === "image" ? "button primary" : "button secondary"}
                  onClick={handleImageAsk}
                  disabled={loading || !selectedImages.length}
                >
                  {activeAction === "image" ? "识题中..." : selectedImages.length ? `拍照识题（${selectedImages.length}）` : "拍照识题"}
                </button>
              </>
            )}
            <a className="button ghost" href="#tutor-history-anchor">看历史</a>
          </div>

          {actionMessage && !answer ? (
            <div className="status-note success" style={{ marginTop: 4 }}>
              {actionMessage}
            </div>
          ) : null}

          {error ? (
            <div className="status-note error" style={{ marginTop: 4 }}>
              {error}
            </div>
          ) : null}
        </div>
      </Card>

      <div id="tutor-answer-anchor" ref={answerSectionRef} />
      {answer ? (
        <Card title="AI 讲解" tag="讲解">
          <div className="cta-row" style={{ marginBottom: 10 }}>
            <span className="pill">{SUBJECT_LABELS[subject] ?? subject}</span>
            <span className="pill">{getGradeLabel(grade)}</span>
            <span className="pill">{resolvedModeLabel}</span>
            <span className="pill">{getOriginLabel(resultOrigin)}</span>
            {answer.provider ? <span className="pill">模型：{answer.provider}</span> : null}
          </div>

          {actionMessage && answer ? <div className="status-note success" style={{ marginBottom: 10 }}>{actionMessage}</div> : null}
          {resultSummary ? <div className="tutor-result-summary">{resultSummary}</div> : null}
          <div className="cta-row tutor-result-next-actions" style={{ marginBottom: 12 }}>
            <button className="button secondary" type="button" onClick={handleStartOver}>
              再问一题
            </button>
            <button className="button ghost" type="button" onClick={focusComposerInput}>
              回到提问区
            </button>
            <a className="button ghost" href="#tutor-history-anchor">
              看历史记录
            </a>
          </div>

          {answer.quality ? (
            <>
              <div className={`status-note ${getQualityToneClass(answer.quality.riskLevel)}`} style={{ marginBottom: 10 }}>
                可信度 {answer.quality.confidenceScore}/100 · {QUALITY_RISK_LABELS[answer.quality.riskLevel]} · {answer.quality.fallbackAction}
              </div>
              {answer.quality.reasons.length ? (
                <div className="pill-list" style={{ marginBottom: 12 }}>
                  {answer.quality.reasons.map((reason) => (
                    <span className="pill" key={reason}>
                      {reason}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {studyResult ? (
            <>
              <div className="card" style={{ marginBottom: 12, display: "grid", gap: 10 }}>
                <div className="cta-row">
                  {answer.stageLabel ? <span className="badge">{answer.stageLabel}</span> : null}
                  {answer.masteryFocus ? <span className="pill">本轮重点：{answer.masteryFocus}</span> : null}
                  {answer.answerAvailable && !answer.answer.trim() ? <span className="pill">答案已锁定</span> : null}
                </div>
                {answer.coachReply ? <MathText as="div" text={answer.coachReply} /> : null}
                {answer.memory ? (
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                    {answer.memory.patternHint}
                    {answer.memory.recentQuestions?.length ? ` · 最近题目：${answer.memory.recentQuestions.slice(0, 3).join("；")}` : ""}
                  </div>
                ) : null}
              </div>

              {answer.knowledgeChecks?.length ? (
                <div className="grid" style={{ gap: 6, marginBottom: 12 }}>
                  <div className="badge">知识检查</div>
                  {answer.knowledgeChecks.map((item) => (
                    <MathText as="div" key={item} text={item} />
                  ))}
                </div>
              ) : null}

              {visibleStudyHints.length ? (
                <div className="grid" style={{ gap: 6, marginBottom: 12 }}>
                  <div className="badge">当前提示</div>
                  {visibleStudyHints.map((item) => (
                    <MathText as="div" key={item} text={item} />
                  ))}
                </div>
              ) : null}

              {answer.nextPrompt ? (
                <div className="status-note info" style={{ marginBottom: 12 }}>
                  下一步：{answer.nextPrompt}
                </div>
              ) : null}

              {!answer.answer.trim() ? (
                <div className="card" style={{ marginBottom: 12, display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <div className="section-title">我的当前思路</div>
                    <textarea
                      value={studyThinking}
                      onChange={(event) => setStudyThinking(event.target.value)}
                      rows={3}
                      placeholder="先说说你会怎么下手，系统会按你的思路继续追问。"
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                    />
                  </label>
                  <div className="cta-row">
                    <button className="button secondary" type="button" onClick={handleSubmitStudyThinking} disabled={loading || !studyThinking.trim()}>
                      {activeAction === "study" ? "提交中..." : "提交我的思路"}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setStudyHintCount((prev) => Math.min(prev + 1, answer.hints?.length ?? 0))}
                      disabled={loading || studyHintCount >= (answer.hints?.length ?? 0)}
                    >
                      再给我一点提示
                    </button>
                    <button className="button ghost" type="button" onClick={handleRevealStudyAnswer} disabled={loading || !answer.answerAvailable}>
                      {answer.revealAnswerCta ?? "查看完整讲解"}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            <div className="badge">识别到的题目 / 可编辑后再{studyResult ? "开始学习模式" : "求解"}</div>
            <textarea
              value={editableQuestion}
              onChange={(event) => setEditableQuestion(event.target.value)}
              rows={4}
              placeholder="识别后的题目会显示在这里，你可以手动修正后重新求解。"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>

          <div className="cta-row" style={{ marginBottom: 12 }}>
            <button className="button secondary" onClick={handleRefineSolve} disabled={loading || !editableQuestion.trim()}>
              {activeAction === "refine" ? "处理中..." : studyResult ? "按编辑题目重新开始学习模式" : "按编辑题目重新求解"}
            </button>
            <button className="button secondary" onClick={() => setQuestion(editableQuestion.trim())} disabled={!editableQuestion.trim()}>
              同步到提问框
            </button>
            <button className="button secondary" onClick={() => void handleCopy(editableQuestion, "已复制题目")}>复制题目</button>
            <button className="button secondary" onClick={() => void handleCopy(answer.answer, "已复制答案")} disabled={!answer.answer.trim()}>
              复制答案
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={handleLoadVariants}
              disabled={loading || loadingVariants || !canLoadVariants || Boolean(variantPack?.variants?.length)}
            >
              {loadingVariants ? "生成变式中..." : variantPack?.variants?.length ? "变式已生成" : "做变式巩固"}
            </button>
          </div>

          {answer.answer.trim() ? (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="section-title">一键同步给老师 / 家长</div>
              <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 6 }}>
                将题目、答案、关键步骤和可信度同步到站内信，方便老师继续答疑或家长及时跟进。
              </div>

              {shareTargetsLoading && !shareTargetsLoaded ? (
                <div className="status-note info" style={{ marginTop: 10 }}>
                  正在加载可分享对象...
                </div>
              ) : null}

              {shareTargetsLoaded && !shareTargets.length ? (
                <div style={{ marginTop: 12 }}>
                  <StatePanel
                    compact
                    tone="info"
                    title="当前没有可分享对象"
                    description="加入班级或绑定家长后，这里会自动开放老师 / 家长分享。"
                  />
                </div>
              ) : null}

              {teacherShareTargets.length ? (
                <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                  <div className="badge">发给老师</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                    {teacherShareTargets.map((target) => {
                      const submitting = shareSubmittingTargetId === target.id;
                      return (
                        <button
                          key={target.id}
                          type="button"
                          className="button secondary"
                          onClick={() => void handleShareResult(target)}
                          disabled={loading || Boolean(shareSubmittingTargetId)}
                          style={{ minHeight: 56, justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal" }}
                        >
                          <span style={{ display: "grid", gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>{submitting ? "发送中..." : getShareTargetActionLabel(target)}</span>
                            <span style={{ fontSize: 12, color: "var(--ink-1)" }}>
                              {target.description}
                              {target.contextLabels.length ? ` · ${target.contextLabels.join("、")}` : ""}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {parentShareTargets.length ? (
                <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                  <div className="badge">发给家长</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                    {parentShareTargets.map((target) => {
                      const submitting = shareSubmittingTargetId === target.id;
                      return (
                        <button
                          key={target.id}
                          type="button"
                          className="button secondary"
                          onClick={() => void handleShareResult(target)}
                          disabled={loading || Boolean(shareSubmittingTargetId)}
                          style={{ minHeight: 56, justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal" }}
                        >
                          <span style={{ display: "grid", gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>{submitting ? "发送中..." : getShareTargetActionLabel(target)}</span>
                            <span style={{ fontSize: 12, color: "var(--ink-1)" }}>
                              {target.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {shareError ? (
                <div className="status-note error" style={{ marginTop: 10 }}>
                  {shareError}
                </div>
              ) : null}

              {shareSuccess ? (
                <>
                  <div className="status-note success" style={{ marginTop: 10 }}>
                    已{shareSuccess.reused ? "继续" : ""}发送给 {shareSuccess.targetName}，可前往站内信继续沟通。
                  </div>
                  <div className="cta-row" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => router.push(`/inbox?threadId=${encodeURIComponent(shareSuccess.threadId)}`)}
                    >
                      查看站内信
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : studyResult ? (
            <div className="status-note info" style={{ marginBottom: 12 }}>
              当前仍在学习模式中，答案未揭晓前不会开放分享，避免把完整解法过早发出去。
            </div>
          ) : null}

          {answer.answer.trim() ? (
            <div className="grid" style={{ gap: 8 }}>
              <div className="badge">答案</div>
              <MathText as="div" text={answer.answer} />
            </div>
          ) : studyResult ? (
            <div className="status-note info">答案当前仍保持锁定。先完成思路表达和知识检查，需要时再揭晓完整讲解。</div>
          ) : null}

          {studyResult && answer.answer.trim() && answer.steps?.length ? (
            <div className="grid" style={{ gap: 6, marginTop: 12 }}>
              <div className="badge">完整讲解步骤</div>
              {answer.steps.map((item) => (
                <MathText as="div" key={`study-step-${item}`} text={item} />
              ))}
            </div>
          ) : null}

          {!studyResult
            ? answerSections.map((section) =>
                section.items.length ? (
                  <div key={section.key} className="grid" style={{ gap: 6, marginTop: 12 }}>
                    <div className="badge">{section.title}</div>
                    {section.items.map((item) => (
                      <MathText as="div" key={`${section.key}-${item}`} text={item} />
                    ))}
                  </div>
                ) : null
              )
            : null}

          {variantPack ? (
            <div className="card" style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div className="section-title">迁移巩固</div>
                <div className="pill-list">
                  {variantPack.knowledgePointTitle ? <span className="pill">{variantPack.knowledgePointTitle}</span> : null}
                  <span className="pill">
                    {variantPack.sourceMode === "pool" ? "题库变式" : variantPack.sourceMode === "fallback" ? "概念迁移题" : "AI 变式"}
                  </span>
                </div>
              </div>
              <div className="status-note info">{variantPack.transferGoal}</div>
              <div className="grid" style={{ gap: 10 }}>
                {variantPack.variants.map((variant, index) => {
                  const selected = variantAnswers[index] ?? "";
                  const checked = variantResults[index];
                  return (
                    <div className="card" key={`${variant.stem}-${index}`}>
                      <div className="badge">变式题 {index + 1}</div>
                      <div style={{ marginTop: 8 }}>
                        <MathText as="div" text={variant.stem} />
                      </div>
                      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                        {variant.options.map((option) => (
                          <label
                            key={`${variant.stem}-${option}`}
                            className="card"
                            style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", minHeight: 44 }}
                          >
                            <input
                              type="radio"
                              name={`tutor-variant-${index}`}
                              checked={selected === option}
                              onChange={() => handleVariantAnswerChange(index, option)}
                              style={{ marginTop: 4 }}
                            />
                            <MathText as="div" text={option} />
                          </label>
                        ))}
                      </div>
                      <div className="cta-row" style={{ marginTop: 10 }}>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => handleVariantSubmit(index, selected, variant.answer)}
                          disabled={!selected || savingVariantProgressIndex === index || (variantCommittedAnswers[index] === selected && checked !== undefined && checked !== null)}
                        >
                          {savingVariantProgressIndex === index ? "计入成长中..." : "提交本题"}
                        </button>
                      </div>
                      {checked !== undefined && checked !== null ? (
                        <div className={`status-note ${checked ? "success" : "info"}`} style={{ marginTop: 10 }}>
                          {checked ? "回答正确" : "回答错误"} · 正确答案：{variant.answer}
                        </div>
                      ) : null}
                      {checked !== undefined && checked !== null ? (
                        <div style={{ marginTop: 8 }}>
                          <MathText as="div" text={variant.explanation} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="cta-row">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    void loadVariantReflection("manual");
                  }}
                  disabled={!submittedVariantCount || loadingVariantReflection}
                >
                  {loadingVariantReflection ? "生成复盘中..." : variantReflection ? "更新学习复盘" : "生成学习复盘"}
                </button>
                <span style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  已提交 {submittedVariantCount}/{variantPack.variants.length} 题
                </span>
              </div>
              {loadingVariantReflection ? (
                <div className="status-note info">系统正在汇总这轮迁移表现，并补出重点错因与下一步建议。</div>
              ) : null}
              {variantProgress ? (
                <div className="card" style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div className="section-title">学习成长更新</div>
                    <div className="pill-list">
                      <span className="pill">{variantProgress.persisted ? "已计入成长" : "未计入成长"}</span>
                      {variantProgress.mastery ? <span className="pill">掌握 {variantProgress.mastery.masteryScore}</span> : null}
                      {variantProgress.mastery && typeof variantProgress.mastery.weaknessRank === "number" ? (
                        <span className="pill">薄弱度第 {variantProgress.mastery.weaknessRank} 位</span>
                      ) : null}
                    </div>
                  </div>
                  <div className={`status-note ${variantProgress.persisted ? "success" : "info"}`}>{variantProgress.message}</div>
                  {variantProgress.mastery ? (
                    <div className="pill-list">
                      <span className="pill">
                        变化 {variantProgress.mastery.masteryDelta > 0 ? "+" : ""}
                        {variantProgress.mastery.masteryDelta}
                      </span>
                      <span className="pill">信心 {variantProgress.mastery.confidenceScore}</span>
                      <span className="pill">
                        7日趋势 {variantProgress.mastery.masteryTrend7d > 0 ? "+" : ""}
                        {variantProgress.mastery.masteryTrend7d}
                      </span>
                      <span className="pill">
                        作答 {variantProgress.mastery.correct}/{variantProgress.mastery.total}
                      </span>
                    </div>
                  ) : null}
                  {variantProgress.plan ? (
                    <div className="card" style={{ display: "grid", gap: 6 }}>
                      <div className="badge">计划联动</div>
                      <div>
                        该知识点已同步到学习计划：目标 {variantProgress.plan.targetCount} 题，截止{" "}
                        {new Date(variantProgress.plan.dueDate).toLocaleDateString("zh-CN")}。
                      </div>
                      <div style={{ color: "var(--ink-1)", fontSize: 13 }}>推荐理由：{variantProgress.plan.recommendedReason}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {variantReflection ? (
                <div className="card" style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div className="section-title">学习复盘</div>
                    <div className="pill-list">
                      <span className="pill">{variantReflection.masteryLabel}</span>
                      <span className="pill">
                        正确 {variantReflection.correctCount}/{variantReflection.total}
                      </span>
                      <span className="pill">{variantReflection.detailSource === "ai" ? "AI 错因解释" : "规则兜底复盘"}</span>
                    </div>
                  </div>
                  <div className={`status-note ${variantReflection.masteryLevel === "secure" ? "success" : "info"}`}>
                    {variantReflection.summary}
                  </div>
                  {variantReflection.strengths.length ? (
                    <div className="grid" style={{ gap: 6 }}>
                      <div className="badge">这次做对了什么</div>
                      {variantReflection.strengths.map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  ) : null}
                  {variantReflection.improvements.length ? (
                    <div className="grid" style={{ gap: 6 }}>
                      <div className="badge">还要补哪里</div>
                      {variantReflection.improvements.map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  ) : null}
                  <div className="card" style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <div className="badge">{variantReflection.detail.title}</div>
                      {variantReflection.detail.variantStem ? (
                        <span className="pill">聚焦：{truncateText(variantReflection.detail.variantStem, 28)}</span>
                      ) : null}
                    </div>
                    <MathText as="div" text={variantReflection.detail.analysis} />
                    {variantReflection.detail.hints.length ? (
                      <div className="grid" style={{ gap: 6 }}>
                        {variantReflection.detail.hints.map((hint) => (
                          <MathText as="div" key={hint} text={hint} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {variantReflection.nextSteps.length ? (
                    <div className="grid" style={{ gap: 6 }}>
                      <div className="badge">下一步怎么练</div>
                      {variantReflection.nextSteps.map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {answer.source?.length ? (
            <div className="grid" style={{ gap: 6, marginTop: 12 }}>
              <div className="badge">参考来源</div>
              <div className="pill-list">
                {answer.source.map((item) => (
                  <span className="pill" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div id="tutor-history-anchor" />
      <Card title="AI 对话历史" tag="记录">
        <div className="grid grid-3" style={{ marginBottom: 12 }}>
          <label>
            <div className="section-title">搜索历史</div>
            <input
              value={historyKeyword}
              onChange={(event) => setHistoryKeyword(event.target.value)}
              placeholder="搜索题目、答案、标签或来源"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <div className="card">
            <div className="section-title">来源筛选</div>
            <div className="cta-row cta-row-tight" style={{ marginTop: 8 }}>
              {HISTORY_ORIGIN_OPTIONS.map((option) => {
                const selected = historyOriginFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={selected ? "button secondary" : "button ghost"}
                    onClick={() => setHistoryOriginFilter(option.value)}
                    aria-pressed={selected}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="card">
            <div className="section-title">历史概览</div>
            <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 8, display: "grid", gap: 4 }}>
              <div>总记录 {history.length} 条</div>
              <div>图片识题 {historyImageCount} 条</div>
              <div>收藏记录 {favoriteHistoryCount} 条</div>
            </div>
          </div>
        </div>

        <div className="cta-row tutor-history-toolbar" style={{ marginBottom: 12 }}>
          <button className="button secondary" onClick={() => setShowFavorites((prev) => !prev)}>
            {showFavorites ? "查看全部" : "只看收藏"}
          </button>
          {hasActiveHistoryFilters ? (
            <button className="button ghost" type="button" onClick={clearHistoryFilters}>
              清空筛选
            </button>
          ) : null}
          <a className="button ghost" href="#tutor-composer-anchor">回到提问区</a>
          <span className="chip">当前结果 {filteredHistory.length} 条</span>
          {historyKeyword.trim() ? <span className="chip">关键词：{historyKeyword.trim()}</span> : null}
        </div>

        <div className="grid" style={{ gap: 10 }}>
          {filteredHistory.length === 0 ? (
            <StatePanel
              compact
              tone="empty"
              title={hasActiveHistoryFilters ? "当前筛选条件下暂无记录" : "还没有 AI 辅导历史"}
              description={hasActiveHistoryFilters ? "可以清空筛选后再试试。" : "先完成一次文字提问或拍照识题，这里会自动保留历史。"}
              action={
                hasActiveHistoryFilters ? (
                  <button className="button secondary" type="button" onClick={clearHistoryFilters}>
                    清空筛选
                  </button>
                ) : (
                  <a className="button secondary" href="#tutor-composer-anchor">
                    去提问区
                  </a>
                )
              }
            />
          ) : null}
          {filteredHistory.map((item) => {
            const meta = item.meta;
            return (
              <div className="card" key={item.id}>
                <div className="workflow-card-meta" style={{ marginBottom: 8 }}>
                  <span className="chip">{getOriginLabel(meta?.origin)}</span>
                  {meta?.learningMode === "study" ? <span className="chip">学习模式</span> : null}
                  {meta?.subject ? <span className="chip">{SUBJECT_LABELS[meta.subject] ?? meta.subject}</span> : null}
                  {meta?.grade ? <span className="chip">{getGradeLabel(meta.grade)}</span> : null}
                  {meta?.answerMode ? (
                    <span className="chip">{ANSWER_MODE_OPTIONS.find((option) => option.value === meta.answerMode)?.label ?? meta.answerMode}</span>
                  ) : null}
                  {meta?.imageCount ? <span className="chip">题图 {meta.imageCount} 张</span> : null}
                  {meta?.quality ? <span className="chip">可信度 {meta.quality.confidenceScore}</span> : null}
                </div>

                <div className="section-title">
                  <MathText as="div" text={item.question} />
                </div>
                <div style={{ color: "var(--ink-1)", marginTop: 8 }}>
                  <MathText as="div" text={truncateText(item.answer)} />
                </div>

                {meta?.quality ? (
                  <div className={`status-note ${getQualityToneClass(meta.quality.riskLevel)}`} style={{ marginTop: 10 }}>
                    {QUALITY_RISK_LABELS[meta.quality.riskLevel]} · {meta.quality.fallbackAction}
                  </div>
                ) : null}

                {item.tags.length ? <div style={{ marginTop: 8, fontSize: 12 }}>标签：{item.tags.join("、")}</div> : null}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                  <button className="button secondary" onClick={() => reuseHistoryItem(item)}>
                    复用到提问框
                  </button>
                  <button className="button secondary" onClick={() => toggleFavorite(item)}>
                    {item.favorite ? "已收藏" : "收藏"}
                  </button>
                  <button className="button secondary" onClick={() => editTags(item)}>
                    编辑标签
                  </button>
                  <button className="button ghost" onClick={() => void handleCopy(item.answer, "已复制历史答案")}>
                    复制答案
                  </button>
                  <button className="button ghost" onClick={() => deleteHistory(item)}>
                    删除
                  </button>
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>{new Date(item.createdAt).toLocaleString("zh-CN")}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
