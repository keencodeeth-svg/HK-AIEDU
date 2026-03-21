"use client";

import { type Dispatch, type FormEvent, type SetStateAction, useCallback } from "react";
import { getRequestStatus, isAuthError, requestJson } from "@/lib/client-request";
import type {
  BatchImportSummary,
  LibraryAiFormState,
  LibraryAiGenerateResponse,
  LibraryBatchImportFailedItem,
  LibraryBatchImportResponse,
  LibraryBatchPreview,
  LibraryDeleteResponse,
  LibraryDetailResponse,
  LibraryImportFormState,
  LibraryItem,
  LibraryListResponse,
  LibraryUser
} from "./types";
import {
  getLibraryAiGenerateRequestMessage,
  getLibraryBatchImportRequestMessage,
  getLibraryImportRequestMessage,
  getLibraryPageBaseRequestMessage,
  isMissingLibraryItemError,
  normalizeLibraryBatchFailedReason
} from "./request-helpers";
import { buildBatchImportTemplate, toBase64 } from "./utils";

type RunWithStepUp = (
  action: () => Promise<void>,
  onError?: (error: unknown) => void
) => Promise<void>;

type LibraryPageActionsOptions = {
  user: LibraryUser;
  importForm: LibraryImportFormState;
  importFile: File | null;
  batchFile: File | null;
  aiForm: LibraryAiFormState;
  runWithStepUp: RunWithStepUp;
  loadItems: (options?: { noticePrefix?: string }) => Promise<boolean>;
  removeItemFromSnapshot: (item: LibraryItem) => void;
  setAuthRequired: Dispatch<SetStateAction<boolean>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setImportForm: Dispatch<SetStateAction<LibraryImportFormState>>;
  setImportFile: Dispatch<SetStateAction<File | null>>;
  setBatchPreview: Dispatch<SetStateAction<LibraryBatchPreview | null>>;
  setBatchSummary: Dispatch<SetStateAction<BatchImportSummary | null>>;
  setBatchFailedPreview: Dispatch<SetStateAction<string[]>>;
  setAiForm: Dispatch<SetStateAction<LibraryAiFormState>>;
  setDeletingId: Dispatch<SetStateAction<string | null>>;
  setBatchFile: Dispatch<SetStateAction<File | null>>;
};

export function useLibraryPageActions({
  user,
  importForm,
  importFile,
  batchFile,
  aiForm,
  runWithStepUp,
  loadItems,
  removeItemFromSnapshot,
  setAuthRequired,
  setMessage,
  setError,
  setImportForm,
  setImportFile,
  setBatchPreview,
  setBatchSummary,
  setBatchFailedPreview,
  setAiForm,
  setDeletingId,
  setBatchFile
}: LibraryPageActionsOptions) {
  const submitImport = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setMessage(null);
      setError(null);
      if (user?.role !== "admin") {
        return;
      }

      if (importForm.contentType === "textbook" && importForm.sourceType !== "file") {
        setError("教材资源仅支持文件导入");
        return;
      }

      const payload: Record<string, unknown> = { ...importForm };

      if (importForm.sourceType === "file") {
        if (!importFile) {
          setError("请先选择文件");
          return;
        }
        const file = await toBase64(importFile);
        payload.fileName = file.fileName;
        payload.mimeType = file.mimeType;
        payload.size = file.size;
        payload.contentBase64 = file.base64;
        payload.textContent = "";
        payload.linkUrl = "";
      } else if (importForm.sourceType === "link") {
        if (!importForm.linkUrl.trim()) {
          setError("请填写链接");
          return;
        }
        payload.textContent = "";
      } else {
        if (!importForm.textContent.trim()) {
          setError("请填写教材内容");
          return;
        }
        payload.linkUrl = "";
      }

      await runWithStepUp(
        async () => {
          await requestJson("/api/admin/library", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          setMessage("教材导入成功");
          setImportForm((prev) => ({
            ...prev,
            title: "",
            description: "",
            textContent: "",
            linkUrl: ""
          }));
          setImportFile(null);
          await loadItems({ noticePrefix: "教材已导入，但资料列表刷新失败" });
        },
        (nextError) => {
          if (isAuthError(nextError)) {
            setAuthRequired(true);
            return;
          }
          setError(getLibraryImportRequestMessage(nextError, "导入失败"));
        }
      );
    },
    [
      importFile,
      importForm,
      loadItems,
      runWithStepUp,
      setAuthRequired,
      setError,
      setImportFile,
      setImportForm,
      setMessage,
      user?.role
    ]
  );

  const downloadBatchTemplate = useCallback(() => {
    const blob = new Blob([JSON.stringify(buildBatchImportTemplate(), null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "full-curriculum-batch-template.json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  const handleBatchFileChange = useCallback(
    async (file?: File | null) => {
      setBatchFile(file ?? null);
      setBatchSummary(null);
      setBatchFailedPreview([]);
      if (!file) {
        setBatchPreview(null);
        return;
      }
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        setBatchPreview({
          textbooks: Array.isArray(json?.textbooks) ? json.textbooks.length : 0,
          questions: Array.isArray(json?.questions) ? json.questions.length : 0
        });
      } catch {
        setBatchPreview(null);
        setError("批量文件不是合法 JSON");
      }
    },
    [setBatchFailedPreview, setBatchFile, setBatchPreview, setBatchSummary, setError]
  );

  const submitBatchImport = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setMessage(null);
      setError(null);
      setBatchSummary(null);
      setBatchFailedPreview([]);
      if (user?.role !== "admin") {
        return;
      }
      if (!batchFile) {
        setError("请先上传批量 JSON 文件");
        return;
      }

      let payload: unknown = null;
      try {
        payload = JSON.parse(await batchFile.text());
      } catch {
        setError("批量文件解析失败，请检查 JSON 格式");
        return;
      }

      await runWithStepUp(
        async () => {
          const data = await requestJson<LibraryBatchImportResponse>(
            "/api/admin/library/batch-import",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            }
          );

          const toFailedPreview = (
            items: LibraryBatchImportFailedItem[],
            label: string
          ) =>
            items.map(
              (item) => `${label}#${Number(item.index) + 1}: ${normalizeLibraryBatchFailedReason(item.reason)}`
            );

          const nextSummary = data.data?.summary ?? null;
          const textbookFailed = toFailedPreview(
            data.data?.textbooks?.failed ?? [],
            "教材"
          );
          const questionFailed = toFailedPreview(
            data.data?.questions?.failed ?? [],
            "习题"
          );
          setBatchSummary(nextSummary);
          setBatchFailedPreview(
            [...textbookFailed, ...questionFailed].slice(0, 20)
          );
          setMessage("批量导入完成");
          await loadItems({ noticePrefix: "批量导入已完成，但资料列表刷新失败" });
        },
        (nextError) => {
          if (isAuthError(nextError)) {
            setAuthRequired(true);
            return;
          }
          setError(getLibraryBatchImportRequestMessage(nextError, "批量导入失败"));
        }
      );
    },
    [
      batchFile,
      loadItems,
      runWithStepUp,
      setAuthRequired,
      setBatchFailedPreview,
      setBatchSummary,
      setError,
      setMessage,
      user?.role
    ]
  );

  const submitAiGenerate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setMessage(null);
      setError(null);
      if (user?.role !== "teacher") {
        return;
      }
      if (!aiForm.classId || !aiForm.topic.trim()) {
        setError("请先选择班级并填写主题");
        return;
      }

      try {
        const data = await requestJson<LibraryAiGenerateResponse>(
          "/api/teacher/library/ai-generate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(aiForm)
          }
        );
        const citationCount = Array.isArray(data.data?.citations)
          ? data.data.citations.length
          : 0;
        const governance = data.data?.citationGovernance;
        const needsManualReview = Boolean(governance?.needsManualReview);
        const reviewHint = needsManualReview
          ? `，建议复核（${String(
              governance?.manualReviewReason ?? "引用可信度风险"
            )}）`
          : "";
        setMessage(
          citationCount
            ? `AI 资料已生成并发布（引用教材片段 ${citationCount} 条${reviewHint}）`
            : `AI 资料已生成并发布${reviewHint}`
        );
        setAiForm((prev) => ({ ...prev, topic: "" }));
        await loadItems({ noticePrefix: "AI 资料已生成，但资料列表刷新失败" });
      } catch (nextError) {
        if (isAuthError(nextError)) {
          setAuthRequired(true);
          return;
        }
        setError(getLibraryAiGenerateRequestMessage(nextError, "生成失败"));
      }
    },
    [aiForm, loadItems, setAiForm, setAuthRequired, setError, setMessage, user?.role]
  );

  const fetchLibraryItemDetail = useCallback(
    async (item: LibraryItem) => {
      try {
        const payload = await requestJson<LibraryDetailResponse>(
          `/api/library/${item.id}`,
          { cache: "no-store" }
        );
        return payload.data ?? null;
      } catch (nextError) {
        if (isAuthError(nextError)) {
          setAuthRequired(true);
        } else if (isMissingLibraryItemError(nextError)) {
          removeItemFromSnapshot(item);
          setMessage("资料不存在或已删除");
          await loadItems({ noticePrefix: "资料已从列表移除，但资料列表刷新失败" });
        } else {
          setError(getLibraryPageBaseRequestMessage(nextError, "获取资料详情失败"));
        }
        return null;
      }
    },
    [loadItems, removeItemFromSnapshot, setAuthRequired, setError, setMessage]
  );

  const downloadText = useCallback((item: LibraryItem) => {
    const text = item.textContent ?? "";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${item.title || "资料"}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  const downloadItem = useCallback(
    async (item: LibraryItem) => {
      if (item.contentType === "textbook" && item.sourceType === "link") {
        setError("教材资源只支持文件，当前外链已禁用");
        return;
      }
      setError(null);
      let detail = item;

      if (item.sourceType === "text" || item.sourceType === "file") {
        const loaded = await fetchLibraryItemDetail(item);
        if (!loaded) {
          return;
        }
        detail = loaded;
      }

      if (detail.sourceType === "text") {
        if (!detail.textContent) {
          setError("文本内容为空或不可用");
          return;
        }
        downloadText(detail);
        return;
      }

      if (detail.sourceType === "file") {
        if (!detail.contentBase64) {
          setError("文件内容不可用，请稍后重试");
          return;
        }
        const href = `data:${detail.mimeType || "application/octet-stream"};base64,${detail.contentBase64}`;
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = detail.fileName || detail.title || "资料";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        return;
      }

      if (detail.linkUrl) {
        window.open(detail.linkUrl, "_blank", "noopener,noreferrer");
        return;
      }

      setError("资料缺少可下载内容");
    },
    [downloadText, fetchLibraryItemDetail, setError]
  );

  const removeItem = useCallback(
    async (item: LibraryItem) => {
      if (user?.role !== "admin") {
        return;
      }
      const confirmed = window.confirm(
        `确认删除「${item.title}」吗？删除后不可恢复。`
      );
      if (!confirmed) {
        return;
      }

      setMessage(null);
      setError(null);
      setDeletingId(item.id);
      try {
        await requestJson<LibraryDeleteResponse>(`/api/library/${item.id}`, {
          method: "DELETE"
        });
        removeItemFromSnapshot(item);
        setMessage("资料已删除");
        await loadItems({ noticePrefix: "资料已删除，但资料列表刷新失败" });
      } catch (nextError) {
        if (isAuthError(nextError)) {
          setAuthRequired(true);
          return;
        }

        if (getRequestStatus(nextError) === 404) {
          removeItemFromSnapshot(item);
          setMessage("资料不存在或已删除");
          await loadItems({ noticePrefix: "资料已从列表移除，但资料列表刷新失败" });
          return;
        }

        setError(getLibraryPageBaseRequestMessage(nextError, "删除失败"));
      } finally {
        setDeletingId(null);
      }
    },
    [
      loadItems,
      removeItemFromSnapshot,
      setAuthRequired,
      setDeletingId,
      setError,
      setMessage,
      user?.role
    ]
  );

  return {
    submitImport,
    downloadBatchTemplate,
    handleBatchFileChange,
    submitBatchImport,
    submitAiGenerate,
    downloadItem,
    removeItem
  };
}
