"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import {
  getRequestErrorMessage,
  getRequestStatus,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  AiQuestionForm,
  KnowledgePoint,
  Question,
  QuestionFacets,
  QuestionForm,
  QuestionGenerateResponse,
  QuestionImportItemPayload,
  QuestionImportResponse,
  QuestionListPayload,
  QuestionProcessFailedItem,
  QuestionQualityResultItem,
  QuestionQualitySummary,
  QuestionQuery,
  QuestionTreeNode
} from "./types";
import { parseCsv, parseListText, resolveAdminQuestionKnowledgePointId } from "./utils";

type QuestionQualityRecheckResponse = {
  data?: {
    scope?: {
      processedCount?: number;
    };
    summary?: {
      updated?: number;
      newlyTracked?: number;
      highRiskCount?: number;
      isolatedCount?: number;
    };
  };
};

const INITIAL_QUERY: QuestionQuery = {
  subject: "all",
  grade: "all",
  chapter: "all",
  difficulty: "all",
  questionType: "all",
  search: "",
  pool: "all",
  riskLevel: "all",
  answerConflict: "all",
  duplicateClusterId: ""
};

const INITIAL_FACETS: QuestionFacets = {
  subjects: [],
  grades: [],
  chapters: [],
  difficulties: [],
  questionTypes: []
};

const INITIAL_FORM: QuestionForm = {
  subject: "math",
  grade: "4",
  knowledgePointId: "",
  stem: "",
  options: "",
  answer: "",
  explanation: "",
  difficulty: "medium",
  questionType: "choice",
  tags: "",
  abilities: ""
};

const INITIAL_AI_FORM: AiQuestionForm = {
  subject: "math",
  grade: "4",
  knowledgePointId: "",
  count: 1,
  difficulty: "medium",
  mode: "single",
  chapter: ""
};

function getNormalizedAdminQuestionsMessage(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase();
}

function isQuestionMissingError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getNormalizedAdminQuestionsMessage(error);
  return requestMessage === "question not found" || (status === 404 && requestMessage === "not found");
}

function isKnowledgePointSelectionError(error: unknown) {
  const requestMessage = getNormalizedAdminQuestionsMessage(error);
  return requestMessage === "knowledge point not found" || requestMessage === "knowledge point mismatch";
}

function getAdminQuestionsErrorMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getNormalizedAdminQuestionsMessage(error);

  if (status === 401 || status === 403) {
    return "管理员会话已失效，请重新登录后继续操作。";
  }
  if (requestMessage === "missing fields") {
    return "请填写完整的题目信息后再提交。";
  }
  if (requestMessage === "invalid subject") {
    return "学科参数无效，请刷新页面后重试。";
  }
  if (requestMessage === "items required") {
    return "没有可导入的题目，请检查导入内容后重试。";
  }
  if (requestMessage === "knowledge point not found") {
    return "所选知识点不存在，请刷新知识点列表后重试。";
  }
  if (requestMessage === "knowledge point mismatch") {
    return "所选知识点与当前学科不匹配，请重新选择知识点。";
  }
  if (requestMessage === "no knowledge points") {
    return "当前筛选范围没有可用于生成的知识点，请先创建知识点。";
  }
  if (requestMessage === "questionid required") {
    return "题目标识缺失，请刷新页面后重试。";
  }
  if (requestMessage === "isolated required") {
    return "隔离池状态无效，请刷新页面后重试。";
  }
  if (requestMessage === "question not found" || (status === 404 && requestMessage === "not found")) {
    return "题目不存在，可能已被其他管理员删除。";
  }
  if (requestMessage === "quality metric not found") {
    return "该题目暂无质检记录，请先执行批量重算。";
  }
  if (requestMessage === "no questions matched") {
    return "当前筛选条件下没有可重算的题目。";
  }
  if (requestMessage === "no questions to recheck") {
    return "当前范围内没有可重算的题目，请调整范围后重试。";
  }
  return getRequestErrorMessage(error, fallback);
}

export function useAdminQuestionsPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const knowledgePointsRequestIdRef = useRef(0);
  const questionsRequestIdRef = useRef(0);
  const importRequestIdRef = useRef(0);
  const aiRequestIdRef = useRef(0);
  const createRequestIdRef = useRef(0);
  const listActionRequestIdRef = useRef(0);
  const recheckRequestIdRef = useRef(0);
  const queryRef = useRef<QuestionQuery>(INITIAL_QUERY);
  const pageRef = useRef(1);
  const pageSizeRef = useRef(20);
  const hasKnowledgePointsSnapshotRef = useRef(false);
  const [list, setList] = useState<Question[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [workspace, setWorkspace] = useState<"list" | "tools">("list");
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<QuestionQuery>(INITIAL_QUERY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [tree, setTree] = useState<QuestionTreeNode[]>([]);
  const [qualitySummary, setQualitySummary] = useState<QuestionQualitySummary | null>(null);
  const [facets, setFacets] = useState<QuestionFacets>(INITIAL_FACETS);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [form, setForm] = useState<QuestionForm>(INITIAL_FORM);
  const [aiForm, setAiForm] = useState<AiQuestionForm>(INITIAL_AI_FORM);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<string[]>([]);
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckMessage, setRecheckMessage] = useState<string | null>(null);
  const [recheckError, setRecheckError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pageActionError, setPageActionError] = useState<string | null>(null);
  const [knowledgePointsLoadError, setKnowledgePointsLoadError] = useState<string | null>(null);
  const [questionsLoadError, setQuestionsLoadError] = useState<string | null>(null);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  const chapterOptions = useMemo(() => {
    const filtered = knowledgePoints.filter(
      (kp) => kp.subject === aiForm.subject && kp.grade === aiForm.grade
    );
    const chapters = filtered.map((kp) => kp.chapter).filter(Boolean);
    return Array.from(new Set(chapters));
  }, [knowledgePoints, aiForm.subject, aiForm.grade]);

  const aiKnowledgePoints = useMemo(
    () => knowledgePoints.filter((kp) => kp.subject === aiForm.subject && kp.grade === aiForm.grade),
    [knowledgePoints, aiForm.subject, aiForm.grade]
  );
  const formKnowledgePoints = useMemo(
    () => knowledgePoints.filter((kp) => kp.subject === form.subject && kp.grade === form.grade),
    [form.grade, form.subject, knowledgePoints]
  );
  const loadError = questionsLoadError ?? knowledgePointsLoadError;

  const handleAuthRequired = useCallback(() => {
    knowledgePointsRequestIdRef.current += 1;
    questionsRequestIdRef.current += 1;
    importRequestIdRef.current += 1;
    aiRequestIdRef.current += 1;
    createRequestIdRef.current += 1;
    listActionRequestIdRef.current += 1;
    recheckRequestIdRef.current += 1;
    setLoading(false);
    setAiLoading(false);
    setRecheckLoading(false);
    setAuthRequired(true);
  }, []);

  const removeQuestionFromCurrentPage = useCallback((questionId: string) => {
    setList((current) => current.filter((item) => item.id !== questionId));
    setMeta((current) => {
      const total = Math.max(0, current.total - 1);
      const totalPages = Math.max(1, Math.ceil(total / Math.max(current.pageSize, 1)));
      const page = Math.min(current.page, totalPages);
      return { ...current, total, totalPages, page };
    });
  }, []);

  const loadKnowledgePoints = useCallback(async () => {
    const requestId = knowledgePointsRequestIdRef.current + 1;
    knowledgePointsRequestIdRef.current = requestId;

    try {
      const kpData = await requestJson<{ data?: KnowledgePoint[] }>("/api/admin/knowledge-points");
      if (knowledgePointsRequestIdRef.current !== requestId) {
        return;
      }

      hasKnowledgePointsSnapshotRef.current = true;
      setKnowledgePoints(kpData.data ?? []);
      setAuthRequired(false);
      setKnowledgePointsLoadError(null);
    } catch (error) {
      if (knowledgePointsRequestIdRef.current !== requestId) {
        return;
      }

      if (!hasKnowledgePointsSnapshotRef.current) {
        setKnowledgePoints([]);
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      setKnowledgePointsLoadError(getAdminQuestionsErrorMessage(error, "知识点加载失败"));
    }
  }, [handleAuthRequired]);

  const loadQuestions = useCallback(
    async (options?: { query?: QuestionQuery; page?: number; pageSize?: number }) => {
      const requestId = questionsRequestIdRef.current + 1;
      questionsRequestIdRef.current = requestId;
      const nextQuery = options?.query ?? queryRef.current;
      const nextPage = options?.page ?? pageRef.current;
      const nextPageSize = options?.pageSize ?? pageSizeRef.current;

      setLoading(true);
      const searchParams = new URLSearchParams();
      if (nextQuery.subject !== "all") searchParams.set("subject", nextQuery.subject);
      if (nextQuery.grade !== "all") searchParams.set("grade", nextQuery.grade);
      if (nextQuery.chapter !== "all") searchParams.set("chapter", nextQuery.chapter);
      if (nextQuery.difficulty !== "all") searchParams.set("difficulty", nextQuery.difficulty);
      if (nextQuery.questionType !== "all") searchParams.set("questionType", nextQuery.questionType);
      if (nextQuery.search.trim()) searchParams.set("search", nextQuery.search.trim());
      if (nextQuery.pool !== "all") searchParams.set("pool", nextQuery.pool);
      if (nextQuery.riskLevel !== "all") searchParams.set("riskLevel", nextQuery.riskLevel);
      if (nextQuery.answerConflict !== "all") searchParams.set("answerConflict", nextQuery.answerConflict);
      if (nextQuery.duplicateClusterId.trim()) searchParams.set("duplicateClusterId", nextQuery.duplicateClusterId.trim());
      searchParams.set("page", String(nextPage));
      searchParams.set("pageSize", String(nextPageSize));

      try {
        const qData = await requestJson<QuestionListPayload>(`/api/admin/questions?${searchParams.toString()}`);
        if (questionsRequestIdRef.current !== requestId) {
          return;
        }

        setList(qData.data ?? []);
        setAuthRequired(false);
        setMeta(
          qData.meta ?? {
            total: qData.data?.length ?? 0,
            page: nextPage,
            pageSize: nextPageSize,
            totalPages: 1
          }
        );
        setTree(qData.tree ?? []);
        setQualitySummary(qData.qualitySummary ?? null);
        setFacets({
          subjects: qData.facets?.subjects ?? [],
          grades: qData.facets?.grades ?? [],
          chapters: qData.facets?.chapters ?? [],
          difficulties: qData.facets?.difficulties ?? [],
          questionTypes: qData.facets?.questionTypes ?? []
        });
        setQuestionsLoadError(null);
      } catch (error) {
        if (questionsRequestIdRef.current !== requestId) {
          return;
        }

        if (isAuthError(error)) {
          handleAuthRequired();
          return;
        }
        setQuestionsLoadError(getAdminQuestionsErrorMessage(error, "题库列表加载失败"));
      } finally {
        if (questionsRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [handleAuthRequired]
  );

  useEffect(() => {
    void loadKnowledgePoints();
  }, [loadKnowledgePoints]);

  useEffect(() => {
    void loadQuestions({ query, page, pageSize });
  }, [loadQuestions, page, pageSize, query]);

  useEffect(() => {
    const nextFormKnowledgePointId =
      resolveAdminQuestionKnowledgePointId(knowledgePoints, form.subject, form.grade, form.knowledgePointId) ||
      formKnowledgePoints[0]?.id ||
      "";
    if (nextFormKnowledgePointId !== form.knowledgePointId) {
      setForm((prev) => ({ ...prev, knowledgePointId: nextFormKnowledgePointId }));
    }

    const nextAiKnowledgePointId =
      resolveAdminQuestionKnowledgePointId(knowledgePoints, aiForm.subject, aiForm.grade, aiForm.knowledgePointId) ||
      aiKnowledgePoints[0]?.id ||
      "";
    if (nextAiKnowledgePointId !== aiForm.knowledgePointId) {
      setAiForm((prev) => ({ ...prev, knowledgePointId: nextAiKnowledgePointId }));
    }
  }, [
    aiForm.grade,
    aiForm.knowledgePointId,
    aiForm.subject,
    aiKnowledgePoints,
    form.grade,
    form.knowledgePointId,
    form.subject,
    formKnowledgePoints,
    knowledgePoints
  ]);

  useEffect(() => {
    if (aiForm.mode !== "batch") {
      return;
    }

    const nextChapter =
      aiForm.chapter && chapterOptions.includes(aiForm.chapter) ? aiForm.chapter : chapterOptions[0] ?? "";
    if (nextChapter !== aiForm.chapter) {
      setAiForm((prev) => ({ ...prev, chapter: nextChapter }));
    }
  }, [aiForm.mode, aiForm.chapter, chapterOptions]);

  const patchQuery = useCallback((next: Partial<QuestionQuery>) => {
    setQuery((prev) => ({ ...prev, ...next }));
    setPage(1);
  }, []);

  const isHighRiskQuestionResult = useCallback((item: QuestionQualityResultItem) => {
    return item.duplicateRisk === "high" || item.ambiguityRisk === "high";
  }, []);

  const handleImport = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      const requestId = importRequestIdRef.current + 1;
      importRequestIdRef.current = requestId;
      setImportMessage(null);
      setImportErrors([]);
      setPageActionError(null);
      const text = await file.text();
      if (importRequestIdRef.current !== requestId) {
        return;
      }
      const rows = parseCsv(text);
      if (rows.length < 2) {
        setImportErrors(["CSV 内容不足"]);
        return;
      }
      const headers = rows[0].map((h) => h.trim());
      const items: QuestionImportItemPayload[] = [];
      const errors: string[] = [];

      for (let i = 1; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row.length) continue;
        const record: Record<string, string> = {};
        headers.forEach((key, index) => {
          record[key] = row[index] ?? "";
        });
        const options = (record.options || "")
          .split("|")
          .map((opt) => opt.trim())
          .filter(Boolean);
        const tags = parseListText(record.tags || "");
        const abilities = parseListText(record.abilities || "");
        let knowledgePointId = record.knowledgePointId;
        if (!knowledgePointId && record.knowledgePointTitle) {
          const kp = knowledgePoints.find(
            (item) => item.title === record.knowledgePointTitle && item.subject === record.subject
          );
          knowledgePointId = kp?.id ?? "";
        }
        if (!knowledgePointId) {
          errors.push(`第 ${i + 1} 行：找不到知识点`);
          continue;
        }
        items.push({
          subject: record.subject,
          grade: record.grade,
          knowledgePointId,
          stem: record.stem,
          options,
          answer: record.answer,
          explanation: record.explanation,
          difficulty: record.difficulty,
          questionType: record.questionType,
          tags,
          abilities
        });
      }

      if (!items.length) {
        setImportErrors(errors.length ? errors : ["没有可导入的题目"]);
        return;
      }

      await runWithStepUp(
        async () => {
          const data = await requestJson<QuestionImportResponse>("/api/admin/questions/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items })
          });
          if (importRequestIdRef.current !== requestId) {
            return;
          }

          const highRiskCount = (data.items ?? []).filter(isHighRiskQuestionResult).length;
          setImportMessage(
            `已导入 ${data.created ?? 0} 题，失败 ${data.failed?.length ?? 0} 条，高风险 ${highRiskCount} 题。`
          );
          setImportErrors(errors);
          await loadQuestions();
        },
        (error) => {
          if (importRequestIdRef.current !== requestId) {
            return;
          }
          if (isAuthError(error)) {
            handleAuthRequired();
            return;
          }
          setImportErrors([getAdminQuestionsErrorMessage(error, "导入失败")]);
        }
      );
    },
    [handleAuthRequired, isHighRiskQuestionResult, knowledgePoints, loadQuestions, runWithStepUp]
  );

  const handleGenerate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const requestId = aiRequestIdRef.current + 1;
      aiRequestIdRef.current = requestId;
      setAiMessage(null);
      setAiErrors([]);
      setPageActionError(null);
      setAiLoading(true);

      const endpoint =
        aiForm.mode === "batch" ? "/api/admin/questions/generate-batch" : "/api/admin/questions/generate";

      const count = aiForm.mode === "batch" ? Math.max(aiForm.count, 10) : aiForm.count;
      const payload =
        aiForm.mode === "batch"
          ? {
              subject: aiForm.subject,
              grade: aiForm.grade,
              count,
              chapter: aiForm.chapter || undefined,
              difficulty: aiForm.difficulty
            }
          : {
              subject: aiForm.subject,
              grade: aiForm.grade,
              knowledgePointId: aiForm.knowledgePointId,
              count,
              difficulty: aiForm.difficulty
            };

      try {
        await runWithStepUp(
          async () => {
            const data = await requestJson<QuestionGenerateResponse>(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            if (aiRequestIdRef.current !== requestId) {
              return;
            }

            const failed: QuestionProcessFailedItem[] = data.failed ?? [];
            if (failed.length) {
              setAiErrors(failed.map((item) => `第 ${item.index + 1} 题：${item.reason}`));
            }
            const highRiskCount = (data.created ?? []).filter(isHighRiskQuestionResult).length;
            setAiMessage(`已生成 ${data.created?.length ?? 0} 题，高风险 ${highRiskCount} 题。`);
            await loadQuestions();
          },
          (error) => {
            if (aiRequestIdRef.current !== requestId) {
              return;
            }
            if (isAuthError(error)) {
              handleAuthRequired();
              return;
            }
            if (isKnowledgePointSelectionError(error)) {
              void loadKnowledgePoints();
            }
            setAiErrors([getAdminQuestionsErrorMessage(error, "生成失败")]);
          }
        );
      } finally {
        if (aiRequestIdRef.current === requestId) {
          setAiLoading(false);
        }
      }
    },
    [aiForm, handleAuthRequired, isHighRiskQuestionResult, loadKnowledgePoints, loadQuestions, runWithStepUp]
  );

  const handleCreate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const requestId = createRequestIdRef.current + 1;
      createRequestIdRef.current = requestId;
      setCreateError(null);
      setPageActionError(null);
      const options = form.options
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
      const tags = parseListText(form.tags);
      const abilities = parseListText(form.abilities);

      await runWithStepUp(
        async () => {
          await requestJson("/api/admin/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subject: form.subject,
              grade: form.grade,
              knowledgePointId: form.knowledgePointId,
              stem: form.stem,
              options,
              answer: form.answer,
              explanation: form.explanation,
              difficulty: form.difficulty,
              questionType: form.questionType,
              tags,
              abilities
            })
          });

          if (createRequestIdRef.current !== requestId) {
            return;
          }

          setForm({
            subject: form.subject,
            grade: form.grade,
            knowledgePointId: form.knowledgePointId,
            stem: "",
            options: "",
            answer: "",
            explanation: "",
            difficulty: form.difficulty,
            questionType: form.questionType,
            tags: "",
            abilities: ""
          });
          await loadQuestions();
        },
        (error) => {
          if (createRequestIdRef.current !== requestId) {
            return;
          }
          if (isAuthError(error)) {
            handleAuthRequired();
            return;
          }
          if (isKnowledgePointSelectionError(error)) {
            void loadKnowledgePoints();
          }
          setCreateError(getAdminQuestionsErrorMessage(error, "保存失败"));
        }
      );
    },
    [form, handleAuthRequired, loadKnowledgePoints, loadQuestions, runWithStepUp]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const requestId = listActionRequestIdRef.current + 1;
      listActionRequestIdRef.current = requestId;
      setPageActionError(null);
      await runWithStepUp(
        async () => {
          await requestJson(`/api/admin/questions/${id}`, { method: "DELETE" });
          if (listActionRequestIdRef.current !== requestId) {
            return;
          }
          await loadQuestions();
        },
        (error) => {
          if (listActionRequestIdRef.current !== requestId) {
            return;
          }
          if (isAuthError(error)) {
            handleAuthRequired();
            return;
          }
          if (isQuestionMissingError(error)) {
            removeQuestionFromCurrentPage(id);
          }
          setPageActionError(
            isQuestionMissingError(error)
              ? "题目不存在，已从当前列表移除。"
              : getAdminQuestionsErrorMessage(error, "删除失败")
          );
        }
      );
    },
    [handleAuthRequired, loadQuestions, removeQuestionFromCurrentPage, runWithStepUp]
  );

  const handleToggleIsolation = useCallback(
    async (id: string, isolated: boolean) => {
      const requestId = listActionRequestIdRef.current + 1;
      listActionRequestIdRef.current = requestId;
      setPageActionError(null);
      await runWithStepUp(
        async () => {
          await requestJson("/api/admin/questions/quality/isolation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questionId: id,
              isolated,
              reason: isolated ? ["管理员手动加入隔离池"] : ["管理员手动移出隔离池"]
            })
          });
          if (listActionRequestIdRef.current !== requestId) {
            return;
          }
          await loadQuestions();
        },
        (error) => {
          if (listActionRequestIdRef.current !== requestId) {
            return;
          }
          if (isAuthError(error)) {
            handleAuthRequired();
            return;
          }
          if (isQuestionMissingError(error)) {
            removeQuestionFromCurrentPage(id);
          }
          setPageActionError(
            isQuestionMissingError(error)
              ? "题目不存在，已从当前列表移除。"
              : getAdminQuestionsErrorMessage(error, isolated ? "加入隔离池失败" : "移出隔离池失败")
          );
        }
      );
    },
    [handleAuthRequired, loadQuestions, removeQuestionFromCurrentPage, runWithStepUp]
  );

  const handleRecheckQuality = useCallback(async () => {
    const requestId = recheckRequestIdRef.current + 1;
    recheckRequestIdRef.current = requestId;
    setRecheckMessage(null);
    setRecheckError(null);
    setPageActionError(null);
    setRecheckLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (query.subject !== "all") payload.subject = query.subject;
      if (query.grade !== "all") payload.grade = query.grade;
      if (query.pool === "active") payload.includeIsolated = false;
      payload.limit = 1000;

      await runWithStepUp(
        async () => {
          const data = await requestJson<QuestionQualityRecheckResponse>(
            "/api/admin/questions/quality/recheck",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            }
          );

          if (recheckRequestIdRef.current !== requestId) {
            return;
          }

          const processedCount = Number(data?.data?.scope?.processedCount ?? 0);
          const updated = Number(data?.data?.summary?.updated ?? 0);
          const newlyTracked = Number(data?.data?.summary?.newlyTracked ?? 0);
          const highRiskCount = Number(data?.data?.summary?.highRiskCount ?? 0);
          const isolatedCount = Number(data?.data?.summary?.isolatedCount ?? 0);
          setRecheckMessage(
            `已重算 ${processedCount} 题（新增质检 ${newlyTracked}，变更 ${updated}，高风险 ${highRiskCount}，隔离池 ${isolatedCount}）。`
          );

          await loadQuestions();
        },
        (error) => {
          if (recheckRequestIdRef.current !== requestId) {
            return;
          }
          if (isAuthError(error)) {
            handleAuthRequired();
            return;
          }
          setRecheckError(getAdminQuestionsErrorMessage(error, "批量重算失败"));
        }
      );
    } finally {
      if (recheckRequestIdRef.current === requestId) {
        setRecheckLoading(false);
      }
    }
  }, [handleAuthRequired, loadQuestions, query.grade, query.pool, query.subject, runWithStepUp]);

  const pageStart = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const pageEnd = meta.total === 0 ? 0 : Math.min(meta.total, meta.page * meta.pageSize);

  return {
    stepUpDialog,
    authRequired,
    list,
    knowledgePoints,
    workspace,
    setWorkspace,
    loading,
    query,
    page,
    setPage,
    pageSize,
    setPageSize,
    meta,
    tree,
    qualitySummary,
    facets,
    importMessage,
    importErrors,
    form,
    setForm,
    aiForm,
    setAiForm,
    aiLoading,
    aiMessage,
    aiErrors,
    recheckLoading,
    recheckMessage,
    recheckError,
    createError,
    pageActionError,
    loadError,
    chapterOptions,
    aiKnowledgePoints,
    formKnowledgePoints,
    patchQuery,
    handleImport,
    handleGenerate,
    handleCreate,
    handleDelete,
    handleToggleIsolation,
    handleRecheckQuality,
    pageStart,
    pageEnd
  };
}
