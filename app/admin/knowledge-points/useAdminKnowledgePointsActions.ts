"use client";

import { useCallback, type Dispatch, type FormEvent, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  AiKnowledgePointForm,
  BatchForm,
  KnowledgePointBatchPreviewFailedItem,
  KnowledgePointBatchPreviewItem,
  KnowledgePointBatchPreviewResponse,
  KnowledgePointForm,
  KnowledgePointMutationResponse,
  KnowledgePointProcessFailedItem,
  TreeForm
} from "./types";
import {
  IMPORT_ITEMS_CHUNK_SIZE,
  PREVIEW_COMBO_CHUNK_SIZE,
  buildBatchCombos,
  chunkArray,
  formatKnowledgePointBatchPreviewError,
  getAdminKnowledgePointsErrorMessage,
  isKnowledgePointMissingError,
  mergeKnowledgePointBatchPreviewItems
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;
type RequestRef = MutableRefObject<number>;

type RunWithStepUp = (
  action: () => Promise<void>,
  onError?: (error: unknown) => void
) => Promise<void>;

type AdminKnowledgePointsActionsOptions = {
  form: KnowledgePointForm;
  aiForm: AiKnowledgePointForm;
  treeForm: TreeForm;
  batchForm: BatchForm;
  batchPreview: KnowledgePointBatchPreviewItem[];
  runWithStepUp: RunWithStepUp;
  handleAuthRequired: () => void;
  loadAllKnowledgePoints: () => Promise<void>;
  loadKnowledgePointList: () => Promise<void>;
  removeKnowledgePointFromState: (knowledgePointId: string) => void;
  createRequestIdRef: RequestRef;
  aiRequestIdRef: RequestRef;
  treeRequestIdRef: RequestRef;
  batchPreviewRequestIdRef: RequestRef;
  batchConfirmRequestIdRef: RequestRef;
  deleteRequestIdRef: RequestRef;
  setForm: Setter<KnowledgePointForm>;
  setFormError: Setter<string | null>;
  setPageActionError: Setter<string | null>;
  setAiLoading: Setter<boolean>;
  setAiMessage: Setter<string | null>;
  setAiErrors: Setter<string[]>;
  setTreeLoading: Setter<boolean>;
  setTreeMessage: Setter<string | null>;
  setTreeErrors: Setter<string[]>;
  setBatchLoading: Setter<boolean>;
  setBatchError: Setter<string | null>;
  setBatchMessage: Setter<string | null>;
  setBatchProgress: Setter<string | null>;
  setBatchPreview: Setter<KnowledgePointBatchPreviewItem[]>;
  setBatchConfirming: Setter<boolean>;
};

export function useAdminKnowledgePointsActions({
  form,
  aiForm,
  treeForm,
  batchForm,
  batchPreview,
  runWithStepUp,
  handleAuthRequired,
  loadAllKnowledgePoints,
  loadKnowledgePointList,
  removeKnowledgePointFromState,
  createRequestIdRef,
  aiRequestIdRef,
  treeRequestIdRef,
  batchPreviewRequestIdRef,
  batchConfirmRequestIdRef,
  deleteRequestIdRef,
  setForm,
  setFormError,
  setPageActionError,
  setAiLoading,
  setAiMessage,
  setAiErrors,
  setTreeLoading,
  setTreeMessage,
  setTreeErrors,
  setBatchLoading,
  setBatchError,
  setBatchMessage,
  setBatchProgress,
  setBatchPreview,
  setBatchConfirming
}: AdminKnowledgePointsActionsOptions) {
  const reloadKnowledgePoints = useCallback(async () => {
    await Promise.all([loadAllKnowledgePoints(), loadKnowledgePointList()]);
  }, [loadAllKnowledgePoints, loadKnowledgePointList]);

  const handleCreate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const requestId = createRequestIdRef.current + 1;
      createRequestIdRef.current = requestId;
      setFormError(null);
      setPageActionError(null);

      await runWithStepUp(
        async () => {
          await requestJson("/api/admin/knowledge-points", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form)
          });
          if (createRequestIdRef.current !== requestId) {
            return;
          }

          setForm((current) => ({ ...current, title: "", chapter: "" }));
          await reloadKnowledgePoints();
        },
        (error) => {
          if (createRequestIdRef.current !== requestId) {
            return;
          }
          if (isAuthError(error)) {
            handleAuthRequired();
            return;
          }
          setFormError(getAdminKnowledgePointsErrorMessage(error, "保存失败"));
        }
      );
    },
    [
      createRequestIdRef,
      form,
      handleAuthRequired,
      reloadKnowledgePoints,
      runWithStepUp,
      setForm,
      setFormError,
      setPageActionError
    ]
  );

  const handleAiGenerate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const requestId = aiRequestIdRef.current + 1;
      aiRequestIdRef.current = requestId;
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
            if (aiRequestIdRef.current !== requestId) {
              return;
            }

            const skipped = payload.skipped ?? [];
            if (skipped.length) {
              setAiErrors(skipped.map((item) => `第 ${item.index + 1} 条：${item.reason}`));
            }
            setAiMessage(`已生成 ${payload.created?.length ?? 0} 条知识点。`);
            await reloadKnowledgePoints();
          },
          (error) => {
            if (aiRequestIdRef.current !== requestId) {
              return;
            }
            if (isAuthError(error)) {
              handleAuthRequired();
              return;
            }
            setAiErrors([getAdminKnowledgePointsErrorMessage(error, "生成失败")]);
          }
        );
      } finally {
        if (aiRequestIdRef.current === requestId) {
          setAiLoading(false);
        }
      }
    },
    [
      aiForm,
      aiRequestIdRef,
      handleAuthRequired,
      reloadKnowledgePoints,
      runWithStepUp,
      setAiErrors,
      setAiLoading,
      setAiMessage,
      setPageActionError
    ]
  );

  const handleTreeGenerate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const requestId = treeRequestIdRef.current + 1;
      treeRequestIdRef.current = requestId;
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
            if (treeRequestIdRef.current !== requestId) {
              return;
            }

            const skipped: KnowledgePointProcessFailedItem[] = payload.skipped ?? [];
            if (skipped.length) {
              setTreeErrors(skipped.slice(0, 5).map((item) => `第 ${item.index + 1} 条：${item.reason}`));
            }
            setTreeMessage(`已生成 ${payload.created?.length ?? 0} 条知识点。`);
            await reloadKnowledgePoints();
          },
          (error) => {
            if (treeRequestIdRef.current !== requestId) {
              return;
            }
            if (isAuthError(error)) {
              handleAuthRequired();
              return;
            }
            setTreeErrors([getAdminKnowledgePointsErrorMessage(error, "生成失败")]);
          }
        );
      } finally {
        if (treeRequestIdRef.current === requestId) {
          setTreeLoading(false);
        }
      }
    },
    [
      handleAuthRequired,
      reloadKnowledgePoints,
      runWithStepUp,
      setPageActionError,
      setTreeErrors,
      setTreeLoading,
      setTreeMessage,
      treeForm,
      treeRequestIdRef
    ]
  );

  const handleBatchPreview = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const requestId = batchPreviewRequestIdRef.current + 1;
      batchPreviewRequestIdRef.current = requestId;

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
          if (batchPreviewRequestIdRef.current !== requestId) {
            return;
          }

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

          if (batchPreviewRequestIdRef.current !== requestId) {
            return;
          }

          allItems.push(...(payload.items ?? []));
          allFailed.push(...(payload.failed ?? []));
        }

        const mergedItems = mergeKnowledgePointBatchPreviewItems(allItems);
        setBatchError(formatKnowledgePointBatchPreviewError(allFailed ?? []) ?? null);
        setBatchMessage(`预览完成：成功 ${mergedItems.length}/${combos.length} 个组合，失败 ${allFailed.length} 个组合。`);
        setBatchPreview(mergedItems);
      } catch (error) {
        if (batchPreviewRequestIdRef.current !== requestId) {
          return;
        }
        if (isAuthError(error)) {
          handleAuthRequired();
          return;
        }
        setBatchError(getAdminKnowledgePointsErrorMessage(error, "生成预览失败"));
      } finally {
        if (batchPreviewRequestIdRef.current === requestId) {
          setBatchLoading(false);
          setBatchProgress(null);
        }
      }
    },
    [
      batchForm,
      batchPreviewRequestIdRef,
      handleAuthRequired,
      setBatchError,
      setBatchLoading,
      setBatchMessage,
      setBatchPreview,
      setBatchProgress
    ]
  );

  const handleBatchConfirm = useCallback(async () => {
    const requestId = batchConfirmRequestIdRef.current + 1;
    batchConfirmRequestIdRef.current = requestId;

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
            if (batchConfirmRequestIdRef.current !== requestId) {
              return;
            }

            setBatchProgress(`正在入库：第 ${index + 1}/${previewChunks.length} 批（${previewChunk.length} 个组合）`);
            const payload = await requestJson<KnowledgePointMutationResponse>("/api/admin/knowledge-points/import-tree", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: previewChunk })
            });

            if (batchConfirmRequestIdRef.current !== requestId) {
              return;
            }

            createdTotal += payload.created?.length ?? 0;
            skippedTotal += payload.skipped?.length ?? 0;
          }

          if (batchConfirmRequestIdRef.current !== requestId) {
            return;
          }

          setBatchError(null);
          setBatchMessage(`已入库 ${createdTotal} 条，跳过 ${skippedTotal} 条。`);
          await reloadKnowledgePoints();
        },
        (error) => {
          if (batchConfirmRequestIdRef.current !== requestId) {
            return;
          }
          if (isAuthError(error)) {
            handleAuthRequired();
            return;
          }
          setBatchError(getAdminKnowledgePointsErrorMessage(error, "入库失败"));
        }
      );
    } finally {
      if (batchConfirmRequestIdRef.current === requestId) {
        setBatchConfirming(false);
        setBatchProgress(null);
      }
    }
  }, [
    batchConfirmRequestIdRef,
    batchPreview,
    handleAuthRequired,
    reloadKnowledgePoints,
    runWithStepUp,
    setBatchConfirming,
    setBatchError,
    setBatchMessage,
    setBatchProgress
  ]);

  const handleDelete = useCallback(
    async (id: string) => {
      const requestId = deleteRequestIdRef.current + 1;
      deleteRequestIdRef.current = requestId;
      setPageActionError(null);

      await runWithStepUp(
        async () => {
          await requestJson(`/api/admin/knowledge-points/${id}`, { method: "DELETE" });
          if (deleteRequestIdRef.current !== requestId) {
            return;
          }
          await reloadKnowledgePoints();
        },
        (error) => {
          if (deleteRequestIdRef.current !== requestId) {
            return;
          }
          if (isAuthError(error)) {
            handleAuthRequired();
            return;
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
    [
      deleteRequestIdRef,
      handleAuthRequired,
      reloadKnowledgePoints,
      removeKnowledgePointFromState,
      runWithStepUp,
      setPageActionError
    ]
  );

  return {
    handleCreate,
    handleAiGenerate,
    handleTreeGenerate,
    handleBatchPreview,
    handleBatchConfirm,
    handleDelete
  };
}
