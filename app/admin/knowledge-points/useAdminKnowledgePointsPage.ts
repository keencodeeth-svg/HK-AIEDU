"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import {
  getRequestErrorMessage,
  getRequestStatus,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";
import type {
  AiKnowledgePointForm,
  BatchForm,
  KnowledgePoint,
  KnowledgePointBatchPreviewFailedItem,
  KnowledgePointBatchPreviewItem,
  KnowledgePointBatchPreviewResponse,
  KnowledgePointFacets,
  KnowledgePointForm,
  KnowledgePointListMeta,
  KnowledgePointListPayload,
  KnowledgePointMutationResponse,
  KnowledgePointProcessFailedItem,
  KnowledgePointQuery,
  KnowledgePointTreeNode,
  TreeForm
} from "./types";
import {
  buildBatchCombos,
  chunkArray,
  createInitialAiKnowledgePointForm,
  createInitialBatchForm,
  createInitialKnowledgePointFacets,
  createInitialKnowledgePointForm,
  createInitialKnowledgePointMeta,
  createInitialKnowledgePointQuery,
  createInitialTreeForm,
  IMPORT_ITEMS_CHUNK_SIZE,
  PREVIEW_COMBO_CHUNK_SIZE
} from "./utils";

function getNormalizedKnowledgePointsMessage(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase();
}

function isKnowledgePointMissingError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getNormalizedKnowledgePointsMessage(error);
  return status === 404 && requestMessage === "not found";
}

function getAdminKnowledgePointsErrorMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getNormalizedKnowledgePointsMessage(error);

  if (status === 401 || status === 403) {
    return "管理员会话已失效，请重新登录后继续操作。";
  }
  if (requestMessage === "missing fields") {
    return "请填写完整的知识点信息后再提交。";
  }
  if (requestMessage === "invalid subject") {
    return "学科参数无效，请刷新页面后重试。";
  }
  if (requestMessage === "subjects and grades required") {
    return "请至少选择 1 个学科和 1 个年级。";
  }
  if (requestMessage === "invalid subjects") {
    return "所选学科无效，请调整批量组合后重试。";
  }
  if (requestMessage === "items required") {
    return "没有可导入的知识树内容，请先生成预览后再入库。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "知识点不存在，可能已被其他管理员删除。";
  }
  return getRequestErrorMessage(error, fallback);
}

export function useAdminKnowledgePointsPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const [list, setList] = useState<KnowledgePoint[]>([]);
  const [allKnowledgePoints, setAllKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [workspace, setWorkspace] = useState<"list" | "tools">("list");
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<KnowledgePointQuery>(createInitialKnowledgePointQuery);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [meta, setMeta] = useState<KnowledgePointListMeta>(createInitialKnowledgePointMeta);
  const [tree, setTree] = useState<KnowledgePointTreeNode[]>([]);
  const [facets, setFacets] = useState<KnowledgePointFacets>(createInitialKnowledgePointFacets);
  const [form, setForm] = useState<KnowledgePointForm>(createInitialKnowledgePointForm);
  const [aiForm, setAiForm] = useState<AiKnowledgePointForm>(createInitialAiKnowledgePointForm);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<string[]>([]);
  const [treeForm, setTreeForm] = useState<TreeForm>(createInitialTreeForm);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeMessage, setTreeMessage] = useState<string | null>(null);
  const [treeErrors, setTreeErrors] = useState<string[]>([]);
  const [batchForm, setBatchForm] = useState<BatchForm>(createInitialBatchForm);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [batchPreview, setBatchPreview] = useState<KnowledgePointBatchPreviewItem[]>([]);
  const [batchConfirming, setBatchConfirming] = useState(false);
  const [batchShowDetail, setBatchShowDetail] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageActionError, setPageActionError] = useState<string | null>(null);
  const [allKnowledgePointsLoadError, setAllKnowledgePointsLoadError] = useState<string | null>(null);
  const [knowledgePointListLoadError, setKnowledgePointListLoadError] = useState<string | null>(null);

  const chapterOptions = useMemo(() => {
    const filtered = allKnowledgePoints.filter(
      (knowledgePoint) => knowledgePoint.subject === aiForm.subject && knowledgePoint.grade === aiForm.grade
    );
    const chapters = filtered.map((knowledgePoint) => knowledgePoint.chapter).filter(Boolean);
    return Array.from(new Set(chapters));
  }, [allKnowledgePoints, aiForm.grade, aiForm.subject]);
  const loadError = knowledgePointListLoadError ?? allKnowledgePointsLoadError;

  const removeKnowledgePointFromState = useCallback((knowledgePointId: string) => {
    setList((current) => current.filter((item) => item.id !== knowledgePointId));
    setAllKnowledgePoints((current) => current.filter((item) => item.id !== knowledgePointId));
    setMeta((current) => {
      const total = Math.max(0, current.total - 1);
      const totalPages = Math.max(1, Math.ceil(total / Math.max(current.pageSize, 1)));
      const page = Math.min(current.page, totalPages);
      return { ...current, total, totalPages, page };
    });
  }, []);

  const loadAllKnowledgePoints = useCallback(async () => {
    try {
      const payload = await requestJson<KnowledgePointListPayload>("/api/admin/knowledge-points");
      setAllKnowledgePoints(payload.data ?? []);
      setAuthRequired(false);
      setAllKnowledgePointsLoadError(null);
    } catch (error) {
      setAllKnowledgePoints([]);
      if (isAuthError(error)) {
        setAuthRequired(true);
      }
      setAllKnowledgePointsLoadError(getAdminKnowledgePointsErrorMessage(error, "知识点全集加载失败"));
    }
  }, []);

  const loadKnowledgePointList = useCallback(async () => {
    setLoading(true);
    const searchParams = new URLSearchParams();
    if (query.subject !== "all") searchParams.set("subject", query.subject);
    if (query.grade !== "all") searchParams.set("grade", query.grade);
    if (query.unit !== "all") searchParams.set("unit", query.unit);
    if (query.chapter !== "all") searchParams.set("chapter", query.chapter);
    if (query.search.trim()) searchParams.set("search", query.search.trim());
    searchParams.set("page", String(page));
    searchParams.set("pageSize", String(pageSize));

    try {
      const payload = await requestJson<KnowledgePointListPayload>(`/api/admin/knowledge-points?${searchParams.toString()}`);
      setList(payload.data ?? []);
      setAuthRequired(false);
      setMeta(
        payload.meta ?? {
          total: payload.data?.length ?? 0,
          page,
          pageSize,
          totalPages: 1
        }
      );
      setTree(payload.tree ?? []);
      setFacets({
        subjects: payload.facets?.subjects ?? [],
        grades: payload.facets?.grades ?? [],
        units: payload.facets?.units ?? [],
        chapters: payload.facets?.chapters ?? []
      });
      setKnowledgePointListLoadError(null);
    } catch (error) {
      if (isAuthError(error)) {
        setAuthRequired(true);
      }
      setKnowledgePointListLoadError(getAdminKnowledgePointsErrorMessage(error, "知识点列表加载失败"));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query]);

  useEffect(() => {
    void loadAllKnowledgePoints();
  }, [loadAllKnowledgePoints]);

  useEffect(() => {
    void loadKnowledgePointList();
  }, [loadKnowledgePointList]);

  useEffect(() => {
    if (!aiForm.chapter && chapterOptions.length) {
      setAiForm((current) => ({ ...current, chapter: chapterOptions[0] }));
    }
  }, [aiForm.chapter, chapterOptions]);

  const patchQuery = useCallback((next: Partial<KnowledgePointQuery>) => {
    setQuery((current) => ({ ...current, ...next }));
    setPage(1);
  }, []);

  const clearBatchPreview = useCallback(() => {
    setBatchPreview([]);
    setBatchProgress(null);
    setBatchError(null);
    setBatchMessage(null);
  }, []);

  const handleCreate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);
      setPageActionError(null);
      await runWithStepUp(
        async () => {
          await requestJson("/api/admin/knowledge-points", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form)
          });
          setForm((current) => ({ ...current, title: "", chapter: "" }));
          await Promise.all([loadAllKnowledgePoints(), loadKnowledgePointList()]);
        },
        (error) => {
          if (isAuthError(error)) {
            setAuthRequired(true);
          }
          setFormError(getAdminKnowledgePointsErrorMessage(error, "保存失败"));
        }
      );
    },
    [form, loadAllKnowledgePoints, loadKnowledgePointList, runWithStepUp]
  );

  const handleAiGenerate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setAiLoading(true);
      setAiMessage(null);
      setAiErrors([]);
      setPageActionError(null);

      try {
        await runWithStepUp(
          async () => {
            const payload = await requestJson<KnowledgePointMutationResponse>("/api/admin/knowledge-points/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subject: aiForm.subject,
                grade: aiForm.grade,
                chapter: aiForm.chapter || undefined,
                count: aiForm.count
              })
            });

            const skipped = payload.skipped ?? [];
            if (skipped.length) {
              setAiErrors(skipped.map((item) => `第 ${item.index + 1} 条：${item.reason}`));
            }
            setAiMessage(`已生成 ${payload.created?.length ?? 0} 条知识点。`);
            await Promise.all([loadAllKnowledgePoints(), loadKnowledgePointList()]);
          },
          (error) => {
            if (isAuthError(error)) {
              setAuthRequired(true);
            }
            setAiErrors([getAdminKnowledgePointsErrorMessage(error, "生成失败")]);
          }
        );
      } finally {
        setAiLoading(false);
      }
    },
    [aiForm, loadAllKnowledgePoints, loadKnowledgePointList, runWithStepUp]
  );

  const handleTreeGenerate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setTreeLoading(true);
      setTreeMessage(null);
      setTreeErrors([]);
      setPageActionError(null);

      try {
        await runWithStepUp(
          async () => {
            const payload = await requestJson<KnowledgePointMutationResponse>("/api/admin/knowledge-points/generate-tree", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subject: treeForm.subject,
                grade: treeForm.grade,
                edition: treeForm.edition,
                volume: treeForm.volume,
                unitCount: treeForm.unitCount
              })
            });

            const skipped: KnowledgePointProcessFailedItem[] = payload.skipped ?? [];
            if (skipped.length) {
              setTreeErrors(skipped.slice(0, 5).map((item) => `第 ${item.index + 1} 条：${item.reason}`));
            }
            setTreeMessage(`已生成 ${payload.created?.length ?? 0} 条知识点。`);
            await Promise.all([loadAllKnowledgePoints(), loadKnowledgePointList()]);
          },
          (error) => {
            if (isAuthError(error)) {
              setAuthRequired(true);
            }
            setTreeErrors([getAdminKnowledgePointsErrorMessage(error, "生成失败")]);
          }
        );
      } finally {
        setTreeLoading(false);
      }
    },
    [loadAllKnowledgePoints, loadKnowledgePointList, runWithStepUp, treeForm]
  );

  const handleBatchPreview = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const combos = buildBatchCombos(batchForm.subjects, batchForm.grades);
      if (!combos.length) {
        setBatchError("请至少选择 1 个学科和 1 个年级");
        setBatchMessage(null);
        return;
      }

      setBatchLoading(true);
      setBatchError(null);
      setBatchMessage(null);
      setBatchProgress(null);
      setBatchPreview([]);

      try {
        const comboChunks = chunkArray(combos, PREVIEW_COMBO_CHUNK_SIZE);
        const allItems: KnowledgePointBatchPreviewItem[] = [];
        const allFailed: KnowledgePointBatchPreviewFailedItem[] = [];

        for (const [index, comboChunk] of comboChunks.entries()) {
          setBatchProgress(`正在生成预览：第 ${index + 1}/${comboChunks.length} 批（${comboChunk.length} 个组合）`);
          const payload = await requestJson<KnowledgePointBatchPreviewResponse>("/api/admin/knowledge-points/preview-tree-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              combos: comboChunk,
              edition: batchForm.edition,
              volume: batchForm.volume,
              unitCount: batchForm.unitCount,
              chaptersPerUnit: batchForm.chaptersPerUnit,
              pointsPerChapter: batchForm.pointsPerChapter
            })
          });
          allItems.push(...(payload.items ?? []));
          allFailed.push(...(payload.failed ?? []));
        }

        const itemMap = new Map<string, KnowledgePointBatchPreviewItem>();
        allItems.forEach((item) => {
          itemMap.set(`${item.subject}|${item.grade}`, item);
        });

        if (allFailed.length) {
          setBatchError(
            allFailed
              .slice(0, 16)
              .map((item) => `${SUBJECT_LABELS[item.subject] ?? item.subject}${item.grade}年级：${item.reason}`)
              .join("；")
          );
        }
        setBatchMessage(`预览完成：成功 ${itemMap.size}/${combos.length} 个组合，失败 ${allFailed.length} 个组合。`);
        setBatchPreview(Array.from(itemMap.values()));
      } catch (error) {
        if (isAuthError(error)) {
          setAuthRequired(true);
        }
        setBatchError(getAdminKnowledgePointsErrorMessage(error, "生成预览失败"));
      } finally {
        setBatchLoading(false);
        setBatchProgress(null);
      }
    },
    [batchForm]
  );

  const handleBatchConfirm = useCallback(async () => {
    if (!batchPreview.length) {
      setBatchError("请先生成预览");
      setBatchMessage(null);
      return;
    }
    setBatchConfirming(true);
    setBatchError(null);
    setBatchMessage(null);

    const previewChunks = chunkArray(batchPreview, IMPORT_ITEMS_CHUNK_SIZE);
    let createdTotal = 0;
    let skippedTotal = 0;

    try {
      await runWithStepUp(
        async () => {
          for (const [index, previewChunk] of previewChunks.entries()) {
            setBatchProgress(`正在入库：第 ${index + 1}/${previewChunks.length} 批（${previewChunk.length} 个组合）`);
            const payload = await requestJson<KnowledgePointMutationResponse>("/api/admin/knowledge-points/import-tree", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: previewChunk })
            });
            createdTotal += payload.created?.length ?? 0;
            skippedTotal += payload.skipped?.length ?? 0;
          }

          setBatchError(null);
          setBatchMessage(`已入库 ${createdTotal} 条，跳过 ${skippedTotal} 条。`);
          await Promise.all([loadAllKnowledgePoints(), loadKnowledgePointList()]);
        },
        (error) => {
          if (isAuthError(error)) {
            setAuthRequired(true);
          }
          setBatchError(getAdminKnowledgePointsErrorMessage(error, "入库失败"));
        }
      );
    } finally {
      setBatchConfirming(false);
      setBatchProgress(null);
    }
  }, [batchPreview, loadAllKnowledgePoints, loadKnowledgePointList, runWithStepUp]);

  const handleDelete = useCallback(
    async (id: string) => {
      setPageActionError(null);
      await runWithStepUp(
        async () => {
          await requestJson(`/api/admin/knowledge-points/${id}`, { method: "DELETE" });
          await Promise.all([loadAllKnowledgePoints(), loadKnowledgePointList()]);
        },
        (error) => {
          if (isAuthError(error)) {
            setAuthRequired(true);
          }
          if (isKnowledgePointMissingError(error)) {
            removeKnowledgePointFromState(id);
          }
          setPageActionError(
            isKnowledgePointMissingError(error)
              ? "知识点不存在，已从当前列表移除。"
              : getAdminKnowledgePointsErrorMessage(error, "删除失败")
          );
        }
      );
    },
    [loadAllKnowledgePoints, loadKnowledgePointList, removeKnowledgePointFromState, runWithStepUp]
  );

  const pageStart = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const pageEnd = meta.total === 0 ? 0 : Math.min(meta.total, meta.page * meta.pageSize);

  return {
    authRequired,
    workspace,
    setWorkspace,
    list,
    loading,
    query,
    page,
    setPage,
    pageSize,
    setPageSize,
    meta,
    tree,
    facets,
    form,
    setForm,
    formError,
    aiForm,
    setAiForm,
    chapterOptions,
    aiLoading,
    aiMessage,
    aiErrors,
    treeForm,
    setTreeForm,
    treeLoading,
    treeMessage,
    treeErrors,
    batchForm,
    setBatchForm,
    batchLoading,
    batchError,
    batchMessage,
    batchProgress,
    batchPreview,
    batchShowDetail,
    setBatchShowDetail,
    batchConfirming,
    loadError,
    pageActionError,
    pageStart,
    pageEnd,
    patchQuery,
    clearBatchPreview,
    handleCreate,
    handleAiGenerate,
    handleTreeGenerate,
    handleBatchPreview,
    handleBatchConfirm,
    handleDelete,
    stepUpDialog
  };
}
