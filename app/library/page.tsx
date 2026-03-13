"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import { getRequestErrorMessage, requestJson } from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";
import LibraryAdminImportPanel from "./_components/LibraryAdminImportPanel";
import LibraryAiGeneratePanel from "./_components/LibraryAiGeneratePanel";
import LibraryBatchImportPanel from "./_components/LibraryBatchImportPanel";
import LibraryFiltersPanel from "./_components/LibraryFiltersPanel";
import LibraryListPanel from "./_components/LibraryListPanel";
import type {
  BatchImportSummary,
  ClassItem,
  LibraryAiGenerateResponse,
  LibraryBatchImportFailedItem,
  LibraryBatchImportResponse,
  LibraryDeleteResponse,
  LibraryAiFormState,
  LibraryBatchPreview,
  LibraryContentFilter,
  LibraryFacets,
  LibraryImportFormState,
  LibraryItem,
  LibraryMeta,
  LibrarySubjectGroup,
  LibrarySummary,
  LibraryUser,
  LibraryViewMode
} from "./types";
import {
  DEFAULT_FACETS,
  DEFAULT_META,
  DEFAULT_SUMMARY,
  buildBatchImportTemplate,
  contentTypeLabel,
  contentTypeRank,
  toBase64
} from "./utils";

export default function LibraryPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const [user, setUser] = useState<LibraryUser>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [importForm, setImportForm] = useState<LibraryImportFormState>({
    title: "",
    description: "",
    subject: "math",
    grade: "4",
    contentType: "textbook",
    sourceType: "file",
    textContent: "",
    linkUrl: ""
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchPreview, setBatchPreview] = useState<LibraryBatchPreview | null>(null);
  const [batchSummary, setBatchSummary] = useState<BatchImportSummary | null>(null);
  const [batchFailedPreview, setBatchFailedPreview] = useState<string[]>([]);

  const [aiForm, setAiForm] = useState<LibraryAiFormState>({
    classId: "",
    topic: "",
    contentType: "lesson_plan"
  });
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [contentFilter, setContentFilter] = useState<LibraryContentFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(16);
  const [meta, setMeta] = useState<LibraryMeta>(DEFAULT_META);
  const [facets, setFacets] = useState<LibraryFacets>(DEFAULT_FACETS);
  const [summary, setSummary] = useState<LibrarySummary>(DEFAULT_SUMMARY);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const [expandedTypeKeys, setExpandedTypeKeys] = useState<string[]>([]);
  const [libraryViewMode, setLibraryViewMode] = useState<LibraryViewMode>("compact");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (subjectFilter !== "all") {
        params.set("subject", subjectFilter);
      }
      if (contentFilter !== "all") {
        params.set("contentType", contentFilter);
      }
      if (keyword.trim()) {
        params.set("keyword", keyword.trim());
      }
      const res = await fetch(`/api/library?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "资料加载失败");
        return;
      }
      setItems(data.data ?? []);
      const nextMeta: LibraryMeta = {
        total: Number(data?.meta?.total ?? 0),
        page: Number(data?.meta?.page ?? 1),
        pageSize: Number(data?.meta?.pageSize ?? pageSize),
        totalPages: Number(data?.meta?.totalPages ?? 0),
        hasPrev: Boolean(data?.meta?.hasPrev),
        hasNext: Boolean(data?.meta?.hasNext)
      };
      setMeta(nextMeta);
      setFacets({
        subjects: Array.isArray(data?.facets?.subjects) ? data.facets.subjects : [],
        grades: Array.isArray(data?.facets?.grades) ? data.facets.grades : [],
        contentTypes: Array.isArray(data?.facets?.contentTypes) ? data.facets.contentTypes : []
      });
      setSummary({
        textbookCount: Number(data?.summary?.textbookCount ?? 0),
        coursewareCount: Number(data?.summary?.coursewareCount ?? 0),
        lessonPlanCount: Number(data?.summary?.lessonPlanCount ?? 0)
      });
      if (nextMeta.page !== page) {
        setPage(nextMeta.page);
      }
    } finally {
      setLoading(false);
    }
  }, [contentFilter, keyword, page, pageSize, subjectFilter]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data?.data ?? null));
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (user?.role === "teacher") {
      fetch("/api/teacher/classes")
        .then((res) => res.json())
        .then((data) => {
          const list = data.data ?? [];
          setClasses(list);
          if (!aiForm.classId && list.length) {
            setAiForm((prev) => ({ ...prev, classId: list[0].id }));
          }
        });
    }
  }, [aiForm.classId, user?.role]);

  useEffect(() => {
    if (importForm.contentType === "textbook" && importForm.sourceType !== "file") {
      setImportForm((prev) => ({
        ...prev,
        sourceType: "file",
        textContent: "",
        linkUrl: ""
      }));
    }
  }, [importForm.contentType, importForm.sourceType]);

  useEffect(() => {
    setPage(1);
  }, [subjectFilter, contentFilter, keyword, pageSize]);

  const subjectList = useMemo(() => {
    const keys = facets.subjects.map((item) => item.value);
    return keys.slice().sort((a, b) => {
      const left = SUBJECT_LABELS[a] ?? a;
      const right = SUBJECT_LABELS[b] ?? b;
      return left.localeCompare(right, "zh-CN");
    });
  }, [facets.subjects]);

  const groupedBySubject = useMemo<LibrarySubjectGroup[]>(() => {
    const bucket = new Map<string, LibraryItem[]>();
    items.forEach((item) => {
      const list = bucket.get(item.subject) ?? [];
      list.push(item);
      bucket.set(item.subject, list);
    });

    return Array.from(bucket.entries())
      .map(([subject, list]) => ({
        subject,
        label: SUBJECT_LABELS[subject] ?? subject,
        list: list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        contentGroups: (["textbook", "courseware", "lesson_plan"] as LibraryItem["contentType"][])
          .map((itemContentType) => ({
            contentType: itemContentType,
            label: contentTypeLabel(itemContentType),
            list: list.filter((item) => item.contentType === itemContentType)
          }))
          .filter((group) => group.list.length)
          .sort((a, b) => contentTypeRank(a.contentType) - contentTypeRank(b.contentType))
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  }, [items]);

  useEffect(() => {
    setExpandedSubjects((prev) => {
      const visibleSubjects = new Set(groupedBySubject.map((item) => item.subject));
      return prev.filter((item) => visibleSubjects.has(item));
    });
  }, [groupedBySubject]);

  useEffect(() => {
    setExpandedTypeKeys((prev) => {
      const visibleKeys = new Set(
        groupedBySubject.flatMap((group) => group.contentGroups.map((contentGroup) => `${group.subject}:${contentGroup.contentType}`))
      );
      return prev.filter((item) => visibleKeys.has(item));
    });
  }, [groupedBySubject]);

  function toggleExpandedSubject(subject: string) {
    setExpandedSubjects((prev) => (prev.includes(subject) ? prev.filter((item) => item !== subject) : [...prev, subject]));
  }

  function toggleExpandedType(typeKey: string) {
    setExpandedTypeKeys((prev) => (prev.includes(typeKey) ? prev.filter((item) => item !== typeKey) : [...prev, typeKey]));
  }

  function setAllSubjectsExpanded(expanded: boolean) {
    if (!expanded) {
      setExpandedSubjects([]);
      return;
    }
    setExpandedSubjects(groupedBySubject.map((group) => group.subject));
  }

  function setAllTypesExpanded(expanded: boolean) {
    if (!expanded) {
      setExpandedTypeKeys([]);
      return;
    }
    setExpandedTypeKeys(groupedBySubject.flatMap((group) => group.contentGroups.map((contentGroup) => `${group.subject}:${contentGroup.contentType}`)));
  }

  async function submitImport(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (user?.role !== "admin") return;

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
        setImportForm((prev) => ({ ...prev, title: "", description: "", textContent: "", linkUrl: "" }));
        setImportFile(null);
        await loadItems();
      },
      (nextError) => {
        setError(getRequestErrorMessage(nextError, "导入失败"));
      }
    );
  }

  function downloadBatchTemplate() {
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
  }

  async function handleBatchFileChange(file?: File | null) {
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
  }

  async function submitBatchImport(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setBatchSummary(null);
    setBatchFailedPreview([]);
    if (user?.role !== "admin") return;
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
        const data = await requestJson<LibraryBatchImportResponse>("/api/admin/library/batch-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const toFailedPreview = (items: LibraryBatchImportFailedItem[], label: string) =>
          items.map((item) => `${label}#${Number(item.index) + 1}: ${item.reason}`);

        const nextSummary = data.data?.summary ?? null;
        const textbookFailed = toFailedPreview(data.data?.textbooks?.failed ?? [], "教材");
        const questionFailed = toFailedPreview(data.data?.questions?.failed ?? [], "习题");
        setBatchSummary(nextSummary);
        setBatchFailedPreview([...textbookFailed, ...questionFailed].slice(0, 20));
        setMessage("批量导入完成");
        await loadItems();
      },
      (nextError) => {
        setError(getRequestErrorMessage(nextError, "批量导入失败"));
      }
    );
  }

  async function submitAiGenerate(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (user?.role !== "teacher") return;
    if (!aiForm.classId || !aiForm.topic.trim()) {
      setError("请先选择班级并填写主题");
      return;
    }

    const res = await fetch("/api/teacher/library/ai-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiForm)
    });
    const data = (await res.json()) as LibraryAiGenerateResponse;
    if (!res.ok) {
      setError(data.error ?? "生成失败");
      return;
    }
    const citationCount = Array.isArray(data.data?.citations) ? data.data.citations.length : 0;
    const governance = data.data?.citationGovernance;
    const needsManualReview = Boolean(governance?.needsManualReview);
    const reviewHint = needsManualReview ? `，建议复核（${String(governance?.manualReviewReason ?? "引用可信度风险")}）` : "";
    setMessage(citationCount ? `AI 资料已生成并发布（引用教材片段 ${citationCount} 条${reviewHint}）` : `AI 资料已生成并发布${reviewHint}`);
    setAiForm((prev) => ({ ...prev, topic: "" }));
    await loadItems();
  }

  async function fetchLibraryItemDetail(id: string) {
    const res = await fetch(`/api/library/${id}`, { cache: "no-store" });
    let data: { data?: LibraryItem; error?: string } | null = null;
    try {
      data = (await res.json()) as { data?: LibraryItem; error?: string };
    } catch {
      data = null;
    }
    if (!res.ok) {
      setError(data?.error ?? "获取资料详情失败");
      return null;
    }
    return data?.data ?? null;
  }

  function downloadText(item: LibraryItem) {
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
  }

  async function downloadItem(item: LibraryItem) {
    if (item.contentType === "textbook" && item.sourceType === "link") {
      setError("教材资源只支持文件，当前外链已禁用");
      return;
    }
    setError(null);
    let detail = item;

    if (item.sourceType === "text" || item.sourceType === "file") {
      const loaded = await fetchLibraryItemDetail(item.id);
      if (!loaded) return;
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
  }

  async function removeItem(item: LibraryItem) {
    if (user?.role !== "admin") return;
    const confirmed = window.confirm(`确认删除「${item.title}」吗？删除后不可恢复。`);
    if (!confirmed) return;

    setMessage(null);
    setError(null);
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/library/${item.id}`, { method: "DELETE" });
      let data: LibraryDeleteResponse | null = null;
      try {
        data = (await res.json()) as LibraryDeleteResponse;
      } catch {
        data = null;
      }
      if (!res.ok) {
        if (res.status === 404) {
          setItems((prev) => prev.filter((entry) => entry.id !== item.id));
          setMessage("资料不存在或已删除");
          await loadItems();
          return;
        }
        setError(data?.error ?? "删除失败");
        return;
      }
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      setMessage("资料已删除");
      await loadItems();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>教材与课件资料库</h2>
          <div className="section-sub">支持全局教材导入、AI 生成课件/教案、阅读与标注。</div>
        </div>
        <span className="chip">资料中心</span>
      </div>

      {user?.role === "admin" ? (
        <LibraryAdminImportPanel importForm={importForm} setImportForm={setImportForm} setImportFile={setImportFile} onSubmit={submitImport} />
      ) : null}

      {user?.role === "admin" ? (
        <LibraryBatchImportPanel
          batchPreview={batchPreview}
          batchSummary={batchSummary}
          batchFailedPreview={batchFailedPreview}
          onDownloadBatchTemplate={downloadBatchTemplate}
          onBatchFileChange={handleBatchFileChange}
          onSubmit={submitBatchImport}
        />
      ) : null}

      {user?.role === "teacher" ? <LibraryAiGeneratePanel classes={classes} aiForm={aiForm} setAiForm={setAiForm} onSubmit={submitAiGenerate} /> : null}

      {error ? <div className="status-note error">{error}</div> : null}
      {message ? <div className="status-note success">{message}</div> : null}
      {stepUpDialog}

      <LibraryFiltersPanel
        subjectList={subjectList}
        facets={facets}
        subjectFilter={subjectFilter}
        setSubjectFilter={setSubjectFilter}
        contentFilter={contentFilter}
        setContentFilter={setContentFilter}
        keyword={keyword}
        setKeyword={setKeyword}
        pageSize={pageSize}
        setPageSize={setPageSize}
        meta={meta}
        summary={summary}
        loading={loading}
        onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
        onNextPage={() => setPage((prev) => prev + 1)}
      />

      <LibraryListPanel
        loading={loading}
        groupedBySubject={groupedBySubject}
        expandedSubjects={expandedSubjects}
        expandedTypeKeys={expandedTypeKeys}
        libraryViewMode={libraryViewMode}
        userRole={user?.role}
        deletingId={deletingId}
        itemsCount={items.length}
        totalCount={meta.total}
        onSetLibraryViewMode={setLibraryViewMode}
        onSetAllSubjectsExpanded={setAllSubjectsExpanded}
        onSetAllTypesExpanded={setAllTypesExpanded}
        onToggleExpandedSubject={toggleExpandedSubject}
        onToggleExpandedType={toggleExpandedType}
        onDownloadItem={downloadItem}
        onRemoveItem={removeItem}
      />
    </div>
  );
}
